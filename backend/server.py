"""
DineDesk Production HTTP & REST Server
Multi-threaded HTTP Server delivering REST APIs and Single Page Application assets.
"""

from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.parse
import json
import os
import mimetypes
import time
from backend.config import FRONTEND_DIR
from backend.auth import verify_token
from backend.routes import ApiHandler
from backend.logger import info, warn, error, log


class DineDeskServerHandler(BaseHTTPRequestHandler):
    server_version = "DineDeskEngine/1.0"

    def log_message(self, format, *args):
        # Override default BaseHTTPRequestHandler logger to use our structured logger
        pass

    def send_json_response(self, status_code: int, data: dict):
        response_bytes = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            return verify_token(token)
        return None

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            return {}
        try:
            body_bytes = self.rfile.read(content_length)
            return json.loads(body_bytes.decode("utf-8"))
        except Exception as e:
            warn(f"Failed to parse JSON body: {e}")
            return {}

    def get_client_ip(self):
        x_forwarded_for = self.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return self.client_address[0] if self.client_address else "127.0.0.1"

    # ------------------ GET ROUTING ------------------
    def do_GET(self):
        start_time = time.time()
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)
        auth_user = self.get_auth_user()
        ip = self.get_client_ip()

        status_code = 200
        response_data = None

        try:
            if path == "/api/health":
                response_data = {"status": "ok", "service": "DineDesk Operations Console", "timestamp": time.time()}

            elif path == "/api/auth/me":
                status_code, response_data = ApiHandler.handle_auth_me(auth_user)

            elif path == "/api/tables":
                status_code, response_data = ApiHandler.get_tables()

            elif path == "/api/tables/availability":
                status_code, response_data = ApiHandler.check_availability(query_params)

            elif path == "/api/reservations":
                status_code, response_data = ApiHandler.get_reservations(query_params)

            elif path.startswith("/api/reservations/"):
                ref = path.split("/api/reservations/")[1]
                status_code, response_data = ApiHandler.lookup_reservation(ref)

            elif path == "/api/menu":
                status_code, response_data = ApiHandler.get_menu()

            elif path == "/api/orders":
                status_code, response_data = ApiHandler.get_orders(query_params)

            elif path == "/api/kitchen/board":
                status_code, response_data = ApiHandler.get_kitchen_board()

            elif path == "/api/external/recipes":
                status_code, response_data = ApiHandler.external_recipes(query_params)

            elif path == "/api/external/recipes/ingredient":
                status_code, response_data = ApiHandler.external_recipes_by_ingredient(query_params)

            elif path.startswith("/api/external/recipes/"):
                recipe_id = path.split("/api/external/recipes/")[1]
                status_code, response_data = ApiHandler.external_recipe_detail(recipe_id)

            elif path == "/api/waitlist":
                status_code, response_data = ApiHandler.get_waitlist()

            elif path == "/api/audit-logs":
                status_code, response_data = ApiHandler.get_audit_logs()

            elif path == "/api/system/logs":
                status_code, response_data = ApiHandler.get_system_logs()

            elif path == "/api/analytics/utilization":
                status_code, response_data = ApiHandler.get_analytics()

            elif path.startswith("/api/"):
                status_code = 404
                response_data = {"error": f"API endpoint not found: {path}"}

            else:
                # Serve static files from frontend directory
                self.serve_static(path)
                return

            self.send_json_response(status_code, response_data)

        except Exception as e:
            error(f"Internal Server Error on GET {path}: {e}")
            self.send_json_response(500, {"error": "Internal server error occurred"})
            status_code = 500

        finally:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            log("INFO", f"GET {path} -> {status_code} ({duration_ms}ms)")

    # ------------------ POST ROUTING ------------------
    def do_POST(self):
        start_time = time.time()
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self.read_json_body()
        auth_user = self.get_auth_user()
        ip = self.get_client_ip()

        status_code = 200
        response_data = None

        try:
            if path == "/api/auth/login":
                status_code, response_data = ApiHandler.handle_auth_login(body, ip)

            elif path == "/api/auth/register":
                status_code, response_data = ApiHandler.handle_auth_register(body, ip)

            elif path == "/api/auth/logout":
                status_code, response_data = 200, {"message": "Logged out successfully"}

            elif path == "/api/reservations":
                status_code, response_data = ApiHandler.create_reservation(body, ip)

            elif path.startswith("/api/reservations/") and path.endswith("/cancel"):
                parts = path.strip("/").split("/")
                code = parts[2]
                status_code, response_data = ApiHandler.cancel_reservation_by_code(code, ip)

            elif path == "/api/orders":
                status_code, response_data = ApiHandler.create_order(body, auth_user, ip)

            elif path == "/api/waitlist":
                status_code, response_data = ApiHandler.add_waitlist(body, ip)

            else:
                status_code = 404
                response_data = {"error": f"POST endpoint not found: {path}"}

            self.send_json_response(status_code, response_data)

        except Exception as e:
            error(f"Internal Server Error on POST {path}: {e}")
            self.send_json_response(500, {"error": "Internal server error occurred"})
            status_code = 500

        finally:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            log("INFO", f"POST {path} -> {status_code} ({duration_ms}ms)")

    # ------------------ PATCH ROUTING ------------------
    def do_PATCH(self):
        start_time = time.time()
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self.read_json_body()
        auth_user = self.get_auth_user()
        ip = self.get_client_ip()

        status_code = 200
        response_data = None

        try:
            if path.startswith("/api/tables/") and path.endswith("/status"):
                parts = path.strip("/").split("/")
                table_id = int(parts[2])
                status_code, response_data = ApiHandler.update_table_status(table_id, body, auth_user, ip)

            elif path.startswith("/api/reservations/") and path.endswith("/status"):
                parts = path.strip("/").split("/")
                res_id = int(parts[2])
                status_code, response_data = ApiHandler.update_reservation_status(res_id, body, auth_user, ip)

            elif path.startswith("/api/orders/") and path.endswith("/status"):
                parts = path.strip("/").split("/")
                order_id = int(parts[2])
                status_code, response_data = ApiHandler.update_order_status(order_id, body, auth_user, ip)

            elif path.startswith("/api/waitlist/") and path.endswith("/status"):
                parts = path.strip("/").split("/")
                wl_id = int(parts[2])
                status_code, response_data = ApiHandler.update_waitlist_status(wl_id, body, auth_user, ip)

            else:
                status_code = 404
                response_data = {"error": f"PATCH endpoint not found: {path}"}

            self.send_json_response(status_code, response_data)

        except Exception as e:
            error(f"Internal Server Error on PATCH {path}: {e}")
            self.send_json_response(500, {"error": "Internal server error occurred"})
            status_code = 500

        finally:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            log("INFO", f"PATCH {path} -> {status_code} ({duration_ms}ms)")

    # ------------------ STATIC ASSET SERVING ------------------
    def serve_static(self, path: str):
        if path == "/" or not path:
            filepath = FRONTEND_DIR / "index.html"
        else:
            rel_path = path.lstrip("/")
            filepath = FRONTEND_DIR / rel_path

        # If file does not exist, fallback to index.html for Single Page Application routing
        if not filepath.exists() or filepath.is_dir():
            filepath = FRONTEND_DIR / "index.html"

        mime_type, _ = mimetypes.guess_type(str(filepath))
        if not mime_type:
            mime_type = "application/octet-stream"
        if filepath.suffix == ".js":
            mime_type = "application/javascript"
        elif filepath.suffix == ".css":
            mime_type = "text/css"
        elif filepath.suffix == ".html":
            mime_type = "text/html; charset=utf-8"

        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            error(f"Error serving file {filepath}: {e}")
            self.send_response(404)
            self.end_headers()


def run_server(host: str = "0.0.0.0", port: int = 5000):
    server = ThreadingHTTPServer((host, port), DineDeskServerHandler)
    info(f"DineDesk REST & Web Server running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        info("Server shutdown requested.")
    finally:
        server.server_close()
