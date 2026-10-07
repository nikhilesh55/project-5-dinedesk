"""
End-to-end HTTP integration test suite for DineDesk Server.
Verifies all REST API routes and SPA static file serving over real TCP/HTTP.
"""

import unittest
import threading
import urllib.request
import urllib.parse
import json
import time
from pathlib import Path
import os
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Use isolated test database
os.environ["DATABASE_PATH"] = str(PROJECT_ROOT / "test_e2e.db")

from backend.db import init_db, seed_data
from backend.server import DineDeskServerHandler
from http.server import ThreadingHTTPServer


class TestDineDeskServerE2E(unittest.TestCase):
    server = None
    server_thread = None
    port = 5998
    base_url = f"http://127.0.0.1:{port}"

    @classmethod
    def setUpClass(cls):
        test_db = Path(os.environ["DATABASE_PATH"])
        if test_db.exists():
            test_db.unlink()
        init_db()
        seed_data()

        # Start server in thread
        cls.server = ThreadingHTTPServer(("127.0.0.1", cls.port), DineDeskServerHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        if cls.server:
            cls.server.shutdown()
            cls.server.server_close()
        test_db = Path(os.environ["DATABASE_PATH"])
        if test_db.exists():
            test_db.unlink()

    def http_request(self, method: str, path: str, body: dict = None, token: str = None):
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode("utf-8")
                try:
                    return response.status, json.loads(res_body)
                except Exception:
                    return response.status, res_body
        except urllib.error.HTTPError as e:
            res_body = e.read().decode("utf-8")
            try:
                return e.code, json.loads(res_body)
            except Exception:
                return e.code, res_body

    def test_01_health_and_index_html(self):
        status, data = self.http_request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "ok")

        # Frontend SPA
        status, html = self.http_request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("DineDesk", html)

    def test_02_auth_login(self):
        status, data = self.http_request("POST", "/api/auth/login", {
            "email": "host@dinedesk.com",
            "password": "HostPass123!"
        })
        self.assertEqual(status, 200)
        self.assertIn("token", data)
        token = data["token"]

        # Validate /api/auth/me
        status, me = self.http_request("GET", "/api/auth/me", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(me["user"]["role"], "host")

    def test_03_tables_and_menu(self):
        status, data = self.http_request("GET", "/api/tables")
        self.assertEqual(status, 200)
        self.assertGreater(len(data.get("tables", [])), 0)

        status, mdata = self.http_request("GET", "/api/menu")
        self.assertEqual(status, 200)
        self.assertGreater(len(mdata.get("menu_items", [])), 0)

    def test_04_create_and_cancel_reservation(self):
        payload = {
            "customer_name": "Dr. Watson",
            "customer_email": "watson@bakerst.org",
            "customer_phone": "+1-555-2211",
            "party_size": 2,
            "reservation_date": "2026-12-15",
            "reservation_time": "19:00",
            "special_requests": "Window table"
        }
        status, res = self.http_request("POST", "/api/reservations", payload)
        self.assertEqual(status, 201)
        booking = res.get("reservation", {})
        code = booking.get("confirmation_code")
        self.assertTrue(bool(code))

        # Cancel
        status, c_res = self.http_request("POST", f"/api/reservations/{code}/cancel", {})
        self.assertEqual(status, 200)

    def test_05_kitchen_board_and_analytics(self):
        status, board = self.http_request("GET", "/api/kitchen/board")
        self.assertEqual(status, 200)
        self.assertIn("lanes", board)

        status, analytics = self.http_request("GET", "/api/analytics/utilization")
        self.assertEqual(status, 200)
        self.assertIn("utilization_rate", analytics)

        status, logs = self.http_request("GET", "/api/audit-logs")
        self.assertEqual(status, 200)
        self.assertIn("audit_logs", logs)


if __name__ == "__main__":
    unittest.main()
