import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'dist');
const apiUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!apiUrl || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters.');
}
const signingSecret = jwtSecret || 'local-development-secret-change-this-value';

async function rest(resource, { method = 'GET', params, body, prefer = '' } = {}) {
  const url = new URL(`${apiUrl}/rest/v1/${resource}`);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    console.error('Supabase request failed:', response.status, data?.message || data);
    const error = new Error(data?.message || 'Database request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function rpc(name, body) {
  return rest(`rpc/${name}`, { method: 'POST', body });
}
async function audit(action, entity, entity_id, detail = '', user_id = null) {
  await rest('audit_logs', { method: 'POST', body: { action, entity, entity_id, detail, user_id } });
}
function auth(req, res, next) {
  try {
    req.user = jwt.verify(String(req.headers.authorization || '').replace(/^Bearer /, ''), signingSecret);
    next();
  } catch { res.status(401).json({ error: 'Sign in to continue.' }); }
}
function role(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'You do not have access to this view.' });
}
function sendError(res, error, message = 'Something went wrong. Please try again.') {
  const dbMessage = String(error?.message || '');
  if (dbMessage.includes('NO_TABLE_AVAILABLE')) return res.status(409).json({ error: 'No table fits that party at this time. Try a different time or a smaller party.' });
  if (dbMessage.includes('INVALID_STATUS_TRANSITION')) return res.status(409).json({ error: 'Orders move one step at a time through the kitchen.' });
  if (dbMessage.includes('ORDER_NOT_FOUND')) return res.status(404).json({ error: 'Order not found.' });
  if (dbMessage.includes('MENU_ITEM_NOT_FOUND')) return res.status(400).json({ error: 'A selected menu item is no longer available.' });
  if (dbMessage.includes('INVALID_TABLE')) return res.status(400).json({ error: 'Choose a valid table.' });
  console.error(error);
  return res.status(error?.status >= 400 && error.status < 500 ? error.status : 500).json({ error: message });
}

