"""
DineDesk External API Integration: TheMealDB
Provides controlled server-side access to TheMealDB's free educational endpoints
with response normalization, ingredient extraction, and resilient caching.
"""

import urllib.request
import urllib.parse
import json
import ssl
from backend.config import THEMEALDB_BASE_URL
from backend.logger import info, warn, error

# Local curated fallback items if external service is unreachable or rate limited
FALLBACK_RECIPES = [
    {
        "id": "52772",
        "name": "Teriyaki Chicken Casserole",
        "category": "Chicken",
        "area": "Japanese",
        "instructions": "Preheat oven to 350°F. Cook rice. Mix soy sauce, brown sugar, ginger, garlic in small saucepan over medium heat until thickened. Stir chicken and vegetables together with sauce and bake for 30 minutes until bubbling.",
        "thumbnail": "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
        "tags": ["Meat", "Casserole"],
        "youtube_url": "https://www.youtube.com/watch?v=4aZr5hZXP_s",
        "source_url": "https://www.themealdb.com",
        "ingredients": [
            {"name": "soy sauce", "measure": "3/4 cup"},
            {"name": "water", "measure": "1/2 cup"},
            {"name": "brown sugar", "measure": "1/4 cup"},
            {"name": "ground ginger", "measure": "1/2 tsp"},
            {"name": "minced garlic", "measure": "1/2 tsp"},
            {"name": "cornstarch", "measure": "4 tbsp"},
            {"name": "chicken breasts", "measure": "2 (sliced)"},
            {"name": "stir-fry vegetables", "measure": "1 bag"},
            {"name": "brown rice", "measure": "3 cups cooked"}
        ]
    },
    {
        "id": "52855",
        "name": "Banana Pancakes",
        "category": "Dessert",
        "area": "American",
        "instructions": "In a blender, combine banana, eggs, baking powder, and pinch of salt. Blend until smooth. Heat nonstick skillet with butter over medium heat. Pour 1/4 cup batter and cook until bubbles form, flip and cook 1 more minute.",
        "thumbnail": "https://www.themealdb.com/images/media/meals/sywswr1511383814.jpg",
        "tags": ["Breakfast", "Desert"],
        "youtube_url": "https://www.youtube.com/watch?v=kSKtb2Sv-_U",
        "source_url": "https://www.themealdb.com",
        "ingredients": [
            {"name": "Banana", "measure": "1 large ripe"},
            {"name": "Eggs", "measure": "2 large"},
            {"name": "Baking Powder", "measure": "1/4 tsp"},
            {"name": "Butter", "measure": "1 tbsp"}
        ]
    },
    {
        "id": "52977",
        "name": "Corba (Red Lentil Soup)",
        "category": "Side",
        "area": "Turkish",
        "instructions": "Sauté chopped onion and carrots in olive oil until soft. Add red lentils, tomato paste, and vegetable broth. Simmer for 25 minutes until lentils are tender. Purée with immersion blender and serve with lemon wedges.",
        "thumbnail": "https://www.themealdb.com/images/media/meals/58oia91564916529.jpg",
        "tags": ["Soup", "Warm"],
        "youtube_url": "https://www.youtube.com/watch?v=VVnZd8A80Z8",
        "source_url": "https://www.themealdb.com",
        "ingredients": [
            {"name": "Lentils", "measure": "1 cup"},
            {"name": "Onion", "measure": "1 large"},
            {"name": "Carrots", "measure": "1 large"},
            {"name": "Tomato Paste", "measure": "1 tbsp"},
            {"name": "Vegetable Stock", "measure": "4 cups"}
        ]
    }
]


def normalize_meal_record(raw_meal: dict) -> dict:
    """Transform raw TheMealDB response into clean, standardized representation."""
    if not raw_meal:
        return {}

    # Extract dynamic ingredients and measures
    ingredients = []
    for i in range(1, 21):
        ing = raw_meal.get(f"strIngredient{i}")
        meas = raw_meal.get(f"strMeasure{i}")
        if ing and ing.strip():
            ingredients.append({
                "name": ing.strip(),
                "measure": (meas or "").strip()
            })

    tags = []
    if raw_meal.get("strTags"):
        tags = [t.strip() for t in raw_meal["strTags"].split(",") if t.strip()]

    return {
        "id": raw_meal.get("idMeal", ""),
        "name": raw_meal.get("strMeal", "Untitled Dish"),
        "category": raw_meal.get("strCategory", "General"),
        "area": raw_meal.get("strArea", "International"),
        "instructions": raw_meal.get("strInstructions", ""),
        "thumbnail": raw_meal.get("strMealThumb", ""),
        "tags": tags,
        "youtube_url": raw_meal.get("strYoutube", ""),
        "source_url": raw_meal.get("strSource", ""),
        "ingredients": ingredients
    }


def fetch_from_api(endpoint: str, query_params: dict):
    """Execute GET request against TheMealDB API with SSL relaxation for local dev environments."""
    url = f"{THEMEALDB_BASE_URL}/{endpoint}?" + urllib.parse.urlencode(query_params)
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "DineDesk-RestaurantOps/1.0", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
        if response.status == 200:
            return json.loads(response.read().decode("utf-8"))
    return None


def search_recipes(search_term: str = ""):
    """Search recipes by name or keyword using TheMealDB."""
    clean_term = (search_term or "").strip()
    try:
        data = fetch_from_api("search.php", {"s": clean_term})
        if data and data.get("meals"):
            normalized = [normalize_meal_record(m) for m in data["meals"]]
            info(f"TheMealDB returned {len(normalized)} recipes for '{clean_term}'.")
            return normalized
        elif not clean_term:
            return FALLBACK_RECIPES
        return []
    except Exception as e:
        warn(f"TheMealDB search failed ({e}); serving resilient fallback recipes.")
        # Filter fallbacks if query provided
        if clean_term:
            filtered = [
                r for r in FALLBACK_RECIPES
                if clean_term.lower() in r["name"].lower() or clean_term.lower() in r["category"].lower()
            ]
            return filtered
        return FALLBACK_RECIPES


def filter_by_ingredient(ingredient: str):
    """Search recipes by key ingredient."""
    clean_ing = (ingredient or "").strip()
    try:
        data = fetch_from_api("filter.php", {"i": clean_ing})
        if data and data.get("meals"):
            # filter.php returns light objects: idMeal, strMeal, strMealThumb
            meals = []
            for m in data["meals"][:10]:
                meals.append({
                    "id": m.get("idMeal"),
                    "name": m.get("strMeal"),
                    "thumbnail": m.get("strMealThumb"),
                    "category": "Ingredient Match",
                    "area": "Various",
                    "ingredients": [{"name": clean_ing, "measure": "Primary ingredient"}]
                })
            return meals
        return []
    except Exception as e:
        warn(f"TheMealDB filter by ingredient failed ({e}).")
        return []


def get_recipe_details(meal_id: str):
    """Retrieve complete recipe details for a specific meal ID."""
    try:
        data = fetch_from_api("lookup.php", {"i": meal_id})
        if data and data.get("meals") and len(data["meals"]) > 0:
            return normalize_meal_record(data["meals"][0])
        # Check fallbacks
        for f in FALLBACK_RECIPES:
            if f["id"] == str(meal_id):
                return f
        return None
    except Exception as e:
        warn(f"TheMealDB lookup failed ({e}).")
        for f in FALLBACK_RECIPES:
            if f["id"] == str(meal_id):
                return f
        return None
