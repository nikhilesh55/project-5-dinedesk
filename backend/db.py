"""
DineDesk Database Layer
Relational schema design, SQLite WAL-mode connection management, and realistic seed data.
Tables:
  1. users
  2. tables
  3. reservations
  4. menu_items
  5. orders
  6. order_items
  7. kitchen_events
  8. audit_logs
  + waitlist
"""

import sqlite3
import hashlib
import os
from datetime import datetime, timedelta
from backend.config import DB_PATH
from backend.logger import info, error


def get_db_connection():
    """Create a SQLite connection with row factories and foreign key support."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def hash_password(password: str) -> str:
    """Produce SHA-256 salted hash for user credentials."""
    salt = "dinedesk_salt_2026_ops"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def init_db():
    """Create all relational tables and indexes required by the technical specification."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('customer', 'host', 'kitchen', 'admin')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_number TEXT UNIQUE NOT NULL,
        capacity INTEGER NOT NULL,
        min_capacity INTEGER NOT NULL DEFAULT 1,
        location TEXT NOT NULL DEFAULT 'indoor' CHECK(location IN ('indoor', 'patio', 'bar', 'vip')),
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'occupied', 'cleaning')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. reservations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        confirmation_code TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        party_size INTEGER NOT NULL,
        reservation_date TEXT NOT NULL,
        reservation_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
        table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
        special_requests TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. menu_items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('appetizers', 'mains', 'desserts', 'beverages', 'specials')),
        description TEXT,
        price REAL NOT NULL,
        prep_time_minutes INTEGER DEFAULT 15,
        is_available INTEGER DEFAULT 1,
        image_url TEXT,
        dietary_tags TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. orders
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
        table_id INTEGER NOT NULL REFERENCES tables(id),
        status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'preparing', 'ready', 'served', 'cancelled')),
        total_amount REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 6. order_items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        notes TEXT,
        item_status TEXT NOT NULL DEFAULT 'pending' CHECK(item_status IN ('pending', 'cooking', 'done')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. kitchen_events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS kitchen_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        triggered_by_user_id INTEGER REFERENCES users(id),
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. audit_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. waitlist (stretch feature)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        party_size INTEGER NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'notified', 'seated', 'cancelled')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Performance indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_res_date_time ON reservations(reservation_date, reservation_time);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_res_code ON reservations(confirmation_code);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);")

    conn.commit()
    conn.close()
    info("Database initialized successfully with 8 core tables + waitlist.")