app.use(express.json({ limit: '100kb' }));
app.get('/api/health', async (_req, res) => {
  try { await rest('tables', { params: { select: 'id', limit: '1' } }); res.json({ ok: true, database: 'supabase' }); }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const users = await rest('users', { params: { select: 'id,name,email,password_hash,role', email: `eq.${email}`, limit: '1' } });
    const user = users[0];
    if (!user || !await bcrypt.compare(String(req.body?.password || ''), user.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await audit('sign_in', 'user', user.id, user.role, user.id);
    res.json({ token: jwt.sign({ id: user.id, name: user.name, role: user.role }, signingSecret, { expiresIn: '12h' }), user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) { sendError(res, error); }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role: staffRole, invite_code } = req.body || {};
  if (!process.env.STAFF_INVITE_CODE || invite_code !== process.env.STAFF_INVITE_CODE) return res.status(403).json({ error: 'A valid staff invite code is required.' });
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || String(password || '').length < 8 || !['host', 'kitchen'].includes(staffRole)) return res.status(400).json({ error: 'Name, valid email, role, and a password of at least 8 characters are required.' });
  try {
    const [user] = await rest('users', { method: 'POST', prefer: 'return=representation', body: { name: name.trim(), email: email.toLowerCase().trim(), password_hash: await bcrypt.hash(password, 10), role: staffRole } });
    await audit('register', 'user', user.id, staffRole, user.id);
    const publicUser = { id: user.id, name: user.name, role: user.role };
    res.status(201).json({ token: jwt.sign(publicUser, signingSecret, { expiresIn: '12h' }), user: publicUser });
  } catch (error) {
    if (error?.status === 409) return res.status(409).json({ error: 'That email is already registered.' });
    sendError(res, error);
  }
});

app.get('/api/menu', async (_req, res) => {
  try { res.json(await rest('menu_items', { params: { select: '*', available: 'eq.true', order: 'category.asc,name.asc' } })); }
  catch (error) { sendError(res, error); }
});
app.get('/api/tables', async (_req, res) => {
  try { res.json(await rest('tables', { params: { select: 'id,label,capacity,state', order: 'label.asc' } })); }
  catch (error) { sendError(res, error); }
});
app.get('/api/reservations', auth, role('host'), async (_req, res) => {
  try {
    const rows = await rest('reservations', { params: { select: '*,tables(label)', order: 'reserved_at.desc', limit: '100' } });
    res.json(rows.map((row) => ({ ...row, table_label: row.tables?.label || null, tables: undefined })));
  } catch (error) { sendError(res, error); }
});
app.get('/api/reservations/:id', auth, role('host'), async (req, res) => {
  try {
    const rows = await rest('reservations', { params: { select: '*,tables(label,capacity)', id: `eq.${req.params.id}`, limit: '1' } });
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found.' });
    const row = rows[0];
    res.json({ ...row, table_label: row.tables?.label || null, table_capacity: row.tables?.capacity || null, tables: undefined });
  } catch (error) { sendError(res, error); }
});
app.post('/api/reservations', async (req, res) => {
  const { customer_name, email, phone, party_size, reserved_at, notes } = req.body || {};
  const size = Number(party_size), when = new Date(reserved_at);
  if (!customer_name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !Number.isInteger(size) || size < 1 || size > 12 || !reserved_at || Number.isNaN(when.valueOf()) || when < new Date(Date.now() - 60000)) return res.status(400).json({ error: 'Enter a name, valid email, party of 1–12, and a future reservation time.' });
  try {
    const result = await rpc('create_reservation', { p_customer_name: customer_name.trim(), p_email: email.toLowerCase().trim(), p_phone: phone || '', p_party_size: size, p_reserved_at: when.toISOString(), p_notes: notes || '' });
    res.status(201).json(result);
  } catch (error) { sendError(res, error); }
});
app.post('/api/reservations/:id/cancel', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter the email address used for this reservation.' });
  try {
    const found = await rest('reservations', { params: { select: 'id,status', id: `eq.${req.params.id}`, email: `eq.${email}`, limit: '1' } });
    if (!found.length) return res.status(404).json({ error: 'We could not find a reservation with that ID and email.' });
    if (found[0].status !== 'confirmed') return res.status(409).json({ error: `This reservation is already ${found[0].status}.` });
    await rest('reservations', { method: 'PATCH', params: { id: `eq.${req.params.id}`, email: `eq.${email}` }, body: { status: 'cancelled' } });
    await audit('cancel', 'reservation', req.params.id, 'customer cancellation');
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
});
app.patch('/api/reservations/:id', auth, role('host'), async (req, res) => {
  const status = req.body?.status;
  if (!['confirmed', 'seated', 'cancelled', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid reservation status.' });
  try {
    const rows = await rest('reservations', { method: 'PATCH', params: { id: `eq.${req.params.id}`, select: 'id' }, prefer: 'return=representation', body: { status } });
    if (!rows.length) return res.status(404).json({ error: 'Reservation not found.' });
    await audit('update', 'reservation', req.params.id, status, req.user.id);
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
});
app.delete('/api/reservations/:id', auth, role('host'), async (req, res) => {
  try {
    const rows = await rest('reservations', { method: 'PATCH', params: { id: `eq.${req.params.id}`, status: 'eq.confirmed', select: 'id' }, prefer: 'return=representation', body: { status: 'cancelled' } });
    if (!rows.length) return res.status(404).json({ error: 'Confirmed reservation not found.' });
    await audit('cancel', 'reservation', req.params.id, 'host cancellation', req.user.id);
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
});

function orderSummary(row) {
  const items = row.order_items || [];
  return { ...row, table_label: row.tables?.label || null, tables: undefined,
    items: items.map((item) => `${item.quantity}× ${item.item_name}`).join(' · '),
    total: items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0), order_items: undefined };
}
app.get('/api/orders', auth, role('host', 'kitchen'), async (_req, res) => {
  try {
    const rows = await rest('orders', { params: { select: '*,tables(label),order_items(quantity,item_name,unit_price)', order: 'created_at.desc' } });
    const rank = { new: 1, preparing: 2, ready: 3, served: 4 };
    res.json(rows.map(orderSummary).sort((a, b) => rank[a.status] - rank[b.status] || a.created_at.localeCompare(b.created_at)));
  } catch (error) { sendError(res, error); }
});
app.get('/api/orders/:id', auth, role('host', 'kitchen'), async (req, res) => {
  try {
    const rows = await rest('orders', { params: { select: '*,tables(label),order_items(id,menu_item_id,item_name,quantity,unit_price),kitchen_events(id,from_status,to_status,user_id,created_at,users(name))', id: `eq.${req.params.id}`, limit: '1' } });
    if (!rows.length) return res.status(404).json({ error: 'Order not found.' });
    const row = rows[0];
    row.items = (row.order_items || []).map((item) => ({ ...item, total: Number(item.quantity) * Number(item.unit_price) }));
    row.events = (row.kitchen_events || []).map((event) => ({ ...event, user_name: event.users?.name || null, users: undefined }));
    row.table_label = row.tables?.label || null;
    delete row.tables; delete row.order_items; delete row.kitchen_events;
    res.json(row);
  } catch (error) { sendError(res, error); }
});
app.post('/api/orders', auth, role('host'), async (req, res) => {
  const { table_id, guest_name, items, notes } = req.body || {};
  if (!guest_name?.trim() || !Array.isArray(items) || !items.length || items.some((item) => !Number.isInteger(Number(item.menu_item_id)) || !Number.isInteger(Number(item.quantity)) || item.quantity < 1 || item.quantity > 20)) return res.status(400).json({ error: 'Add a guest name and at least one valid menu item.' });
  try {
    const id = await rpc('create_order', { p_table_id: table_id, p_guest_name: guest_name.trim(), p_notes: notes || '', p_items: items, p_user_id: req.user.id });
    res.status(201).json({ id });
  } catch (error) { sendError(res, error); }
});
app.patch('/api/orders/:id/status', auth, role('host', 'kitchen'), async (req, res) => {
  const next = req.body?.status;
  if (!['new', 'preparing', 'ready', 'served'].includes(next)) return res.status(400).json({ error: 'Invalid kitchen status.' });
  try {
    await rpc('transition_order', { p_order_id: req.params.id, p_next_status: next, p_user_id: req.user.id });
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
});

app.get('/api/recipes', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80), ingredient = String(req.query.ingredient || '').trim().slice(0, 80), area = String(req.query.area || '').trim();
  if (area && area !== 'Indian') return res.status(400).json({ error: 'Unsupported cuisine filter.' });
  if ((q && ingredient) || (area && (q || ingredient))) return res.status(400).json({ error: 'Choose one recipe search filter at a time.' });
  if (!area && !q && !ingredient) return res.status(400).json({ error: 'Enter an ingredient or dish to search.' });
  const endpoint = area ? 'filter.php?a=Indian' : ingredient ? `filter.php?i=${encodeURIComponent(ingredient)}` : `search.php?s=${encodeURIComponent(q)}`;
  try {
    let response = await fetch(`https://www.themealdb.com/api/json/v1/1/${endpoint}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Recipe service error');
    let data = await response.json(), meals = data.meals || [];
    if (area && !meals.length) {
      response = await fetch('https://www.themealdb.com/api/json/v1/1/filter.php?a=India', { signal: AbortSignal.timeout(8000) });
      if (response.ok) meals = (await response.json()).meals || [];
    }
    res.json(meals.slice(0, 18).map((meal) => ({ id: meal.idMeal, name: meal.strMeal, category: meal.strCategory || '', area: meal.strArea || (area ? 'India' : ''), image: meal.strMealThumb, source: meal.strSource || meal.strYoutube || `https://www.themealdb.com/meal/${meal.idMeal}` })));
  } catch { res.status(502).json({ error: 'Recipe search is temporarily unavailable. Please try again.' }); }
});
app.get('/api/audit', auth, role('host'), async (_req, res) => {
  try {
    const rows = await rest('audit_logs', { params: { select: '*,users(name)', order: 'id.desc', limit: '30' } });
    res.json(rows.map((row) => ({ ...row, user_name: row.users?.name || null, users: undefined })));
  } catch (error) { sendError(res, error); }
});

app.use((error, _req, res, _next) => sendError(res, error));
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.listen(port, '0.0.0.0', () => console.log(`DineDesk hosted API listening on port ${port}`));

