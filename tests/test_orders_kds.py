"""
Unit tests for Kitchen Order Lifecycle and KDS Board.
"""

import unittest
from pathlib import Path
import os
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ["DATABASE_PATH"] = str(PROJECT_ROOT / "test_orders.db")

from backend.db import init_db, seed_data
from backend.routes import ApiHandler


class TestKitchenOrders(unittest.TestCase):

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

    def test_order_lifecycle(self):
        # 1. Create order for Table 1
        auth_user = {"sub": 2, "name": "Marco", "role": "kitchen"}
        status, order_res = ApiHandler.create_order({
            "table_id": 1,
            "items": [
                {"menu_item_id": 1, "quantity": 2, "notes": "Extra crispy"},
                {"menu_item_id": 4, "quantity": 1, "notes": "Medium-rare"}
            ],
            "notes": "Rush order"
        }, auth_user, ip="127.0.0.1")
        self.assertEqual(status, 201)
        order = order_res["order"]
        order_id = order["id"]
        self.assertEqual(order["status"], "new")

        # 2. Transition: new -> preparing
        status, s_res = ApiHandler.update_order_status(order_id, {"status": "preparing"}, auth_user, ip="127.0.0.1")
        self.assertEqual(status, 200)

        # 3. Transition: preparing -> ready
        status, s_res2 = ApiHandler.update_order_status(order_id, {"status": "ready"}, auth_user, ip="127.0.0.1")
        self.assertEqual(status, 200)

        # 4. Transition: ready -> served
        status, s_res3 = ApiHandler.update_order_status(order_id, {"status": "served"}, auth_user, ip="127.0.0.1")
        self.assertEqual(status, 200)

        # 5. Check Kitchen Board lanes
        status, board = ApiHandler.get_kitchen_board()
        self.assertEqual(status, 200)
        lanes = board["lanes"]
        self.assertIn("served", lanes)
        served_order_ids = [o["id"] for o in lanes["served"]]
        self.assertIn(order_id, served_order_ids)


if __name__ == "__main__":
    unittest.main()
