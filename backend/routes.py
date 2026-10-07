"""
DineDesk REST API Routes & Business Logic
Handles table capacity calculations, reservation lifecycle, kitchen order states,
audit trail enforcement, and external TheMealDB proxying.
"""

import json
import random
import string
from datetime import datetime, date, timezone
from backend.db import get_db_connection
from backend.auth import authenticate_user, register_user, verify_token
from backend.external_api import search_recipes, filter_by_ingredient, get_recipe_details
from backend.logger import info, warn, error, get_recent_logs
from backend.config import SERVICE_SLOTS, ORDER_STATUSES, TABLE_STATUSES, RESERVATION_STATUSES


def generate_confirmation_code() -> str:
    """Generate a readable confirmation code e.g. DD-8472-NW."""
    digits = ''.join(random.choices(string.digits, k=4))
    letters = ''.join(random.choices(string.ascii_uppercase, k=2))
    return f"DD-{digits}-{letters}"


def generate_order_number() -> str:
    """Generate sequential or random order number e.g. ORD-1082."""
    digits = ''.join(random.choices(string.digits, k=4))
    return f"ORD-{digits}"


def record_audit(user_id, action: str, entity_type: str, entity_id: str, details: str, ip: str = "127.0.0.1"):
    """Helper to insert structured entry into audit_logs table."""
    conn = get_db_connection()
    try:
        conn.execute(
            """INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
               VALUES (?, ?, ?, ?, ?, ?);""",
            (user_id, action, entity_type, str(entity_id), details, ip)
        )
        conn.commit()
    except Exception as e:
        error(f"Failed to record audit log: {e}")
    finally:
        conn.close()


def find_suitable_table(party_size: int, res_date: str, res_time: str, conn):
    """
    Table Capacity Validation Logic:
    1. Filter tables with capacity >= party_size and min_capacity <= party_size
    2. Check tables that do NOT already have an active ('confirmed' or 'seated') reservation
       for the requested date and time slot.
    3. Return best-fit table (closest capacity).
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM tables
        WHERE is_active = 1
          AND capacity >= ?
          AND min_capacity <= ?
        ORDER BY capacity ASC, id ASC;
    """, (party_size, party_size))
    candidates = cursor.fetchall()

    for table in candidates:
        cursor.execute("""
            SELECT id FROM reservations
            WHERE table_id = ?
              AND reservation_date = ?
              AND reservation_time = ?
              AND status IN ('confirmed', 'seated');
        """, (table["id"], res_date, res_time))
        conflict = cursor.fetchone()
        if not conflict:
            return table

    return None


