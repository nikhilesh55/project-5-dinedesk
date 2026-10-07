"""
Unit tests for Table Capacity Validation & Reservation Lifecycle.
"""

import unittest
from pathlib import Path
import os
import sys
from datetime import datetime, timedelta

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ["DATABASE_PATH"] = str(PROJECT_ROOT / "test_capacity.db")

from backend.db import init_db, seed_data
from backend.routes import ApiHandler


class TestTableCapacity(unittest.TestCase):

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

    def test_capacity_check_and_reservation(self):
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        # 1. Check availability
        status, res = ApiHandler.check_availability({
            "date": [tomorrow],
            "time": ["19:00"],
            "party_size": ["4"]
        })
        self.assertEqual(status, 200)
        self.assertTrue(res["available"])
        self.assertGreaterEqual(res["table"]["capacity"], 4)

        # 2. Create reservation
        status, create_res = ApiHandler.create_reservation({
            "customer_name": "Eleanor Vance",
            "customer_email": "eleanor@hillhouse.org",
            "customer_phone": "+1-555-9988",
            "party_size": 4,
            "reservation_date": tomorrow,
            "reservation_time": "19:00",
            "special_requests": "Quiet booth"
        }, ip="127.0.0.1")
        self.assertEqual(status, 201)
        booking = create_res["reservation"]
        code = booking["confirmation_code"]
        self.assertTrue(code.startswith("DD-"))

        # 3. Lookup reservation
        status, lookup_res = ApiHandler.lookup_reservation(code)
        self.assertEqual(status, 200)
        self.assertEqual(lookup_res["reservation"]["customer_name"], "Eleanor Vance")

        # 4. Cancel reservation
        status, cancel_res = ApiHandler.cancel_reservation_by_code(code, ip="127.0.0.1")
        self.assertEqual(status, 200)

        # 5. Verify cancelled status
        status, lookup_res2 = ApiHandler.lookup_reservation(code)
        self.assertEqual(lookup_res2["reservation"]["status"], "cancelled")


if __name__ == "__main__":
    unittest.main()
