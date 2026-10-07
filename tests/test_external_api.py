"""
Unit tests for External API (TheMealDB) Integration and Normalization.
"""

import unittest
from pathlib import Path
import os
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.external_api import search_recipes, filter_by_ingredient, get_recipe_details, normalize_meal_record


class TestExternalRecipeApi(unittest.TestCase):

    def test_recipe_normalization(self):
        raw_mock = {
            "idMeal": "99999",
            "strMeal": "Truffle Tagliatelle",
            "strCategory": "Pasta",
            "strArea": "Italian",
            "strInstructions": "Boil pasta. Shave fresh truffles over butter sauce.",
            "strMealThumb": "https://example.com/pasta.jpg",
            "strTags": "Pasta,Vegetarian",
            "strYoutube": "https://youtube.com/watch?v=sample",
            "strIngredient1": "Egg Pasta",
            "strMeasure1": "250g",
            "strIngredient2": "Black Truffle",
            "strMeasure2": "10g",
            "strIngredient3": "",
            "strMeasure3": ""
        }
        normalized = normalize_meal_record(raw_mock)
        self.assertEqual(normalized["id"], "99999")
        self.assertEqual(normalized["name"], "Truffle Tagliatelle")
        self.assertEqual(len(normalized["ingredients"]), 2)
        self.assertEqual(normalized["ingredients"][0]["name"], "Egg Pasta")
        self.assertEqual(normalized["ingredients"][0]["measure"], "250g")
        self.assertEqual(normalized["tags"], ["Pasta", "Vegetarian"])

    def test_search_and_fallback(self):
        results = search_recipes("Chicken")
        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)
        first = results[0]
        self.assertIn("name", first)
        self.assertIn("category", first)

    def test_ingredient_filter(self):
        results = filter_by_ingredient("garlic")
        self.assertIsInstance(results, list)


if __name__ == "__main__":
    unittest.main()
