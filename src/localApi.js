// src/localApi.js
// Client for the local offline server (tables, orders, analytics, menu cache)

// Use the same hostname the page was loaded from (works for both
// localhost on the PC itself, and the PC's LAN IP when opened from a phone).
const LOCAL_API_URL = process.env.REACT_APP_LOCAL_API_URL || `http://${window.location.hostname}:3001`;

async function request(path, options = {}) {
  const res = await fetch(`${LOCAL_API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local API error (${res.status}): ${text}`);
  }
  return res.json();
}

// ---------- TABLES ----------
export const getTables = () => request('/api/tables');
export const createTable = (table_number, table_name) =>
  request('/api/tables', { method: 'POST', body: JSON.stringify({ table_number, table_name }) });
export const deleteTable = (tableId) =>
  request(`/api/tables/${tableId}`, { method: 'DELETE' });
export const unlockTable = (table_number) =>
  request('/api/tables/unlock', { method: 'POST', body: JSON.stringify({ table_number }) });

// ---------- MENU (cached copy) ----------
export const getLocalMenu = () => request('/api/menu');

// ---------- RESTAURANT INFO (cached) ----------
export const getRestaurantInfo = () => request('/api/restaurant-info');
export const syncRestaurantInfo = (restaurantData) =>
  request('/api/restaurant-info', { method: 'POST', body: JSON.stringify(restaurantData) });

// ---------- TABLE SESSIONS (locking) ----------
export const checkTableLocked = (table_number, session_id) =>
  request('/api/table-sessions/check', {
    method: 'POST',
    body: JSON.stringify({ table_number, session_id }),
  }).then(r => r.locked);

export const openTableSession = (table_number, session_id) =>
  request('/api/table-sessions', {
    method: 'POST',
    body: JSON.stringify({ table_number, session_id }),
  });

// ---------- ORDERS ----------
export const getOrders = (status) =>
  request(status && status !== 'all' ? `/api/orders?status=${status}` : '/api/orders');

export const createOrder = ({ table_number, session_id, notes, items }) =>
  request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ table_number, session_id, notes, items }),
  });

export const updateOrderStatus = (orderId, status) =>
  request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const deleteOrder = (orderId) =>
  request(`/api/orders/${orderId}`, { method: 'DELETE' });

// ---------- PRINT JOBS ----------
export const getPrintJob = (order_id, print_type) =>
  request(`/api/print-jobs?order_id=${order_id}&print_type=${print_type}`);

export const markPrintJobPrinted = (order_id, print_type) =>
  request('/api/print-jobs', {
    method: 'POST',
    body: JSON.stringify({ order_id, print_type }),
  });

// ---------- ANALYTICS ----------
export const getDailyAnalytics = () => request('/api/analytics/daily');
export const getMonthlyAnalytics = () => request('/api/analytics/monthly');

// ---------- SYNC (call when internet is available) ----------
export const syncMenuToLocal = (categories, items) =>
  request('/api/sync-menu', {
    method: 'POST',
    body: JSON.stringify({ categories, items }),
  });

// ---------- NETWORK INFO (for QR codes) ----------
export const getNetworkInfo = () => request('/api/network-info');

// ---------- Connection check ----------
export const isLocalServerReachable = async () => {
  try {
    await getTables();
    return true;
  } catch {
    return false;
  }
};
