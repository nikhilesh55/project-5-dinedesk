# DineDesk: Restaurant Reservation & Kitchen Order Console

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/frontend-React%2018%20%7C%20Tailwind%20CSS-61dafb.svg)](https://reactjs.org/)
[![Database](https://img.shields.io/badge/database-SQLite3%20%7C%20ACID%20WAL-003B57.svg)](https://sqlite.org/)
[![External API](https://img.shields.io/badge/external%20api-TheMealDB%20(Free%20Tier)-orange.svg)](https://www.themealdb.com/)
[![Render](https://img.shields.io/badge/deploy-Render%20Cloud-46E3B7.svg)](https://render.com/)
[![Live Status](https://img.shields.io/badge/status-LIVE%20ON%20RENDER-brightgreen.svg)](https://project-5-dinedesk.onrender.com)

**🌐 Live Production URL:** [https://project-5-dinedesk.onrender.com](https://project-5-dinedesk.onrender.com)

> **Project 05 | Industry Full-Stack Challenge · Food Service & Restaurant Operations**  
> Complete operational platform synchronizing front-of-house reservation intake, table capacity validation, and a live kitchen order display console (KDS).

---

## 🌟 Executive Summary & Problem Statement

Modern food service venues frequently suffer from fragmented operational workflows: reservation intake occurs through manual phones or disparate consumer apps, table turnover is managed with dry-erase boards, and kitchen orders are scribbled on paper slips.

**DineDesk** eliminates this fragmentation through a unified, browser-based operations platform:
1. **Front-of-House (Customer)**: Public dining showcase, real-time table capacity verification, instant reservation booking with cryptographically unique reference codes, and self-service cancellation.
2. **Host / Receptionist Console**: Interactive visual floor plan with live table status tracking (`Available`, `Reserved`, `Occupied`, `Cleaning`), one-click guest check-in/seating, and walk-in waitlist queue management.
3. **Kitchen Order Console (KDS)**: High-speed four-lane Kanban ticket board (`New` ➔ `Preparing` ➔ `Ready` ➔ `Served`) with real-time preparation timers, chef notes/modifiers, and printable Kitchen Order Tickets (KOT).
4. **Chef Recipe Explorer**: Live integration with **TheMealDB** educational API providing culinary reference, ingredient measurement extraction, and cooking videos.
5. **Observability & Analytics**: Daily table-utilization metrics, zone turnover charts, business audit trail, and live backend server log streaming.

---

## 🏛️ System Architecture

```
                               ┌────────────────────────────────────────────────┐
                               │           Browser / Client Application         │
                               │  (React 18 Single Page App · Tailwind CSS ·    │
                               │   Lucide Icons · Glassmorphic Modern UI)       │
                               └──────────────────────┬─────────────────────────┘
                                                      │ HTTP / REST (JSON)
                                                      ▼
                               ┌────────────────────────────────────────────────┐
                               │           DineDesk Backend REST Server         │
                               │      (Multi-Threaded Python 3 HTTP Server)     │
                               ├──────────────────────┬─────────────────────────┤
                               │ • Auth & RBAC Token  │ • Capacity Validator    │
                               │ • Order Lifecycle    │ • Sensitive Data Scrubber│
                               └──────────┬───────────┴───────────┬─────────────┘
                                          │                       │
                     ┌────────────────────┴─────┐   ┌─────────────┴─────────────────┐
                     │   SQLite Relational DB   │   │  External API: TheMealDB      │
                     │  (ACID WAL Mode Engine)  │   │  (Normalized Recipe Results)  │
                     └──────────────────────────┘   └───────────────────────────────┘
```

---

## 🗄️ Relational Database Design (8 Core Tables + Waitlist)

DineDesk implements a strict relational database schema enforced with foreign key constraints (`PRAGMA foreign_keys = ON;`) and write-ahead logging (`WAL` mode):

| Table Name | Primary Key | Foreign Keys / Relationships | Purpose & Key Business Rules |
| :--- | :--- | :--- | :--- |
| `users` | `id` | — | Role-based authentication (`host`, `kitchen`, `admin`, `customer`) with SHA-256 salted password hashing. |
| `tables` | `id` | — | Physical restaurant tables (T-01 to T-08) with capacity constraints, floor zone (`indoor`, `patio`, `vip`, `bar`), and live status (`available`, `reserved`, `occupied`, `cleaning`). |
| `reservations` | `id` | `table_id` ➔ `tables(id)` | Booking records with unique confirmation codes (e.g. `DD-9482-XK`), party size, date/slot, customer contact, and status lifecycle (`confirmed`, `seated`, `completed`, `cancelled`). |
| `menu_items` | `id` | — | Active culinary menu catalog categorized by appetizers, mains, specials, desserts, beverages with prices, prep times, and dietary tags. |
| `orders` | `id` | `table_id` ➔ `tables(id)`, `reservation_id` ➔ `reservations(id)` | Kitchen order tickets tracked through status states (`new`, `preparing`, `ready`, `served`, `cancelled`). |
| `order_items` | `id` | `order_id` ➔ `orders(id)` [ON DELETE CASCADE], `menu_item_id` ➔ `menu_items(id)` | Itemized line items with quantities, unit prices, chef preparation notes, and status (`pending`, `cooking`, `done`). |
| `kitchen_events` | `id` | `order_id` ➔ `orders(id)`, `triggered_by_user_id` ➔ `users(id)` | Chronological audit log of kitchen status advancements and prep timestamps. |
| `audit_logs` | `id` | `user_id` ➔ `users(id)` | System-wide immutable security and transactional audit trail with client IP addresses. |
| `waitlist` | `id` | — | Walk-in waitlist queue with party size, contact phone, and notifications (`waiting`, `notified`, `seated`). |

---

## 🔌 REST API Specification

### Authentication & Profiles
| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate staff credentials & issue HMAC token | Public |
| `POST` | `/api/auth/register` | Register new customer or staff member | Public |
| `GET` | `/api/auth/me` | Fetch active user profile from Bearer token | Authenticated |
| `POST` | `/api/auth/logout` | Sign out and invalidate local session | Authenticated |

### Floor Plan & Table Management
| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tables` | List all tables, floor zones, and active seated guests | Public / Staff |
| `GET` | `/api/tables/availability` | Validate table capacity for given date, slot & party | Public |
| `PATCH` | `/api/tables/:id/status` | Update table status (`available`, `reserved`, `occupied`, `cleaning`) | Host / Admin |

### Reservations Lifecycle
| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/reservations` | Create reservation with automatic table capacity assignment | Public |
| `GET` | `/api/reservations` | List reservations with date, status, and search filters | Host / Admin |
| `GET` | `/api/reservations/:ref` | Lookup reservation by confirmation code or ID | Public |
| `PATCH` | `/api/reservations/:id/status` | Update reservation status (`seated`, `completed`, `cancelled`) | Host / Admin |
| `POST` | `/api/reservations/:code/cancel` | Customer self-service cancellation by confirmation code | Public |

### Kitchen Orders & KDS Console
| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/orders` | List order tickets with line items and timestamps | Kitchen / Host / Admin |
| `POST` | `/api/orders` | Create new order ticket for a table with menu items & notes | Staff |
| `PATCH` | `/api/orders/:id/status` | Advance status (`new` ➔ `preparing` ➔ `ready` ➔ `served`) | Kitchen / Staff |
| `GET` | `/api/kitchen/board` | Retrieve orders organized into 4 Kanban lanes with elapsed timers | Kitchen / Staff |

### TheMealDB External Integration
| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/external/recipes` | Search recipes via TheMealDB with normalized response | Public / Staff |
| `GET` | `/api/external/recipes/ingredient` | Filter recipes by key ingredient (stretch feature) | Public / Staff |
| `GET` | `/api/external/recipes/:id` | Lookup full recipe instructions and measured ingredient list | Public / Staff |

### Observability & Management
| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/utilization` | Table occupancy rate %, active orders, and zone statistics | Staff / Admin |
| `GET` | `/api/audit-logs` | Transactional audit trail of all floor and kitchen actions | Admin / Host |
| `GET` | `/api/system/logs` | Real-time sanitized backend application server stream | Admin / Viva Demo |
| `GET` | `/api/health` | Service health status and timestamp | Cloud Monitor |

---

## 🚀 Local Quickstart & Execution

### Prerequisites
- Python 3.10+ (Python 3.13 tested)
- No external dependencies required! Uses Python standard library.

### Launch Application
```bash
# Clone the repository
git clone https://github.com/nikhilesh55/project-5-dinedesk.git
cd project-5-dinedesk

# Run the server directly
python3 app.py
# Or use the launcher script:
./run.sh
```

Open your browser at: **`http://localhost:5000`**

### Pre-Configured Demo Credentials
For easy demonstration during presentation / viva:
- 🛎️ **Host / Receptionist**: `host@dinedesk.com` / `HostPass123!`
- 👨‍🍳 **Kitchen Staff**: `kitchen@dinedesk.com` / `KitchenPass123!`
- 👔 **Restaurant Manager**: `admin@dinedesk.com` / `AdminPass123!`
*(The header also includes a 1-click Demo Switcher for instant role changing).*

---

## 🧪 Automated Testing Suite

Run the complete 17-test automated verification suite:
```bash
python3 -m unittest discover -s tests -v
```

**Test Coverage Areas:**
- `test_db.py`: Verifies all 8 mandatory relational tables, foreign keys, cascade deletes, and data integrity.
- `test_auth.py`: Cryptographic password hashing, HMAC bearer token validation, and RBAC enforcement.
- `test_capacity.py`: Real table capacity validation, party size boundaries, and reservation cancellation.
- `test_orders_kds.py`: Order line item validation and complete Kanban status transitions (`new` ➔ `preparing` ➔ `ready` ➔ `served`).
- `test_external_api.py`: TheMealDB proxying, measurement parsing, and resilient fallback caching.
- `test_api_server.py`: Full end-to-end HTTP integration tests verifying all REST endpoints over live TCP.

---

## ☁️ Render Cloud Deployment

DineDesk is pre-configured for automated deployment on **Render**:

1. **Repository**: `https://github.com/nikhilesh55/project-5-dinedesk`
2. **Runtime**: Python 3
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `python3 app.py`
5. **Port Binding**: Binds automatically to Render's dynamic `$PORT` environment variable and listens on `0.0.0.0`.
6. **Health Check Path**: `/api/health`
7. **Blueprint**: `render.yaml` included in root for zero-configuration 1-click deployment.

---

## 👨‍🏫 Evaluator / Viva Demo Walkthrough

1. **Front-of-House Booking Flow**:
   - Navigate to **"Reserve Table"**. Select 4 guests, pick date/time, click **"Check Table Availability"** to show instant capacity calculation.
   - Enter guest details, submit reservation, and show the generated reference code (e.g. `DD-9482-XK`).
2. **Customer Self-Service Portal**:
   - Navigate to **"My Booking"**, enter the reference code, and view the live booking card.
3. **Host Floor Management**:
   - Click **"Demo: 🛎️ Host"** in header. Observe Table T-03 marked as reserved.
   - Click **"Seat & Check In"** to transition reservation to `seated` and table to `occupied`.
4. **Kitchen Order Console (KDS)**:
   - Click **"Order"** on Table T-01. Punch items and chef notes.
   - Click **"Demo: 👨‍🍳 Kitchen"**. Observe ticket arrive in **New Orders** lane.
   - Move ticket: `Fire Ticket` (Preparing) ➔ `Pass to Service` (Ready) ➔ `Mark Served`.
   - Click **"Print Ticket"** icon to preview the 80mm Kitchen Order Ticket (KOT).
5. **TheMealDB Integration**:
   - Navigate to **"Chef Recipes"**. Search for `"Salmon"` or search by ingredient `"Garlic"`.
   - Click any card to show parsed ingredient measurements and cooking instructions.
6. **Observability & Logs**:
   - Navigate to **"Analytics & Logs"**. Show Table Utilization Gauge, the immutable Business Audit Trail, and the live Backend Server Stream!
