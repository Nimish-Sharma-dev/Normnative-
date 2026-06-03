"""
gnn_model.py — Dev 3 (Ronit)

NormativeGNN: GraphSAGE + GAT hybrid that operates on subgraphs around
suspicious nodes flagged by Dev 2.

Outputs:
  - Node classification: normal (0) | suspicious (1) | malicious (2)
  - Next-technique probability distribution over MITRE ATT&CK techniques

Node feature vector (NODE_FEATURES) — 12 fields, fixed order:
  [login_fail_count, login_success_count, unique_dest_ips, bytes_sent_total,
   file_ops_count, cpu_pct_avg, payload_flag_count,
   in_degree, out_degree, avg_edge_weight,
   lstm_score_avg, iforest_score_avg]

Input dim: 12
"""

import logging
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import GATConv, SAGEConv
from torch_geometric.utils import from_networkx

from graph_builder import AttackGraph
from mitre_transitions import TECHNIQUE_NAMES, TRANSITION_MATRIX

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# NODE_FEATURES — canonical ordered list.  THIS ORDER IS THE CONTRACT.
# gnn_model.py, incident_assembler.py, and any feature builder must use this.
# ---------------------------------------------------------------------------
NODE_FEATURES = [
    "login_fail_count",    # aggregated from ML_FEATURE_VECTORs for this node
    "login_success_count",
    "unique_dest_ips",
    "bytes_sent_total",
    "file_ops_count",
    "cpu_pct_avg",
    "payload_flag_count",
    "in_degree",           # graph topology — from AttackGraph
    "out_degree",
    "avg_edge_weight",
    "lstm_score_avg",      # from ANOMALY_SCORE_OBJECTs for this node
    "iforest_score_avg",
]

INPUT_DIM = len(NODE_FEATURES)   # 12
HIDDEN_DIM = 64
NUM_CLASSES = 3                  # 0=normal, 1=suspicious, 2=malicious
NUM_TECHNIQUES = len(TRANSITION_MATRIX)

NODE_CLASS_LABELS = {0: "normal", 1: "suspicious", 2: "malicious"}

# Ordered list of technique IDs so the output head has a stable column order
TECHNIQUE_IDS = list(TECHNIQUE_NAMES.keys())


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

class NormativeGNN(nn.Module):
    """
    Two-layer GraphSAGE encoder → GAT attention layer → dual output heads:
      1. node_class_head   : 3-class softmax  (normal / suspicious / malicious)
      2. next_technique_head: softmax over MITRE techniques
    """

    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        hidden_dim: int = HIDDEN_DIM,
        num_classes: int = NUM_CLASSES,
        num_techniques: int = NUM_TECHNIQUES,
        gat_heads: int = 4,
    ):
        super().__init__()

        # --- Encoder ---
        self.sage1 = SAGEConv(input_dim, hidden_dim)
        self.sage2 = SAGEConv(hidden_dim, hidden_dim)

        # GAT refinement — multi-head attention, concat → project back to hidden_dim
        self.gat = GATConv(hidden_dim, hidden_dim // gat_heads, heads=gat_heads, dropout=0.2)

        self.norm1 = nn.LayerNorm(hidden_dim)
        self.norm2 = nn.LayerNorm(hidden_dim)
        self.norm3 = nn.LayerNorm(hidden_dim)  # gat output is hidden_dim after concat

        self.dropout = nn.Dropout(p=0.3)

        # --- Output heads ---
        self.node_class_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim // 2, num_classes),
        )

        self.next_technique_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim // 2, num_techniques),
        )

    def forward(self, data: Data):
        x, edge_index = data.x, data.edge_index

        # Layer 1: SAGEConv
        x = self.sage1(x, edge_index)
        x = self.norm1(x)
        x = F.relu(x)
        x = self.dropout(x)

        # Layer 2: SAGEConv
        x = self.sage2(x, edge_index)
        x = self.norm2(x)
        x = F.relu(x)
        x = self.dropout(x)

        # Layer 3: GAT
        x = self.gat(x, edge_index)
        x = self.norm3(x)
        x = F.elu(x)

        # Dual heads
        class_logits = self.node_class_head(x)          # [N, 3]
        technique_logits = self.next_technique_head(x)  # [N, num_techniques]

        return class_logits, technique_logits


# ---------------------------------------------------------------------------
# Inference helper
# ---------------------------------------------------------------------------

