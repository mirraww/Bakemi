const fs = require('fs');
const path = require('path');

const MENU_PATH = path.join(__dirname, '..', 'data', 'menu.json');

function readMenu() {
  const raw = fs.readFileSync(MENU_PATH, 'utf8');
  return JSON.parse(raw);
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = readMenu();
    const { id, kategori, q } = req.query || {};

    if (id) {
      const item = (data.produk || []).find(p => p.id === id);
      if (!item) return res.status(404).json({ error: 'Produk tidak ditemukan' });
      return res.status(200).json({ toko: data.toko, produk: item });
    }

    let produk = data.produk || [];
    if (kategori && kategori !== 'Semua') {
      produk = produk.filter(p => p.kategori === kategori);
    }
    if (q) {
      const term = String(q).trim().toLowerCase();
      produk = produk.filter(p =>
        `${p.nama} ${p.deskripsi || ''} ${p.kategori || ''}`.toLowerCase().includes(term)
      );
    }

    return res.status(200).json({
      toko: data.toko,
      kategori: data.kategori || [],
      produk,
      promoMingguan: data.promoMingguan || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Gagal memuat data menu', detail: err.message });
  }
};
