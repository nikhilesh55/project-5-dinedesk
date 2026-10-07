"""
Unit tests for DineDesk Relational Database Layer.
Verifies all 8 required tables, schema constraints, and CRUD operations.
"""

import unittest
import sqlite3
from pathlib import Path
import os
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Use isolated test database
os.environ["DATABASE_PATH"] = str(PROJECT_ROOT / "test_dinedesk.db")

from backend.db import init_db, seed_data, get_db_connection


class TestDineDeskDatabase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        test_db = Path(os.environ["DATABASE_PATH"])
        if test_db.exists():
            test_db.unlink()
        init_db()
        seed_data()

    @classmethod
    def tearDownClass(cls):
        test_db = Path(os.environ["DATABASE_PATH"])
        if test_db.exists():
            test_db.unlink()

    def test_all_eight_required_tables_exist(self):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()

        required_tables = [
            "users",
            "tables",
            "reservations",
            "menu_items",
            "orders",
            "order_items",
            "kitchen_events",
            "audit_logs"
        ]
        for tbl in required_tables:
            self.assertIn(tbl, tables, f"Mandatory table '{tbl}' is missing from schema")

    def test_seed_users(self):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT email, role FROM users;")
        users = {row["email"]: row["role"] for row in cursor.fetchall()}
        conn.close()

        self.assertIn("host@dinedesk.com", users)
        self.assertEqual(users["host@dinedesk.com"], "host")
        self.assertIn("kitchen@dinedesk.com", users)
        self.assertEqual(users["kitchen@dinedesk.com"], "kitchen")
        self.assertIn("admin@dinedesk.com", users)
        self.assertEqual(users["admin@dinedesk.com"], "admin")

    def test_foreign_key_enforcement(self):
        conn = get_db_connection()
        cursor = conn.cursor()
        # Inserting order with non-existent table_id must fail foreign key check
        with self.assertRaises(sqlite3.IntegrityError):
            cursor.execute("""
                INSERT INTO orders (order_number, table_id, status, total_amount)
                VALUES ('ORD-INVALID', 99999, 'new', 25.00);
            """)
            conn.commit()
        conn.close()


if __name__ == "__main__":
    unittest.main()
