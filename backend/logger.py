"""
DineDesk Logger & Observability
Provides structured backend logging with automatic sensitive-data sanitization.
"""

import sys
import time
import json
from datetime import datetime, timezone

LOG_LEVELS = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40}
CURRENT_LOG_LEVEL = LOG_LEVELS["INFO"]

# In-memory recent logs buffer for demonstration in the Admin console
RECENT_LOGS = []
MAX_RECENT_LOGS = 100

SENSITIVE_KEYS = {
    "password", "password_hash", "token", "secret", "secret_key",
    "authorization", "cookie", "api_key", "credential"
}


def sanitize_data(data):
    """Recursively scrub passwords and secret keys from logs."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_data(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_data(item) for item in data]
    return data


def log(level: str, message: str, context: dict = None):
    """Log formatted entry to stdout and memory buffer."""
    if LOG_LEVELS.get(level, 20) < CURRENT_LOG_LEVEL:
        return

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    entry = {
        "timestamp": timestamp,
        "level": level,
        "message": message,
    }
    if context:
        entry["context"] = sanitize_data(context)

    # Format line
    color_map = {
        "DEBUG": "\033[90m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
    }
    reset_color = "\033[0m"
    color = color_map.get(level, "")

    extra_str = f" {json.dumps(entry['context'])}" if "context" in entry else ""
    line = f"{color}[{timestamp}] [{level.ljust(7)}]{reset_color} {message}{extra_str}"
    
    print(line, flush=True)

    # Save to buffer
    RECENT_LOGS.append(entry)
    if len(RECENT_LOGS) > MAX_RECENT_LOGS:
        RECENT_LOGS.pop(0)


def info(message: str, context: dict = None):
    log("INFO", message, context)


def warn(message: str, context: dict = None):
    log("WARNING", message, context)


def error(message: str, context: dict = None):
    log("ERROR", message, context)


def debug(message: str, context: dict = None):
    log("DEBUG", message, context)


def get_recent_logs(limit: int = 50):
    """Retrieve recent log buffer for UI inspection."""
    return RECENT_LOGS[-limit:]
