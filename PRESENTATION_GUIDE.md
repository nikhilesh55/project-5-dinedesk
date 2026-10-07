# DineDesk Presentation & Viva Defense Guide
## Project 05 | DineDesk: Restaurant Reservation & Kitchen Order Console

This guide provides a structured 5-minute presentation script and technical viva Q&A for demonstrating the project to your evaluator/sir.

---

## ⏱️ 5-Minute Demonstration Script

### Step 1: Introduction & Architecture (Minute 1)
- **What to say**:
  > *"Good morning, sir. For Project 05, I have developed **DineDesk**, a full-stack restaurant operations platform that synchronizes front-of-house reservation intake with a kitchen-facing order display console (KDS).*
  > *Rather than treating reservations and kitchen orders as isolated spreadsheets or paper slips, DineDesk implements an event-driven relational workflow where reservation states, table capacity rules, and kitchen order lanes update in real-time."*
- **What to show**:
  - Open homepage (`http://localhost:5000` or live Render URL).
  - Point out modern SaaS UI, category filters, and dietary badges.

---

### Step 2: Customer Table Reservation & Capacity Validation (Minute 2)
- **What to say**:
  > *"First, let's look at the customer booking flow. When a guest books a table, the system doesn't just record a row—it validates physical table capacity and availability against conflicting reservations for that exact date and service shift."*
- **What to show**:
  - Click **"Reserve Table"**.
  - Select 4 guests, pick today's date, time 18:30.
  - Click **"Check Table Availability"** to show instant server-side capacity validation.
  - Fill in a guest name (e.g., "Dr. John Watson"), email, and phone.
  - Click **"Complete Reservation"** to show the generated confirmation code modal (e.g. `DD-9482-XK`).
  - Switch to **"My Booking"**, paste the code, and demonstrate the customer lookup portal with live status.

---

### Step 3: Host / Receptionist Operations Console (Minute 3)
- **What to say**:
  > *"Now let's switch to the staff experience. Using our role-based authentication, I'll log in as the restaurant host, Elena Rostova."*
- **What to show**:
  - Click **"Demo: 🛎️ Host"** in the top navigation bar.
  - Show the **Visual Floor Plan**: 8 table cards (T-01 to T-08) color-coded by status (`Available`, `Reserved`, `Occupied`, `Cleaning`).
  - Show the **Guest Reservation Roster**: find the newly created reservation.
  - Click **"Seat & Check In"**: observe the reservation status move to `seated` and Table T-03 dynamically flip from `reserved` to `occupied`!
  - Point to the **Walk-in Waitlist Queue** below.

---

### Step 4: Kitchen Order Console (KDS) & Order Lifecycle (Minute 4)
- **What to say**:
  > *"Once guests are seated, orders are punched directly to the kitchen. Let's send an order to Table T-01 and switch to our Head Chef, Marco Bellini."*
- **What to show**:
  - On Table T-01 card, click **"Order"**.
  - Add items (e.g. 1x Truffle Arancini, 1x Dry-Aged Ribeye), add modifier *"Cook medium-rare"*, click **"Send to Kitchen Board"**.
  - Click **"Demo: 👨‍🍳 Kitchen"**.
  - Show the **4 Kanban Lanes**: `New Orders`, `Preparing`, `Ready for Pass`, `Delivered & Served`.
  - Notice the elapsed prep timer (`⏱️ 1m ago`).
  - Click **"Fire Ticket"** (moves ticket to `Preparing`).
  - Click **"Pass to Service"** (moves ticket to `Ready`).
  - Click the **"Print Ticket"** icon: show the authentic 80mm thermal Kitchen Order Ticket (KOT) with modifier notes!
  - Click **"Mark Served"** (moves ticket to `Served`).

---

### Step 5: External API (TheMealDB) & Backend Observability (Minute 5)
- **What to say**:
  > *"To meet the external API requirements of Project 05, we integrated **TheMealDB** educational API via a controlled backend proxy with response normalization and ingredient extraction.*
  > *Finally, our management console demonstrates full observability with real-time table utilization metrics, transactional audit logs, and sanitized live backend execution logs."*
- **What to show**:
  - Click **"Chef Recipes"**: search for *"Salmon"* or ingredient *"Garlic"*. Open modal to show full ingredient measurement table and YouTube video link.
  - Click **"Analytics & Logs"**: show Table Utilization Rate (e.g. `25%`), the **Business Audit Trail** table showing every state transition with client IP, and the **Live Backend Server Stream**!

---

## 🎓 Viva Q&A — Questions Your Sir Might Ask

### Q1: "How did you implement table capacity validation?"
**Answer**:
> *"When a booking request is made, the backend runs a SQL query against the `tables` table filtering for active tables where `capacity >= party_size` and `min_capacity <= party_size`. It then verifies through a subquery that no active reservation (`status IN ('confirmed', 'seated')`) exists for that specific table at that date and time slot. It assigns the best-fit table with the minimum sufficient capacity to prevent small parties from tying up large banquet tables."*

### Q2: "What database did you use, and how are relational constraints handled?"
**Answer**:
> *"We use SQLite3 with Write-Ahead Logging (`WAL` mode) and explicit foreign key constraint enforcement (`PRAGMA foreign_keys = ON;`). There are 8 core relational tables: `users`, `tables`, `reservations`, `menu_items`, `orders`, `order_items`, `kitchen_events`, and `audit_logs`, plus a `waitlist` table. Relationships like `order_items` cascading on `orders` deletion and `orders` linking to `tables` and `reservations` enforce ACID integrity."*

### Q3: "How is authentication handled?"
**Answer**:
> *"We implement HMAC-SHA256 cryptographically signed Bearer tokens with 24-hour expiration. Passwords are salted and hashed using SHA-256. Role-based access control enforces permissions between customers, hosts, kitchen staff, and managers."*

### Q4: "Where is TheMealDB called, and why didn't you call it directly from the browser?"
**Answer**:
> *"As required by the technical specification, all external API calls are routed through our backend service (`/api/external/recipes`). This prevents exposing client network traffic to third-party endpoints, enables server-side response normalization (converting raw `strIngredient1..20` into clean structured JSON arrays), and provides resilient local caching if the external API experiences latency."*

### Q5: "How is sensitive data protected in logs?"
**Answer**:
> *"Our backend logging utility (`backend/logger.py`) features an automatic recursive scrubber that inspects dictionary keys and redacts fields matching `password`, `token`, `secret`, `authorization`, or `credentials` before formatting to stdout or writing to the observability buffer."*
