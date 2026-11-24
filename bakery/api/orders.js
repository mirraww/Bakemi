const fs = require('fs');
const os = require('os');
const path = require('path');

const ORDERS_FILE = path.join(os.tmpdir(), 'bakemiii-orders.json');
let memoryOrders = [];

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
      if (Array.isArray(parsed)) memoryOrders = parsed;
    }
  } catch {
    // Gunakan memoryOrders jika filesystem tidak tersedia
  }
  return memoryOrders;
}

function saveOrders(list) {
  memoryOrders = list.slice(0, 50);
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(memoryOrders, null, 2), 'utf8');
  } catch {
    // Abaikan jika filesystem read-only
  }
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const orders = loadOrders();

  if (req.method === 'GET') {
    const id = req.query?.id;
    if (id) {
      const found = orders.find(o => o.id === id);
      if (!found) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
      return res.status(200).json({ order: found });
    }
    return res.status(200).json({ orders });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!body.id || !body.nama || !body.hp || !Array.isArray(body.items) || !body.items.length) {
      return res.status(400).json({ error: 'Data pesanan tidak lengkap' });
    }
    const order = {
      id: String(body.id),
      nama: String(body.nama),
      hp: String(body.hp),
      pickup: String(body.pickup || ''),
      catatan: String(body.catatan || ''),
      items: body.items,
      total: Number(body.total) || 0,
      preOrder: Boolean(body.preOrder),
      dibuat: Number(body.dibuat) || Date.now(),
      status: String(body.status || 'menunggu')
    };
    saveOrders([order, ...orders.filter(o => o.id !== order.id)]);
    return res.status(201).json({ ok: true, order });
  }

  if (req.method === 'PATCH') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!body.id) return res.status(400).json({ error: 'ID pesanan wajib diisi' });
    const idx = orders.findIndex(o => o.id === body.id);
    if (idx === -1) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    orders[idx] = {
      ...orders[idx],
      ...(body.status ? { status: String(body.status) } : {}),
      ...(body.metodeBayar ? { metodeBayar: String(body.metodeBayar) } : {}),
      ...(body.jumlahBayar != null ? { jumlahBayar: Number(body.jumlahBayar) } : {})
    };
    saveOrders(orders);
    return res.status(200).json({ ok: true, order: orders[idx] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