class GNNInference:
    """
    Wraps NormativeGNN with:
      - model loading / weight initialization
    - subgraph → PyG Data conversion
      - MITRE transition matrix seeding of technique probabilities
      - GNN_OUTPUT schema assembly
    """

    def __init__(self, weights_path: Optional[str] = None, device: str = "cpu"):
        self.device = torch.device(device)
        self.model = NormativeGNN().to(self.device)

        if weights_path:
            try:
                state = torch.load(weights_path, map_location=self.device)
                self.model.load_state_dict(state)
                logger.info("GNN weights loaded from %s", weights_path)
            except FileNotFoundError:
                logger.warning("Weights not found at %s — using random init", weights_path)
        else:
            logger.info("No weights path provided — using random init (demo mode)")

        self.model.eval()

    def build_pyg_data(
        self,
        subgraph,           # nx.DiGraph from AttackGraph.get_subgraph()
        node_feature_map: dict,  # {node_id: dict of NODE_FEATURES values}
        target_node: str,
    ) -> tuple[Data, list[str]]:
        """
        Convert a NetworkX subgraph into a PyTorch Geometric Data object.

        Args:
            subgraph         : nx.DiGraph ego-graph around target_node
            node_feature_map : {node_id: {feature_name: float, ...}}
                               Must include all 12 NODE_FEATURES per node.
            target_node      : the node we're running inference for

        Returns:
            (Data, node_list) — PyG data object and ordered node list
                                 (node_list[i] is the entity at row i in x)
        """
        nodes = list(subgraph.nodes())
        if not nodes:
            # Fallback: single-node graph with zero features
            nodes = [target_node]

        node_index = {n: i for i, n in enumerate(nodes)}

        # Build feature matrix [N, 12]
        feature_rows = []
        for node in nodes:
            feats = node_feature_map.get(node, {})
            row = [float(feats.get(f, 0.0)) for f in NODE_FEATURES]
            feature_rows.append(row)

        x = torch.tensor(feature_rows, dtype=torch.float32)

        # Build edge_index [2, E]
        edges = [(node_index[u], node_index[v]) for u, v in subgraph.edges() if u in node_index and v in node_index]
        if edges:
            edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
        else:
            edge_index = torch.zeros((2, 0), dtype=torch.long)

        data = Data(x=x, edge_index=edge_index)
        return data, nodes

    @torch.no_grad()
    def infer(
        self,
        attack_graph: AttackGraph,
        target_node: str,
        node_feature_map: dict,
        current_technique: Optional[str] = None,
    ) -> dict:
        """
        Run GNN inference for target_node.

        Args:
            attack_graph      : live AttackGraph instance
            target_node       : node ID (IP / user / process) to classify
            node_feature_map  : {node_id: {feature: value}} for subgraph nodes
            current_technique : most recently matched MITRE technique_id (optional)
                                Used to seed TRANSITION_MATRIX priors.

        Returns:
            GNN_OUTPUT dict (exact schema — see below)
        """
        subgraph = attack_graph.get_subgraph(target_node, hops=2)
        data, node_list = self.build_pyg_data(subgraph, node_feature_map, target_node)
        data = data.to(self.device)

        class_logits, technique_logits = self.model(data)

        # Find the row index for target_node
        target_idx = node_list.index(target_node) if target_node in node_list else 0

        # Node classification
        class_probs = F.softmax(class_logits[target_idx], dim=0)
        node_class = int(class_probs.argmax().item())
        gnn_confidence = float(class_probs.max().item())

        # Next-technique probabilities
        tech_probs_raw = F.softmax(technique_logits[target_idx], dim=0).cpu().tolist()
        tech_probs = {tid: tech_probs_raw[i] for i, tid in enumerate(TECHNIQUE_IDS)}

        # Seed with MITRE transition matrix if current technique is known
        if current_technique and current_technique in TRANSITION_MATRIX:
            transitions = dict(TRANSITION_MATRIX[current_technique])
            # Blend: 60% transition prior, 40% GNN output
            for tid in TECHNIQUE_IDS:
                prior = transitions.get(tid, 0.0)
                tech_probs[tid] = 0.6 * prior + 0.4 * tech_probs.get(tid, 0.0)

            # Renormalize
            total = sum(tech_probs.values())
            if total > 0:
                tech_probs = {k: v / total for k, v in tech_probs.items()}

        # GNN_OUTPUT schema
        return {
            "node_id":             target_node,
            "node_class":          node_class,
            "node_class_label":    NODE_CLASS_LABELS[node_class],
            "gnn_confidence":      gnn_confidence,
            "next_technique_probs": tech_probs,
        }
