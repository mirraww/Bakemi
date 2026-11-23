// Keranjang belanja — disimpan di localStorage.
// Yang disimpan hanya id, qty, dan catatan. Nama & harga selalu diambil dari menu.json,
// jadi kalau harga diubah, keranjang pelanggan otomatis ikut benar.

const KEY = 'bakery_cart';
const listeners = new Set();

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter(x => x && typeof x.id === 'string' && Number.isInteger(x.qty) && x.qty > 0)
      .map(x => ({
        id: x.id,
        qty: Math.min(x.qty, 99),
        catatan: typeof x.catatan === 'string' ? x.catatan : ''
      }));
  } catch {
    return [];
  }
}

let items = read();

function save(notify = true) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage penuh / diblokir */ }
  if (notify) listeners.forEach(fn => fn());
}

export const cart = {
  get items() { return items.map(i => ({ ...i })); },
  onChange(fn) { listeners.add(fn); },
  qtyOf(id) { return items.find(i => i.id === id)?.qty ?? 0; },
  count() { return items.reduce((s, i) => s + i.qty, 0); },

  add(id) {
    const it = items.find(i => i.id === id);
    if (it) it.qty = Math.min(it.qty + 1, 99);
    else items.push({ id, qty: 1, catatan: '' });
    save();
  },
  dec(id) {
    const it = items.find(i => i.id === id);
    if (!it) return;
    it.qty -= 1;
    if (it.qty <= 0) items = items.filter(i => i !== it);
    save();
  },
  remove(id) {
    items = items.filter(i => i.id !== id);
    save();
  },
  // Catatan disimpan tanpa memicu render ulang (supaya kolom ketik tidak kehilangan fokus)
  setNote(id, catatan) {
    const it = items.find(i => i.id === id);
    if (it) { it.catatan = String(catatan).slice(0, 100); save(false); }
  },
  clear() {
    items = [];
    save();
  },
  // Buang item yang sudah tidak ada / habis di menu
  prune(isValid) {
    const before = items.length;
    items = items.filter(i => isValid(i.id));
    if (items.length !== before) save();
  }
};