def seed_data():
    """Populate database with rich initial data if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users;")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return  # Already seeded

    info("Seeding initial database fixtures for DineDesk...")

    # Seed Users
    users_data = [
        ("Host Elena Rostova", "host@dinedesk.com", hash_password("HostPass123!"), "host"),
        ("Chef Marco Bellini", "kitchen@dinedesk.com", hash_password("KitchenPass123!"), "kitchen"),
        ("General Manager David Kim", "admin@dinedesk.com", hash_password("AdminPass123!"), "admin"),
        ("Sarah Jenkins", "sarah@example.com", hash_password("CustomerPass123!"), "customer"),
    ]
    cursor.executemany(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);",
        users_data
    )

    # Seed Restaurant Tables
    tables_data = [
        ("T-01", 2, 1, "indoor", "available"),
        ("T-02", 2, 1, "indoor", "occupied"),
        ("T-03", 4, 2, "indoor", "reserved"),
        ("T-04", 4, 2, "indoor", "available"),
        ("T-05", 4, 2, "patio", "available"),
        ("T-06", 6, 4, "patio", "available"),
        ("T-07", 8, 4, "vip", "available"),
        ("T-08", 2, 1, "bar", "available"),
    ]
    cursor.executemany(
        "INSERT INTO tables (table_number, capacity, min_capacity, location, status) VALUES (?, ?, ?, ?, ?);",
        tables_data
    )

    # Seed Menu Items
    menu_items = [
        # Appetizers
        ("Crispy Truffle Arancini", "appetizers", "Hand-rolled risotto balls with black truffle paste and melted mozzarella core.", 14.50, 10, 1, "https://images.unsplash.com/photo-1541529086526-db283c563270?w=600&q=80", "Vegetarian"),
        ("Yellowfin Tuna Tartare", "appetizers", "Fresh diced sashimi tuna, avocado mousse, ponzu reduction, and sesame wonton crisps.", 18.00, 8, 1, "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80", "Gluten-Free,Pescatarian"),
        ("Charred Burrata & Heirlooms", "appetizers", "Creamy Pugliese burrata, heirloom tomatoes, basil chlorophyll, balsamic pearls.", 16.00, 7, 1, "https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=600&q=80", "Vegetarian,Gluten-Free"),
        
        # Mains
        ("Dry-Aged Ribeye Steak (12oz)", "mains", "Prime Black Angus ribeye with rosemary-garlic butter, roasted shallots, and bone marrow jus.", 42.00, 20, 1, "https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=80", "Gluten-Free"),
        ("Pan-Seared Chilean Sea Bass", "mains", "Miso-glazed sea bass over wild shiitake mushroom risotto and baby bok choy.", 38.50, 18, 1, "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80", "Pescatarian,Gluten-Free"),
        ("Handmade Truffle Tagliolini", "mains", "Egg pasta tossed in cultured French butter, 24-month Parmigiano-Reggiano, freshly shaved Norcia truffle.", 29.00, 14, 1, "https://images.unsplash.com/photo-1621996346565-e3d5d6281691?w=600&q=80", "Vegetarian"),
        ("Wild Mushroom & Butternut Ravioli", "mains", "Sage brown butter, toasted pine nuts, crumbled goat cheese, and crispy sage.", 26.00, 15, 1, "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&q=80", "Vegetarian"),

        # Specials
        ("Wood-Fired Tomahawk Feast", "specials", "38oz dry-aged Tomahawk with chimichurri, truffle fries, and grilled asparagus (serves 2-3).", 95.00, 30, 1, "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80", "Chef Special"),
        ("Saffron Lobster Risotto", "specials", "Acquerello carnaroli rice, poached Maine lobster tail, Spanish saffron broth.", 45.00, 22, 1, "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80", "Chef Special,Pescatarian"),

        # Desserts
        ("Classic Espresso Tiramisu", "desserts", "Mascarpone sabayon, savoiardi dipped in Illy espresso, Valrhona cocoa dust.", 11.50, 5, 1, "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&q=80", "Vegetarian"),
        ("Molten Dark Chocolate Soufflé", "desserts", "70% Guanaja chocolate lava, Tahitian vanilla bean gelato, candied hazelnut.", 13.00, 12, 1, "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80", "Vegetarian"),

        # Beverages
        ("Smoked Rosemary Old Fashioned", "beverages", "High-rye bourbon, Angostura bitters, Demerara, charred rosemary smoke dome.", 16.00, 4, 1, "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80", "Cocktail"),
        ("Artisan Sparkling Yuzu Cooler", "beverages", "Cold-pressed Japanese yuzu, elderflower tonic, mint sprig, cucumber ribbon.", 9.00, 3, 1, "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80", "Mocktail,Non-Alcoholic"),
    ]
    cursor.executemany(
        """INSERT INTO menu_items (name, category, description, price, prep_time_minutes, is_available, image_url, dietary_tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);""",
        menu_items
    )

    # Date calculations
    today_str = datetime.now().strftime("%Y-%m-%d")
    tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    # Seed Sample Reservations
    reservations_data = [
        ("DD-9482-XK", "Michael Scott", "michael@dundermifflin.com", "+1-555-0192", 2, today_str, "18:00", "seated", 2, "Window seating preferred, celebrating promotion."),
        ("DD-3104-AB", "Clara Oswald", "clara@tardis.org", "+1-555-0144", 4, today_str, "19:30", "confirmed", 3, "Allergies: strictly peanut-free table please."),
        ("DD-8219-QM", "Arthur Pendragon", "arthur@camelot.uk", "+1-555-0187", 6, tomorrow_str, "20:00", "confirmed", 6, "Quiet corner table requested for business dinner."),
    ]
    cursor.executemany(
        """INSERT INTO reservations (confirmation_code, customer_name, customer_email, customer_phone, party_size, reservation_date, reservation_time, status, table_id, special_requests)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""",
        reservations_data
    )

    # Seed Sample Orders for Kitchen Board demo
    orders_data = [
        ("ORD-1001", 1, 2, "preparing", 78.50, "Cook steak medium-rare. Extra napkins for table."),
        ("ORD-1002", 2, 3, "new", 54.00, "Appetizers first please, guest has arrived."),
        ("ORD-1003", None, 5, "ready", 42.00, "VIP table. Plated on hot ceramics."),
    ]
    cursor.executemany(
        """INSERT INTO orders (order_number, reservation_id, table_id, status, total_amount, notes)
           VALUES (?, ?, ?, ?, ?, ?);""",
        orders_data
    )

    # Seed Order Items
    order_items_data = [
        # Order 1 (T-02 Michael Scott - Preparing)
        (1, 4, 1, 42.00, "Medium-rare, extra rosemary butter", "cooking"),
        (1, 1, 1, 14.50, "Appetizer served hot", "done"),
        (1, 11, 1, 16.00, "Bourbon old fashioned", "done"),
        (1, 10, 1, 6.00, "Sides - artisan fries", "cooking"),

        # Order 2 (T-03 - New)
        (2, 6, 1, 29.00, "Extra parmigiano on side", "pending"),
        (2, 3, 1, 16.00, "Charred burrata", "pending"),
        (2, 12, 1, 9.00, "Yuzu cooler", "pending"),

        # Order 3 (T-05 - Ready)
        (3, 5, 1, 38.50, "Pan-seared sea bass", "done"),
        (3, 12, 1, 9.00, "Mocktail", "done"),
    ]
    cursor.executemany(
        """INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes, item_status)
           VALUES (?, ?, ?, ?, ?, ?);""",
        order_items_data
    )

    # Seed Kitchen Events
    kitchen_events_data = [
        (1, "new", "preparing", 2, "Kitchen order accepted by Chef Marco. Grill fired."),
        (2, None, "new", 1, "Order punched by Host Elena upon guest arrival."),
        (3, "preparing", "ready", 2, "Order completed and placed on pass under heat lamps."),
    ]
    cursor.executemany(
        """INSERT INTO kitchen_events (order_id, previous_status, new_status, triggered_by_user_id, note)
           VALUES (?, ?, ?, ?, ?);""",
        kitchen_events_data
    )

    # Seed Audit Logs
    audit_logs_data = [
        (3, "SYSTEM_STARTUP", "SYSTEM", "0", "DineDesk database schema and services verified.", "127.0.0.1"),
        (1, "RESERVATION_SEATED", "RESERVATION", "1", "Guest Michael Scott seated at Table T-02.", "127.0.0.1"),
        (2, "STATUS_TRANSITION", "ORDER", "ORD-1001", "Order status moved from new to preparing.", "127.0.0.1"),
    ]
    cursor.executemany(
        """INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
           VALUES (?, ?, ?, ?, ?, ?);""",
        audit_logs_data
    )

    # Seed Sample Waitlist
    waitlist_data = [
        ("Jessica Pearson", "+1-555-0921", 2, "Prefers outdoor patio, willing to wait 20 min.", "waiting"),
        ("Liam Neeson", "+1-555-0833", 4, "Indoor booth requested.", "waiting"),
    ]
    cursor.executemany(
        """INSERT INTO waitlist (customer_name, customer_phone, party_size, notes, status)
           VALUES (?, ?, ?, ?, ?);""",
        waitlist_data
    )

    conn.commit()
    conn.close()
    info("Initial data seeded successfully.")
