# Normative — Dev 1: Data Pipeline & Ingestion

## What's in this module

```
ingestor/
  normative_ingestor.py     Main service — reads events:raw, normalizes, publishes features
  mitre_lookup.py           7 MITRE ATT&CK rules + match_rule() function (shared with Dev 3)
  feature_extractor.py      Sliding-window ML vectors + graph edges (shared contracts with Dev 2+3)
  parsers/
    auth_parser.py          SSH / RDP / Windows Security Events
    network_parser.py       Apache/Nginx HTTP logs + Netflow JSON
    endpoint_parser.py      Sysmon EventID 1/11/13 + Linux Auditd
    syslog_parser.py        Cron, bulk file ops, file integrity events
  simulator/
    log_simulator.py        Replays the full 8-step APT scenario into Redis
    attack_scenarios.py     Scripted event sequences for the demo
tests/
  test_dev1.py              85-test suite covering all parsers, extractor, MITRE rules
```

---

## Quick start (local)

### 1. Install dependencies
```bash
pip install redis faker numpy scikit-learn
```

### 2. Start Redis
```bash
redis-server
# OR via Docker:
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Start the ingestor
```bash
cd ingestor
python normative_ingestor.py
# Output: [INGESTOR] Normative ingestor started. Listening on events:raw ...
```

### 4. Run the simulator (separate terminal)
```bash
cd ingestor

# Full demo run — 90s benign baseline then full APT chain at 2× speed
python simulator/log_simulator.py --speed 2

# Tight demo (< 3 min total) — skip most of benign phase
python simulator/log_simulator.py --speed 4 --benign-duration 20

# Jump straight to attack, no benign phase
python simulator/log_simulator.py --no-benign --speed 1

# Dry run (no Redis needed — just prints events)
python simulator/log_simulator.py --dry-run --no-benign
```

### 5. Run tests
```bash
cd normative
python tests/test_dev1.py
# Expected: Total: 85  ✅ Passed: 85  ❌ Failed: 0
```

---

## Docker (full stack)

```bash
# Ingestor only
docker compose up redis ingestor

# Ingestor + simulator (demo mode)
docker compose --profile demo up
```

---

## Redis channels published by Dev 1

| Channel             | Type            | Consumers         | Contents                          |
|---------------------|-----------------|-------------------|-----------------------------------|
| `events:raw`        | list (lpush)    | ingestor reads    | Raw/partial event dicts           |
| `events:normalized` | list + pub/sub  | Dev 2, Dev 3      | Normalized Event Objects (22 keys)|
| `features:ml`       | list + pub/sub  | **Dev 2**         | ML_FEATURE_VECTOR (11-dim vector) |
| `features:graph`    | list + pub/sub  | **Dev 3**         | GRAPH_EDGE (src/dst/type/weight)  |

---

## Key integration files to share immediately

| File                    | Share with | Why                                          |
|-------------------------|-----------|----------------------------------------------|
| `mitre_lookup.py`       | **Dev 3** | `match_rule()` + all 7 MITRE rule dicts      |
| `feature_extractor.py`  | **Dev 2** | `FEATURE_ORDER` list must be identical       |
| `feature_extractor.py`  | **Dev 3** | `GRAPH_EDGE` schema for AttackGraph builder  |

### FEATURE_ORDER (tell Dev 2 this is the exact order, indices 0–10):
```python
FEATURE_ORDER = [
    "login_fail_count",       # 0
    "login_success_count",    # 1
    "unique_dest_ips",        # 2
    "bytes_sent_total",       # 3
    "file_ops_count",         # 4
    "cpu_pct_avg",            # 5
    "payload_flag_count",     # 6
    "inter_arrival_ms_avg",   # 7
    "entropy_dest_ports",     # 8
    "src_port_norm",          # 9
    "dest_port_norm",         # 10
]
INPUT_DIM = 11   # ← tell Dev 2 to use this as input_dim for the LSTM
```

---

## Demo attack scenario (what the simulator fires)

| Step | MITRE ID | What happens                                      | Delay  |
|------|----------|---------------------------------------------------|--------|
| 1    | T1110    | 12× SSH FAILURE from 203.0.113.99 → 1× SUCCESS   | 0s     |
| 2    | T1190    | HTTP 200 with `../../../../etc/passwd` in URI     | +15s   |
| 3    | T1059    | `nginx` spawns `/bin/bash`                        | +20s   |
| 4    | T1547    | `/etc/cron.d/www-data` written by www-data        | +30s   |
| 5    | T1490    | `vssadmin.exe delete shadows`                     | +40s   |
| 6    | T1486    | 312 file ops + 87.3% CPU (ransomware pattern)     | +45s   |
| 7    | T1048    | 75MB outbound to 45.33.32.156 (Fremont, CA)       | +60s   |

Attacker IP: `203.0.113.99` (Beijing) · Exfil IP: `45.33.32.156` (Fremont, CA)

---

## Normalized Event Object — all 22 keys

```python
{
    "event_id":       str,   # uuid4
    "timestamp":      str,   # ISO 8601 UTC
    "source_type":    str,   # "network" | "endpoint" | "auth" | "syslog"
    "src_ip":         str,
    "dest_ip":        str,
    "src_port":       int,
    "dest_port":      int,
    "user":           str | None,
    "action":         str,   # LOGIN_ATTEMPT | HTTP_REQUEST | PROCESS_SPAWN | FILE_WRITE | ...
    "status":         str | None,   # SUCCESS | FAILURE
    "process_name":   str | None,
    "parent_proc":    str | None,
    "child_proc":     str | None,
    "bytes_sent":     int | None,
    "uri_query":      str | None,
    "payload_flags":  list[str],    # ["LFI", "RCE", ...] or []
    "file_path":      str | None,
    "file_ops":       int | None,
    "cpu_pct":        float | None,
    "non_admin_user": bool | None,
    "http_status":    int | None,
    "raw":            dict,
}
```
