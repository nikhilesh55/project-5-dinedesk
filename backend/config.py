"""
DineDesk Configuration
Central configuration for application runtime, database, security, and external services.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"

# Database Configuration
DB_PATH = Path(os.environ.get("DATABASE_PATH", str(BASE_DIR / "dinedesk.db")))

# Server & Network Configuration
HOST = os.environ.get("HOST", "0.0.0.0")
DEFAULT_PORT = 5000
PORT = int(os.environ.get("PORT", DEFAULT_PORT))

# Security & Sessions
SECRET_KEY = os.environ.get("SECRET_KEY", "dinedesk-restaurant-ops-secure-secret-key-2026")
SESSION_COOKIE_NAME = "dinedesk_session"
TOKEN_EXPIRY_HOURS = 24

# External API: TheMealDB (Free Educational Key '1')
THEMEALDB_BASE_URL = "https://www.themealdb.com/api/json/v1/1"

# Restaurant Operating Hours & Time Slots
SERVICE_SLOTS = [
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
]

# Kitchen Status Workflow
ORDER_STATUSES = ["new", "preparing", "ready", "served", "cancelled"]
TABLE_STATUSES = ["available", "reserved", "occupied", "cleaning"]
RESERVATION_STATUSES = ["confirmed", "seated", "completed", "cancelled", "no_show"]
USER_ROLES = ["customer", "host", "kitchen", "admin"]
