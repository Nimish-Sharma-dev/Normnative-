"""
metrics_service.py — Dev 2 (Omkar)
FastAPI route: GET /api/metrics
Called by the dashboard (Dev 4) every 10 seconds.

Strategy:
  • Seed metrics with values pre-computed on the CICIDS2018 test split.
  • Update TP/FP/TN/FN counters as the simulator publishes attack events
    that get flagged by the scorer (attack events → ground-truth positive).
  • Expose a thread-safe update hook used by anomaly_scorer.py.
"""

import threading
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter()

# ---------------------------------------------------------------------------
# Seed values from CICIDS2018 offline evaluation
# (replace with your actual test-split numbers before the demo)
# ---------------------------------------------------------------------------
_SEED = {
    "tp": 412,
    "fp": 23,
    "tn": 538,
    "fn": 27,
}

# ---------------------------------------------------------------------------
# Live counters (updated in real time from anomaly_scorer)
# ---------------------------------------------------------------------------
_lock = threading.Lock()

_tp: int = _SEED["tp"]
_fp: int = _SEED["fp"]
_tn: int = _SEED["tn"]
_fn: int = _SEED["fn"]

_total_events:    int = _tp + _fp + _tn + _fn
_total_anomalies: int = _tp + _fp


def _compute_metrics() -> dict:
    """Compute derived metrics from current confusion matrix counters."""
    with _lock:
        tp, fp, tn, fn = _tp, _fp, _tn, _fn
        total    = _total_events
        detected = _total_anomalies

    fpr       = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) > 0 else 0.0)
    accuracy  = (tp + tn) / total if total > 0 else 0.0

    return {
        "fpr":                     round(fpr, 4),
        "precision":               round(precision, 4),
        "recall":                  round(recall, 4),
        "f1":                      round(f1, 4),
        "accuracy":                round(accuracy, 4),
        "total_events_processed":  total,
        "total_anomalies_detected": detected,
        "last_updated":            datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# FastAPI endpoint
# ---------------------------------------------------------------------------
@router.get("/api/metrics")
def get_metrics() -> dict:
    """
    Returns current model performance metrics.
    Schema (all fields always present):
        fpr                     float
        precision               float
        recall                  float
        f1                      float
        accuracy                float
        total_events_processed  int
        total_anomalies_detected int
        last_updated            str  (ISO 8601)
    """
    return _compute_metrics()


# ---------------------------------------------------------------------------
# Update hooks — called by anomaly_scorer.py after each scored event
# ---------------------------------------------------------------------------
def record_true_positive() -> None:
    """Simulator attack event flagged as anomaly (correct detection)."""
    global _tp, _total_events, _total_anomalies
    with _lock:
        _tp               += 1
        _total_events     += 1
        _total_anomalies  += 1


def record_false_positive() -> None:
    """Benign event flagged as anomaly (false alarm)."""
    global _fp, _total_events, _total_anomalies
    with _lock:
        _fp               += 1
        _total_events     += 1
        _total_anomalies  += 1


def record_true_negative() -> None:
    """Benign event correctly not flagged."""
    global _tn, _total_events
    with _lock:
        _tn           += 1
        _total_events += 1


def record_false_negative() -> None:
    """Simulator attack event NOT flagged (missed detection)."""
    global _fn, _total_events
    with _lock:
        _fn           += 1
        _total_events += 1


# ---------------------------------------------------------------------------
# Bootstrap: attach router to a shared FastAPI app
# ---------------------------------------------------------------------------
# In your main app entrypoint, do:
#
#   from fastapi import FastAPI
#   from metrics_service import router as metrics_router
#   app = FastAPI()
#   app.include_router(metrics_router)
#
# Or if there is already a shared app object, just include_router there.
