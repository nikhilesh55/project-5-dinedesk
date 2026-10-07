"""
DineDesk Authentication & Authorization
Cryptographic token generation, password verification, and role-based access control.
"""

import hmac
import hashlib
import base64
import json
import time
from datetime import datetime, timedelta
from backend.config import SECRET_KEY, TOKEN_EXPIRY_HOURS
from backend.db import get_db_connection, hash_password
from backend.logger import info, warn, error


def create_token(user_id: int, email: str, role: str, name: str) -> str:
    """Generate an HMAC-SHA256 signed bearer token."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "exp": int(time.time()) + (TOKEN_EXPIRY_HOURS * 3600),
        "iat": int(time.time()),
    }
    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode("utf-8").rstrip("=")
    
    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")
    
    return f"{payload_b64}.{sig_b64}"


def verify_token(token: str):
    """Verify HMAC signature and expiration on a token; returns dict payload or None."""
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        # Pad base64 strings if necessary
        p_padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        s_padded = sig_b64 + "=" * (-len(sig_b64) % 4)

        expected_sig = hmac.new(
            SECRET_KEY.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256
        ).digest()
        actual_sig = base64.urlsafe_b64decode(s_padded)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = base64.urlsafe_b64decode(p_padded)
        payload = json.loads(payload_bytes.decode("utf-8"))

        if payload.get("exp", 0) < time.time():
            return None  # Expired

        return payload
    except Exception as e:
        warn(f"Token verification failed: {e}")
        return None


def authenticate_user(email: str, password: str):
    """Validate credentials and return user info + new token, or None."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = ?;", (email.strip().lower(),))
    user = cursor.fetchone()
    conn.close()

    if not user:
        warn(f"Failed login attempt for unknown email: {email}")
        return None

    if user["password_hash"] != hash_password(password):
        warn(f"Failed login attempt (invalid password) for user: {email}")
        return None

    info(f"User authenticated successfully: {email} (role: {user['role']})")
    token = create_token(user["id"], user["email"], user["role"], user["name"])
    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
        "token": token
    }


def register_user(name: str, email: str, password: str, role: str = "customer"):
    """Register a new user and return token."""
    if role not in ["customer", "host", "kitchen", "admin"]:
        role = "customer"

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE email = ?;", (email.strip().lower(),))
        if cursor.fetchone():
            conn.close()
            return {"error": "Email is already registered"}

        pw_hash = hash_password(password)
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);",
            (name.strip(), email.strip().lower(), pw_hash, role)
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        info(f"New user registered: {email} (id: {user_id}, role: {role})")
        token = create_token(user_id, email.strip().lower(), role, name.strip())
        return {
            "user": {
                "id": user_id,
                "name": name.strip(),
                "email": email.strip().lower(),
                "role": role,
            },
            "token": token
        }
    except Exception as e:
        conn.close()
        error(f"Error registering user: {e}")
        return {"error": str(e)}
