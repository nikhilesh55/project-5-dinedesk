"""
Unit tests for DineDesk Authentication and RBAC.
"""

import unittest
from pathlib import Path
import os
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ["DATABASE_PATH"] = str(PROJECT_ROOT / "test_auth.db")

from backend.db import init_db, seed_data, hash_password
from backend.auth import authenticate_user, register_user, create_token, verify_token


class TestDineDeskAuth(unittest.TestCase):

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

    def test_password_hashing(self):
        h1 = hash_password("MySecretPass123!")
        h2 = hash_password("MySecretPass123!")
        self.assertEqual(h1, h2)
        self.assertNotEqual(h1, "MySecretPass123!")

    def test_valid_host_login(self):
        res = authenticate_user("host@dinedesk.com", "HostPass123!")
        self.assertIsNotNone(res)
        self.assertEqual(res["user"]["role"], "host")
        self.assertTrue(bool(res["token"]))

        # Verify token payload
        payload = verify_token(res["token"])
        self.assertIsNotNone(payload)
        self.assertEqual(payload["email"], "host@dinedesk.com")
        self.assertEqual(payload["role"], "host")

    def test_invalid_login(self):
        res = authenticate_user("host@dinedesk.com", "WrongPassword!")
        self.assertIsNone(res)

        res2 = authenticate_user("nonexistent@dinedesk.com", "SomePass")
        self.assertIsNone(res2)

    def test_token_tampering(self):
        res = authenticate_user("kitchen@dinedesk.com", "KitchenPass123!")
        token = res["token"]
        tampered_token = token[:-4] + "fake"
        self.assertIsNone(verify_token(tampered_token))


if __name__ == "__main__":
    unittest.main()
