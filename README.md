# DineDesk

DineDesk is a responsive restaurant reservation and kitchen console. The React client talks to an Express REST API; SQLite persists staff accounts, tables, menu items, reservations, orders, order lines, kitchen events, and audit entries. The API proxies recipe discovery through TheMealDB's free educational endpoint.

## Run locally

Requires Node.js 22.13 or newer (uses the built-in `node:sqlite` module).

```sh
npm install
npm run dev
```

Open http://localhost:5173. The API listens on http://localhost:3001 and creates `server/data/dinedesk.sqlite` with sample tables, menu items, staff accounts, and a sample future reservation on first start.

Local development demo accounts (not created when `NODE_ENV=production` unless `ENABLE_DEMO_ACCOUNTS=true`):

| Role | Email | Password |
| --- | --- | --- |
| Host | host@dinedesk.demo | dine12345 |
| Kitchen | kitchen@dinedesk.demo | dine12345 |

Change the development JWT secret before deployment by setting `JWT_SECRET`. Set `STAFF_INVITE_CODE` to enable staff account registration; registration requests must include this invite code. Set `PORT` to override the API port. Do not use demo accounts or the development secret in a public deployment. The client defaults to same-origin `/api` requests. For local production preview, run `npm run build` and then `npm start`.

## Roles and workflows

- Guests can browse the restaurant menu and make a reservation. The server chooses the smallest suitable table and rejects conflicting bookings within a two-hour window.
- Hosts can sign in, review and update reservations, inspect table state, and create orders from menu items.
- Kitchen staff can review the kitchen board. Authenticated staff move orders one step at a time: `new → preparing → ready → served`.
- Recipe search is proxied by the backend to `https://www.themealdb.com/api/json/v1/1/search.php?s=...`. Only the free educational API is used; recipe records are suggestions and never the source of truth for restaurant menu or orders.
- Recipe Studio separates The Olive Room's five original house recipes from TheMealDB inspiration. House recipes include serving size, prep time, ingredient quantities, a signature touch, plating method, and suggested menu price.

## Database design

```text
users ──< reservations >── tables
  │                           │
  ├──< audit_logs             └──< orders ──< order_items >── menu_items
  └──< kitchen_events >── orders
```

SQLite schema and constraints are initialized in `server/index.js`. Foreign keys connect orders, items, tables, reservations, staff, events, and logs. State columns use `CHECK` constraints; order item quantities and prices are validated. Reservations only persist when an available table has capacity and no overlapping booking in the two-hour seating window.

## REST API

Authentication uses a signed 12-hour bearer token; passwords use bcrypt hashing. Management routes enforce roles on the server.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Sign in and receive a token |
| POST | `/api/auth/register` | Invite code required | Create a staff account |
| GET | `/api/menu` | Public | List active menu items |
| GET | `/api/tables` | Public | List table capacities and states |
| POST | `/api/reservations` | Public | Validate capacity and create a reservation |
| POST | `/api/reservations/:id/cancel` | Public (matching reservation email required) | Cancel a confirmed reservation |
| GET | `/api/reservations` | Host | List reservations |
| GET | `/api/reservations/:id` | Host | View reservation detail |
| PATCH | `/api/reservations/:id` | Host | Update reservation status |
| DELETE | `/api/reservations/:id` | Host | Cancel a confirmed reservation |
| GET | `/api/orders` | Host or kitchen | List orders and lines |
| GET | `/api/orders/:id` | Host or kitchen | View order detail and kitchen event history |
| POST | `/api/orders` | Host | Create an order with menu item lines |
| PATCH | `/api/orders/:id/status` | Host or kitchen | Advance the kitchen state |
| GET | `/api/recipes?q=...` | Public | Search normalized TheMealDB results |
| GET | `/api/audit` | Host | Read recent user actions |
| GET | `/api/health` | Public | API health check |

Errors return JSON `{ "error": "..." }` with a useful 4xx/5xx status. Important authentication, reservation, order, and status actions are persisted in `audit_logs`; transitions are recorded in `kitchen_events`.

## Deployment

The app serves the built React files and API from one Node process after `npm run build` and `npm start`. A Docker image and Compose file are included. Copy `.env.example` to `.env`, replace the JWT secret and staff invite code with unique random values, then run `docker compose up --build`. Compose keeps SQLite on a named volume at `server/data`; back up that volume. For a hosted single-instance service, mount persistent storage at `/app/server/data`, set the same environment variables in the host, and enable HTTPS. Render Free services do not support persistent disks, so do not deploy this SQLite setup there if reservation/order persistence across restarts is required. A managed PostgreSQL database is needed for a free hosted database or horizontal scaling; the PostgreSQL adapter is not implemented yet. Deployment URL: not deployed yet.

## Demo sample

1. Open the public menu, then make a reservation for a future date and party size.
2. Sign in as host to see the reservation and its assigned table.
3. Create an order with menu items; sign in as kitchen to move its ticket through all four lanes.
4. Search a dish in Recipe finder to see normalized TheMealDB inspiration.