# -------------------------------------------------------------
# Route Handler Class
# -------------------------------------------------------------
class ApiHandler:

    @staticmethod
    def handle_auth_login(body, ip):
        email = body.get("email", "").strip()
        password = body.get("password", "").strip()
        if not email or not password:
            return 400, {"error": "Email and password are required"}

        result = authenticate_user(email, password)
        if not result:
            record_audit(None, "LOGIN_FAILED", "USER", email, "Invalid credentials provided", ip)
            return 401, {"error": "Invalid email or password"}

        user = result["user"]
        record_audit(user["id"], "LOGIN_SUCCESS", "USER", str(user["id"]), f"User logged in ({user['role']})", ip)
        return 200, result

    @staticmethod
    def handle_auth_register(body, ip):
        name = body.get("name", "").strip()
        email = body.get("email", "").strip()
        password = body.get("password", "").strip()
        role = body.get("role", "customer")
        if not name or not email or not password:
            return 400, {"error": "Name, email, and password are required"}

        result = register_user(name, email, password, role)
        if "error" in result:
            return 400, result

        record_audit(result["user"]["id"], "REGISTER_SUCCESS", "USER", str(result["user"]["id"]), f"Registered role: {role}", ip)
        return 201, result

    @staticmethod
    def handle_auth_me(auth_user):
        if not auth_user:
            return 401, {"error": "Authentication token required"}
        return 200, {"user": auth_user}

    # ------------------ Tables ------------------
    @staticmethod
    def get_tables():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT t.*,
                (SELECT r.customer_name FROM reservations r 
                 WHERE r.table_id = t.id AND r.status IN ('confirmed', 'seated') 
                 ORDER BY r.reservation_date DESC, r.reservation_time ASC LIMIT 1) as current_guest,
                (SELECT r.party_size FROM reservations r 
                 WHERE r.table_id = t.id AND r.status IN ('confirmed', 'seated') 
                 ORDER BY r.reservation_date DESC, r.reservation_time ASC LIMIT 1) as current_party_size
            FROM tables t
            WHERE t.is_active = 1
            ORDER BY t.table_number ASC;
        """)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return 200, {"tables": rows}

    @staticmethod
    def check_availability(query_params):
        res_date = query_params.get("date", [datetime.now().strftime("%Y-%m-%d")])[0]
        res_time = query_params.get("time", ["18:00"])[0]
        try:
            party_size = int(query_params.get("party_size", ["2"])[0])
        except ValueError:
            return 400, {"error": "Invalid party_size"}

        conn = get_db_connection()
        suitable = find_suitable_table(party_size, res_date, res_time, conn)
        conn.close()

        if suitable:
            return 200, {
                "available": True,
                "table": dict(suitable),
                "message": f"Table {suitable['table_number']} ({suitable['location'].capitalize()}, seats {suitable['capacity']}) is available for {party_size} guests."
            }
        else:
            return 200, {
                "available": False,
                "table": None,
                "message": f"No tables currently match {party_size} guests at {res_time} on {res_date}. Please pick an adjacent slot or join the waitlist."
            }

    @staticmethod
    def update_table_status(table_id: int, body, auth_user, ip):
        status = body.get("status")
        if status not in TABLE_STATUSES:
            return 400, {"error": f"Invalid table status. Must be one of: {TABLE_STATUSES}"}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tables WHERE id = ?;", (table_id,))
        table = cursor.fetchone()
        if not table:
            conn.close()
            return 404, {"error": "Table not found"}

        cursor.execute("UPDATE tables SET status = ? WHERE id = ?;", (status, table_id))
        conn.commit()
        conn.close()

        user_id = auth_user["sub"] if auth_user else None
        record_audit(user_id, "TABLE_STATUS_UPDATE", "TABLE", str(table_id), f"Table {table['table_number']} status changed to {status}", ip)
        return 200, {"message": f"Table {table['table_number']} updated to {status}", "status": status}

    # ------------------ Reservations ------------------
    @staticmethod
    def create_reservation(body, ip):
        name = body.get("customer_name", "").strip()
        email = body.get("customer_email", "").strip()
        phone = body.get("customer_phone", "").strip()
        res_date = body.get("reservation_date", "").strip()
        res_time = body.get("reservation_time", "").strip()
        special_requests = body.get("special_requests", "").strip()

        try:
            party_size = int(body.get("party_size", 0))
        except (ValueError, TypeError):
            return 400, {"error": "Party size must be a positive integer"}

        if not name or not email or not phone or not res_date or not res_time:
            return 400, {"error": "All contact and reservation date/time fields are required"}

        if party_size < 1 or party_size > 20:
            return 400, {"error": "Party size must be between 1 and 20 guests"}

        # Validate date is not in the past
        try:
            parsed_date = datetime.strptime(res_date, "%Y-%m-%d").date()
            if parsed_date < date.today():
                return 400, {"error": "Reservation date cannot be in the past"}
        except ValueError:
            return 400, {"error": "Invalid date format. Use YYYY-MM-DD"}

        conn = get_db_connection()
        table = find_suitable_table(party_size, res_date, res_time, conn)
        if not table:
            conn.close()
            return 409, {
                "error": "Table capacity exceeded or no suitable tables available for this time slot.",
                "suggestion": "Try another time slot or add party to the DineDesk waitlist."
            }

        confirmation_code = generate_confirmation_code()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO reservations (confirmation_code, customer_name, customer_email, customer_phone, party_size, reservation_date, reservation_time, status, table_id, special_requests)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?);
        """, (confirmation_code, name, email, phone, party_size, res_date, res_time, table["id"], special_requests))
        res_id = cursor.lastrowid
        conn.commit()
        conn.close()

        record_audit(None, "RESERVATION_CREATE", "RESERVATION", str(res_id), f"Booking {confirmation_code} created for {name} ({party_size} guests) at Table {table['table_number']}", ip)
        info(f"Reservation confirmed: {confirmation_code} for {name} at Table {table['table_number']}.")

        return 201, {
            "message": "Reservation confirmed successfully!",
            "reservation": {
                "id": res_id,
                "confirmation_code": confirmation_code,
                "customer_name": name,
                "customer_email": email,
                "customer_phone": phone,
                "party_size": party_size,
                "reservation_date": res_date,
                "reservation_time": res_time,
                "status": "confirmed",
                "table_id": table["id"],
                "table_number": table["table_number"],
                "table_location": table["location"],
                "special_requests": special_requests,
            }
        }

    @staticmethod
    def get_reservations(query_params):
        date_filter = query_params.get("date", [None])[0]
        status_filter = query_params.get("status", [None])[0]
        search_filter = query_params.get("search", [None])[0]

        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT r.*, t.table_number, t.capacity as table_capacity, t.location as table_location
            FROM reservations r
            LEFT JOIN tables t ON r.table_id = t.id
            WHERE 1=1
        """
        params = []
        if date_filter:
            query += " AND r.reservation_date = ?"
            params.append(date_filter)
        if status_filter:
            query += " AND r.status = ?"
            params.append(status_filter)
        if search_filter:
            query += " AND (r.customer_name LIKE ? OR r.confirmation_code LIKE ? OR r.customer_email LIKE ?)"
            term = f"%{search_filter}%"
            params.extend([term, term, term])

        query += " ORDER BY r.reservation_date DESC, r.reservation_time ASC;"
        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return 200, {"reservations": rows}

    @staticmethod
    def lookup_reservation(code_or_id: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.*, t.table_number, t.capacity as table_capacity, t.location as table_location
            FROM reservations r
            LEFT JOIN tables t ON r.table_id = t.id
            WHERE r.confirmation_code = ? OR r.id = ?;
        """, (code_or_id.upper(), code_or_id))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return 404, {"error": "Reservation not found with given reference or ID"}
        return 200, {"reservation": dict(row)}

    @staticmethod
    def update_reservation_status(res_id: int, body, auth_user, ip):
        status = body.get("status")
        if status not in RESERVATION_STATUSES:
            return 400, {"error": f"Invalid reservation status. Allowed: {RESERVATION_STATUSES}"}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM reservations WHERE id = ?;", (res_id,))
        res = cursor.fetchone()
        if not res:
            conn.close()
            return 404, {"error": "Reservation not found"}

        cursor.execute("UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (status, res_id))

        # Side effects on Table state
        if status == "seated" and res["table_id"]:
            cursor.execute("UPDATE tables SET status = 'occupied' WHERE id = ?;", (res["table_id"],))
        elif status in ["completed", "cancelled", "no_show"] and res["table_id"]:
            cursor.execute("UPDATE tables SET status = 'available' WHERE id = ?;", (res["table_id"],))

        conn.commit()
        conn.close()

        user_id = auth_user["sub"] if auth_user else None
        record_audit(user_id, "RESERVATION_STATUS_UPDATE", "RESERVATION", str(res_id), f"Reservation {res['confirmation_code']} status changed to {status}", ip)
        return 200, {"message": f"Reservation updated to {status}", "status": status}

    @staticmethod
    def cancel_reservation_by_code(code: str, ip):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM reservations WHERE confirmation_code = ?;", (code.upper(),))
        res = cursor.fetchone()
        if not res:
            conn.close()
            return 404, {"error": "No booking found with this confirmation code"}

        if res["status"] in ["completed", "cancelled"]:
            conn.close()
            return 400, {"error": f"Reservation is already {res['status']}"}

        cursor.execute("UPDATE reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (res["id"],))
        if res["table_id"]:
            cursor.execute("UPDATE tables SET status = 'available' WHERE id = ?;", (res["table_id"],))

        conn.commit()
        conn.close()

        record_audit(None, "RESERVATION_CANCELLED_BY_CUSTOMER", "RESERVATION", str(res["id"]), f"Guest cancelled reservation {code.upper()}", ip)
        return 200, {"message": f"Reservation {code.upper()} has been successfully cancelled."}

    # ------------------ Menu ------------------
    @staticmethod
    def get_menu():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category ASC, price ASC;")
        items = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return 200, {"menu_items": items}

    # ------------------ Orders & Kitchen ------------------
    @staticmethod
    def get_orders(query_params):
        status_filter = query_params.get("status", [None])[0]
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT o.*, t.table_number, t.location as table_location,
                   r.customer_name, r.confirmation_code
            FROM orders o
            JOIN tables t ON o.table_id = t.id
            LEFT JOIN reservations r ON o.reservation_id = r.id
            WHERE 1=1
        """
        params = []
        if status_filter:
            query += " AND o.status = ?"
            params.append(status_filter)
        query += " ORDER BY o.created_at ASC;"

        cursor.execute(query, params)
        orders = [dict(r) for r in cursor.fetchall()]

        # Attach order items to each order
        for o in orders:
            cursor.execute("""
                SELECT oi.*, m.name as item_name, m.category, m.prep_time_minutes
                FROM order_items oi
                JOIN menu_items m ON oi.menu_item_id = m.id
                WHERE oi.order_id = ?;
            """, (o["id"],))
            o["items"] = [dict(i) for i in cursor.fetchall()]

        conn.close()
        return 200, {"orders": orders}

    @staticmethod
    def get_kitchen_board():
        """Retrieve orders categorized into Kanban lanes with timing analytics."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.*, t.table_number, t.location as table_location,
                   r.customer_name, r.party_size
            FROM orders o
            JOIN tables t ON o.table_id = t.id
            LEFT JOIN reservations r ON o.reservation_id = r.id
            WHERE o.status IN ('new', 'preparing', 'ready', 'served')
            ORDER BY o.created_at ASC;
        """)
        orders = [dict(r) for r in cursor.fetchall()]

        lanes = {"new": [], "preparing": [], "ready": [], "served": []}

        for o in orders:
            cursor.execute("""
                SELECT oi.*, m.name as item_name, m.prep_time_minutes
                FROM order_items oi
                JOIN menu_items m ON oi.menu_item_id = m.id
                WHERE oi.order_id = ?;
            """, (o["id"],))
            o["items"] = [dict(i) for i in cursor.fetchall()]

            # Calculate elapsed minutes
            try:
                created_dt = datetime.strptime(o["created_at"], "%Y-%m-%d %H:%M:%S")
                elapsed_mins = int((datetime.now(timezone.utc).replace(tzinfo=None) - created_dt).total_seconds() / 60)
            except Exception:
                elapsed_mins = 5
            o["elapsed_minutes"] = max(1, elapsed_mins)

            st = o["status"]
            if st in lanes:
                lanes[st].append(o)

        conn.close()
        return 200, {"lanes": lanes}

    @staticmethod
    def create_order(body, auth_user, ip):
        table_id = body.get("table_id")
        reservation_id = body.get("reservation_id")
        items = body.get("items", [])
        notes = body.get("notes", "")

        if not table_id:
            return 400, {"error": "Table ID is required to place an order"}

        if not items or len(items) == 0:
            return 400, {"error": "Order must contain at least one menu item"}

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check table exists
        cursor.execute("SELECT * FROM tables WHERE id = ?;", (table_id,))
        table = cursor.fetchone()
        if not table:
            conn.close()
            return 404, {"error": "Table not found"}

        # Calculate total and validate items
        total_amount = 0.0
        validated_items = []
        for it in items:
            menu_id = it.get("menu_item_id")
            qty = int(it.get("quantity", 1))
            item_notes = it.get("notes", "")

            cursor.execute("SELECT * FROM menu_items WHERE id = ? AND is_available = 1;", (menu_id,))
            menu_item = cursor.fetchone()
            if not menu_item:
                conn.close()
                return 400, {"error": f"Menu item {menu_id} is unavailable or does not exist"}

            subtotal = menu_item["price"] * qty
            total_amount += subtotal
            validated_items.append({
                "menu_item_id": menu_id,
                "name": menu_item["name"],
                "quantity": qty,
                "unit_price": menu_item["price"],
                "notes": item_notes
            })

        order_num = generate_order_number()
        cursor.execute("""
            INSERT INTO orders (order_number, reservation_id, table_id, status, total_amount, notes)
            VALUES (?, ?, ?, 'new', ?, ?);
        """, (order_num, reservation_id, table_id, round(total_amount, 2), notes))
        order_id = cursor.lastrowid

        # Insert order_items
        for v in validated_items:
            cursor.execute("""
                INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes, item_status)
                VALUES (?, ?, ?, ?, ?, 'pending');
            """, (order_id, v["menu_item_id"], v["quantity"], v["unit_price"], v["notes"]))

        # Mark table occupied if available
        cursor.execute("UPDATE tables SET status = 'occupied' WHERE id = ?;", (table_id,))

        # Kitchen event: initial creation
        user_id = auth_user["sub"] if auth_user else None
        cursor.execute("""
            INSERT INTO kitchen_events (order_id, previous_status, new_status, triggered_by_user_id, note)
            VALUES (?, NULL, 'new', ?, ?);
        """, (order_id, user_id, f"Order placed for Table {table['table_number']}"))

        conn.commit()
        conn.close()

        record_audit(user_id, "ORDER_CREATED", "ORDER", order_num, f"Order #{order_num} created for Table {table['table_number']} (${total_amount:.2f})", ip)
        info(f"Order {order_num} created for Table {table['table_number']} with {len(validated_items)} items.")

        return 201, {
            "message": "Order sent to kitchen console successfully!",
            "order": {
                "id": order_id,
                "order_number": order_num,
                "table_id": table_id,
                "table_number": table["table_number"],
                "status": "new",
                "total_amount": round(total_amount, 2),
                "items": validated_items,
                "notes": notes
            }
        }

    @staticmethod
    def update_order_status(order_id: int, body, auth_user, ip):
        new_status = body.get("status")
        note = body.get("note", "")

        if new_status not in ORDER_STATUSES:
            return 400, {"error": f"Invalid order status. Allowed: {ORDER_STATUSES}"}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE id = ?;", (order_id,))
        order = cursor.fetchone()
        if not order:
            conn.close()
            return 404, {"error": "Order not found"}

        prev_status = order["status"]
        cursor.execute("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (new_status, order_id))

        # Update order_items status
        if new_status == "preparing":
            cursor.execute("UPDATE order_items SET item_status = 'cooking' WHERE order_id = ?;", (order_id,))
        elif new_status in ["ready", "served"]:
            cursor.execute("UPDATE order_items SET item_status = 'done' WHERE order_id = ?;", (order_id,))

        user_id = auth_user["sub"] if auth_user else None
        cursor.execute("""
            INSERT INTO kitchen_events (order_id, previous_status, new_status, triggered_by_user_id, note)
            VALUES (?, ?, ?, ?, ?);
        """, (order_id, prev_status, new_status, user_id, note or f"Status shifted from {prev_status} to {new_status}"))

        conn.commit()
        conn.close()

        record_audit(user_id, "ORDER_STATUS_UPDATE", "ORDER", order["order_number"], f"Moved from {prev_status} -> {new_status}", ip)
        info(f"Kitchen Order {order['order_number']}: {prev_status} -> {new_status}")
        return 200, {"message": f"Order {order['order_number']} status updated to {new_status}", "status": new_status}

    # ------------------ External TheMealDB Proxy ------------------
    @staticmethod
    def external_recipes(query_params):
        search_term = query_params.get("search", [""])[0]
        results = search_recipes(search_term)
        return 200, {"recipes": results, "count": len(results), "source": "TheMealDB (Free Educational Tier)"}

    @staticmethod
    def external_recipes_by_ingredient(query_params):
        ingredient = query_params.get("ingredient", [""])[0]
        results = filter_by_ingredient(ingredient)
        return 200, {"recipes": results, "count": len(results), "ingredient": ingredient}

    @staticmethod
    def external_recipe_detail(recipe_id: str):
        details = get_recipe_details(recipe_id)
        if not details:
            return 404, {"error": "Recipe not found"}
        return 200, {"recipe": details}

    # ------------------ Waitlist (Stretch Feature) ------------------
    @staticmethod
    def get_waitlist():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM waitlist WHERE status IN ('waiting', 'notified') ORDER BY created_at ASC;")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return 200, {"waitlist": rows}

    @staticmethod
    def add_waitlist(body, ip):
        name = body.get("customer_name", "").strip()
        phone = body.get("customer_phone", "").strip()
        notes = body.get("notes", "").strip()
        try:
            party_size = int(body.get("party_size", 2))
        except ValueError:
            return 400, {"error": "Party size must be a number"}

        if not name or not phone:
            return 400, {"error": "Name and phone are required for waitlist"}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO waitlist (customer_name, customer_phone, party_size, notes, status)
            VALUES (?, ?, ?, ?, 'waiting');
        """, (name, phone, party_size, notes))
        conn.commit()
        wl_id = cursor.lastrowid
        conn.close()

        record_audit(None, "WAITLIST_ADD", "WAITLIST", str(wl_id), f"{name} ({party_size} guests) joined waitlist", ip)
        return 201, {"message": "Added to waitlist", "id": wl_id}

    @staticmethod
    def update_waitlist_status(wl_id: int, body, auth_user, ip):
        status = body.get("status")
        if status not in ["waiting", "notified", "seated", "cancelled"]:
            return 400, {"error": "Invalid waitlist status"}

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE waitlist SET status = ? WHERE id = ?;", (status, wl_id))
        conn.commit()
        conn.close()

        user_id = auth_user["sub"] if auth_user else None
        record_audit(user_id, "WAITLIST_STATUS_UPDATE", "WAITLIST", str(wl_id), f"Waitlist entry marked {status}", ip)
        return 200, {"message": f"Waitlist entry updated to {status}"}

    # ------------------ Observability, Audit Logs & Analytics ------------------
    @staticmethod
    def get_audit_logs():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.*, u.name as user_name, u.role as user_role
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 50;
        """)
        logs = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return 200, {"audit_logs": logs}

    @staticmethod
    def get_system_logs():
        """Retrieve recent server execution log buffer (sanitized)."""
        return 200, {"system_logs": get_recent_logs(60)}

    @staticmethod
    def get_analytics():
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM tables WHERE is_active = 1;")
        total_tables = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tables WHERE status = 'occupied';")
        occupied_tables = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM reservations WHERE reservation_date = date('now');")
        today_reservations = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM orders WHERE status != 'cancelled';")
        active_orders = cursor.fetchone()[0]

        cursor.execute("SELECT SUM(total_amount) FROM orders WHERE status = 'served';")
        served_revenue = cursor.fetchone()[0] or 0.0

        cursor.execute("""
            SELECT t.location, COUNT(r.id) as booking_count
            FROM tables t
            LEFT JOIN reservations r ON t.id = r.table_id
            GROUP BY t.location;
        """)
        location_stats = [dict(r) for r in cursor.fetchall()]

        conn.close()

        utilization_rate = round((occupied_tables / max(1, total_tables)) * 100, 1)

        return 200, {
            "total_tables": total_tables,
            "occupied_tables": occupied_tables,
            "utilization_rate": utilization_rate,
            "today_reservations": today_reservations,
            "active_orders": active_orders,
            "served_revenue": round(served_revenue, 2),
            "location_stats": location_stats,
            "status_summary": {
                "active_kitchen_lanes": ["new", "preparing", "ready"],
                "live_system_status": "Operational"
            }
        }
