#!/usr/bin/env python3
"""
DineDesk: Restaurant Reservation & Kitchen Order Console
Project 05 | Full-Stack Operations Platform

Run this file directly to launch the application:
    python3 app.py
"""

import sys
import os
import socket
from pathlib import Path

# Add project root to Python search path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.db import init_db, seed_data, DB_PATH
from backend.server import run_server
from backend.logger import info, error


def find_free_port(start_port: int = 5000, max_attempts: int = 20) -> int:
    """Find an available port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                continue
    return start_port


def main():
    print("=" * 72)
    print("  🍽️   DINEDESK · RESTAURANT RESERVATION & KITCHEN ORDER CONSOLE")
    print("  Project 05 | Industry Full-Stack Operational Platform")
    print("=" * 72)

    # 1. Initialize SQLite Database & Relational Schema
    print("[1/2] Initializing SQLite database and relational tables...")
    try:
        init_db()
        seed_data()
        print(f"      ✓ SQLite ready at: {DB_PATH}")
    except Exception as e:
        error(f"Failed to initialize database: {e}")
        sys.exit(1)

    # 2. Configure Host and Cloud Port
    host = "0.0.0.0"
    port_env = os.environ.get("PORT")
    if port_env:
        try:
            port = int(port_env)
            print(f"[2/2] Using Cloud PORT from environment: {port}")
        except ValueError:
            port = 5000
            print(f"[2/2] Invalid PORT env var, falling back to: {port}")
    else:
        port = find_free_port(5000)
        print(f"[2/2] Local development mode detected; binding port: {port}")

    print("-" * 72)
    print(f"  🚀  Server Active: http://localhost:{port}")
    print(f"  📡  Network Host:  http://{host}:{port}")
    print("  🔑  Demo Accounts:")
    print("      • Host:    host@dinedesk.com    / HostPass123!")
    print("      • Kitchen: kitchen@dinedesk.com / KitchenPass123!")
    print("      • Manager: admin@dinedesk.com   / AdminPass123!")
    print("=" * 72)

    # Run Server
    run_server(host=host, port=port)


if __name__ == "__main__":
    main()
