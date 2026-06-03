"""
schema_validator.py — Dev 2 (Omkar)
Validates dicts against the shared integration contract JSON schemas.
All four devs can import and use this to catch contract violations early.

Usage:
    from schema_validator import validate_normalized_event, validate_anomaly_score

    ok, err = validate_normalized_event(event_dict)
    ok, err = validate_anomaly_score(score_dict)
    ok, err = validate_ml_feature_vector(fv_dict)
"""

import json
import logging
from pathlib import Path

log = logging.getLogger("schema_validator")

# ---------------------------------------------------------------------------
# Load schemas once at import time
# ---------------------------------------------------------------------------
_CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"

def _load(filename: str) -> dict:
    path = _CONTRACTS_DIR / filename
    with open(path, "r") as f:
        return json.load(f)

try:
    _NORMALIZED_EVENT_SCHEMA  = _load("normalized_event_object.schema.json")
    _ANOMALY_SCORE_SCHEMA     = _load("anomaly_score_object.schema.json")
    _ML_FEATURE_VECTOR_SCHEMA = _load("ml_feature_vector.schema.json")
    _SCHEMAS_LOADED = True
except FileNotFoundError as e:
    log.warning("Contract schema files not found (%s) — validation disabled.", e)
    _SCHEMAS_LOADED = False


# ---------------------------------------------------------------------------
# Core validator (uses jsonschema if available, falls back to key checks)
# ---------------------------------------------------------------------------
def _validate(instance: dict, schema: dict) -> tuple[bool, str]:
    """
    Returns (True, "") on success or (False, error_message) on failure.
    Tries jsonschema first; falls back to required-field check only.
    """
    if not _SCHEMAS_LOADED:
        return True, ""

    try:
        import jsonschema
        jsonschema.validate(instance=instance, schema=schema)
        return True, ""
    except ImportError:
        # jsonschema not installed — do a lightweight required-field check
        required = schema.get("required", [])
        missing = [k for k in required if k not in instance]
        if missing:
            return False, f"Missing required fields: {missing}"
        # Check no extra fields if additionalProperties=false
        if schema.get("additionalProperties") is False:
            extra = [k for k in instance if k not in schema.get("properties", {})]
            if extra:
                return False, f"Extra fields not allowed: {extra}"
        return True, ""
    except jsonschema.ValidationError as exc:
        return False, exc.message
    except Exception as exc:
        return False, str(exc)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def validate_normalized_event(event: dict) -> tuple[bool, str]:
    """Validate a NormalizedEventObject dict (Dev 1 output)."""
    return _validate(event, _NORMALIZED_EVENT_SCHEMA)


def validate_anomaly_score(score: dict) -> tuple[bool, str]:
    """Validate an AnomalyScoreObject dict (Dev 2 output)."""
    return _validate(score, _ANOMALY_SCORE_SCHEMA)


def validate_ml_feature_vector(fv: dict) -> tuple[bool, str]:
    """Validate an MLFeatureVector dict (Dev 1 → Dev 2 intermediate)."""
    return _validate(fv, _ML_FEATURE_VECTOR_SCHEMA)


def assert_normalized_event(event: dict) -> None:
    """Raise ValueError if the event dict violates the contract."""
    ok, err = validate_normalized_event(event)
    if not ok:
        raise ValueError(f"NormalizedEventObject contract violation: {err}")


def assert_anomaly_score(score: dict) -> None:
    """Raise ValueError if the score dict violates the contract."""
    ok, err = validate_anomaly_score(score)
    if not ok:
        raise ValueError(f"AnomalyScoreObject contract violation: {err}")


# ---------------------------------------------------------------------------
# CLI: validate a JSON file against a named schema
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python schema_validator.py <schema_name> <json_file>")
        print("  schema_name: normalized_event | anomaly_score | ml_feature_vector")
        sys.exit(1)

    schema_name, json_file = sys.argv[1], sys.argv[2]
    with open(json_file) as f:
        data = json.load(f)

    validators = {
        "normalized_event":   validate_normalized_event,
        "anomaly_score":      validate_anomaly_score,
        "ml_feature_vector":  validate_ml_feature_vector,
    }
    if schema_name not in validators:
        print(f"Unknown schema '{schema_name}'. Choose from: {list(validators)}")
        sys.exit(1)

    ok, err = validators[schema_name](data)
    if ok:
        print(f"✅  {json_file} is valid against '{schema_name}' schema.")
    else:
        print(f"❌  Validation failed: {err}")
        sys.exit(1)
