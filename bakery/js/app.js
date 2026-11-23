import { cart } from './cart.js';
import {
  rupiah, toMin, formatTanggal, formatWaktu, normalisasiHP,
  buatNomorPesanan, susunPesanOrder, susunPesanBayar, bukaWA
} from './whatsapp.js';

/* ===================== Helper ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVG_NS = 'http://www.w3.org/2000/svg';

// Pembuat elemen DOM. Teks selalu lewat createTextNode (bukan innerHTML) -> aman dari XSS.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const setKids = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k != null && k !== false));

function icon(name, size = 22) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

const field = (label, control) =>
  h('label', { class: 'field' }, h('span', {}, label), control);

function store(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function persist(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* abaikan */ }
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

async function salin(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} disalin`);
  } catch {
    toast('Gagal menyalin, silakan salin manual.');
  }
}

const copyBtn = (text, label) =>
  h('button', { type: 'button', 'aria-label': `Salin ${label}`, onclick: () => salin(text, label) },
    icon('copy', 16), 'Salin');

const pad = n => String(n).padStart(2, '0');
const toLocalInput = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const atTime = (d, hhmm) => {
  const [hh, mm] = hhmm.split(':').map(Number);
  const x = new Date(d); x.setHours(hh, mm, 0, 0); return x;
};

/* ===================== State ===================== */
const ORDERS_KEY = 'bakery_orders';
const CUSTOMER_KEY = 'bakery_customer';
const MAX_ORDERS = 20;

let toko = null;
let kategori = [];
let produk = [];
let byId = new Map();
const state = { kategori: 'Semua', q: '' };

let current = null;      // nama sheet yang sedang terbuka
let returnFocus = null;

const cartLines = () =>
  cart.items
    .map(i => { const p = byId.get(i.id); return p ? { ...p, qty: i.qty, catatan: i.catatan } : null; })
    .filter(Boolean);
const cartTotal = () => cartLines().reduce((s, l) => s + l.harga * l.qty, 0);
const siapMenit = () => toko.siapMenit ?? 60;

// Pre-order: tanggal ambil paling cepat = hari ini + H terbesar dari item pre-order di keranjang
const leadDays = () => cartLines().filter(l => l.preOrder).reduce((m, l) => Math.max(m, Number(l.poHari) || 2), 0);

// Waktu ambil paling cepat yang disarankan (dipakai sebagai nilai awal & atribut min)
function minPickup() {
  const now = new Date();
  const lead = leadDays();
  if (lead > 0) return atTime(addDays(now, lead), toko.jamBuka.buka);
  let d = new Date(now.getTime() + siapMenit() * 60000);
  d.setSeconds(0, 0);
  if (d.getMinutes() % 5) d.setMinutes(d.getMinutes() + 5 - (d.getMinutes() % 5));
  const buka = atTime(d, toko.jamBuka.buka);
  const tutup = atTime(d, toko.jamBuka.tutup);
  if (d < buka) d = buka;
  else if (d > tutup) d = atTime(addDays(d, 1), toko.jamBuka.buka);
  return d;
}

/* ===================== Muat menu ===================== */
async function loadMenu() {
  const res = await fetch('data/menu.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  toko = data.toko;
  produk = (data.produk || []).filter(p => p && p.id && p.nama);
  kategori = data.kategori?.length ? data.kategori : [...new Set(produk.map(p => p.kategori))];
  byId = new Map(produk.map(p => [p.id, p]));
}

/* ===================== Info toko ===================== */
const isBuka = (now = new Date()) => {
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= toMin(toko.jamBuka.buka) && m < toMin(toko.jamBuka.tutup);
};

function updateStatus() {
  const buka = isBuka();
  const pill = $('#statusPill');
  pill.classList.toggle('closed', !buka);
  const t = $('#statusText');
  if (buka) setKids(t, 'Buka sekarang ', h('small', {}, `· tutup ${toko.jamBuka.tutup}`));
  else setKids(t, 'Tutup ', h('small', {}, `· buka ${toko.jamBuka.buka}`));
}

function renderToko() {
  document.title = `${toko.nama} — Menu & Pesan`;
  $('#brandName').textContent = toko.merek || toko.nama;
  $('#brandSub').textContent = toko.jenis || 'BAKERY';
  $('#storeName').textContent = toko.nama;
  $$('[data-store-name]').forEach(e => { e.textContent = toko.nama; });
  $$('[data-brand]').forEach(e => { e.textContent = toko.nama.toUpperCase(); });

  const addr = $('#storeAddr');
  if (toko.maps) setKids(addr, h('a', { href: toko.maps, target: '_blank', rel: 'noopener' }, toko.alamat));
  else addr.textContent = toko.alamat || '';
  $('#storeHours').textContent = toko.jamLabel || `Setiap hari, ${toko.jamBuka.buka}–${toko.jamBuka.tutup}`;

  const pay = toko.pembayaran || {};
  setKids($('#payChips'),
    pay.qris ? h('span', {}, 'QRIS') : null,
    ...(pay.bank || []).map(b => h('span', {}, `Transfer ${b.bank}`)));

  updateStatus();
  setInterval(updateStatus, 60_000);
}

/* ===================== Kategori, pencarian, produk ===================== */
function renderChips() {
  setKids($('#chips'), ['Semua', ...kategori].map(k =>
    h('button', {
      type: 'button', 'data-kat': k, class: k === state.kategori ? 'active' : '',
      'aria-pressed': String(k === state.kategori),
      onclick: () => { state.kategori = k; syncChips(); renderProducts(); }
    }, k)));
}
const syncChips = () =>
  $$('#chips button').forEach(c => {
    const on = c.dataset.kat === state.kategori;
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', String(on));
  });

function filtered() {
  const q = state.q.trim().toLowerCase();
  return produk.filter(p =>
    (state.kategori === 'Semua' || p.kategori === state.kategori) &&
    (!q || `${p.nama} ${p.deskripsi || ''}`.toLowerCase().includes(q)));
}

function badgeOf(p) {
  if (p.tersedia === false) return { text: 'Habis', cls: 'muted' };
  if (p.preOrder) return { text: `Pre-order H-${Number(p.poHari) || 2}`, cls: 'purple' };
  if (p.label) return { text: p.label, cls: '' };
  return null;
}

function foodVisual(p, size = 'card') {
  const emoji = () => h('span', { class: 'food-emoji', 'aria-hidden': 'true' }, p.emoji || '🧁');
  if (!p.foto) return size === 'card' ? emoji() : (p.emoji || '🧁');
  return h('img', {
    src: p.foto, alt: p.nama, loading: 'lazy', width: 400, height: 300,
    onerror: ev => ev.target.remove()
  });
}

function card(p) {
  const habis = p.tersedia === false;
  const b = badgeOf(p);
  return h('article', { class: 'product-card' + (habis ? ' sold-out' : '') },
    h('div', { class: 'product-image', style: `background:${p.warna || '#EADFF8'}` },
      b ? h('span', { class: `badge ${b.cls}` }, b.text) : null,
      p.foto ? h('span', { class: 'food-emoji', 'aria-hidden': 'true' }, p.emoji || '🧁') : null,
      foodVisual(p)),
    h('div', { class: 'product-body' },
      h('h3', {}, p.nama),
      p.deskripsi ? h('p', {}, p.deskripsi) : null,
      h('div', { class: 'product-bottom' },
        h('strong', {}, rupiah(p.harga)),
        h('div', { class: 'card-ctl', 'data-id': p.id }))));
}

function stepper(p, q) {
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'data-act': 'dec', 'data-id': p.id, 'aria-label': `Kurangi ${p.nama}` }, icon('minus', 15)),
    h('b', { 'aria-label': `Jumlah ${q}` }, q),
    h('button', { type: 'button', 'data-act': 'inc', 'data-id': p.id, 'aria-label': `Tambah ${p.nama}` }, icon('plus', 15)));
}

function refreshControls() {
  $$('.card-ctl').forEach(el => {
    const p = byId.get(el.dataset.id);
    if (!p) return;
    const q = cart.qtyOf(p.id);
    if (p.tersedia === false) {
      setKids(el, h('button', { type: 'button', class: 'disabled', disabled: true }, 'Habis'));
    } else if (q === 0) {
      setKids(el, h('button', {
        type: 'button', class: 'add-btn', 'data-act': 'add', 'data-id': p.id,
        'aria-label': `Tambah ${p.nama} ke keranjang`
      }, icon('plus', 16), ' Tambah'));
    } else {
      setKids(el, stepper(p, q));
    }
  });
}

function renderProducts() {
  const list = filtered();
  setKids($('#grid'), list.map(card));
  $('#menuStatus').textContent = list.length ? '' : 'Belum ada menu yang cocok. Coba kata kunci lain, ya.';
  refreshControls();
}

/* ===================== Keranjang ===================== */
function updateCartBar() {
  const n = cart.count();
  const badge = $('#cartBadge');
  badge.textContent = n;
  badge.hidden = n === 0;
  $('#barBadge').textContent = n;
  $('#barCount').textContent = `${n} item`;
  $('#barTotal').textContent = rupiah(cartTotal());
  $('#cartBar').hidden = !(n > 0 && !current);
}

function updateCartUI() {
  refreshControls();
  updateCartBar();
  if (current === 'cart') renderCart();
}

function notice(title, text, compact = false) {
  return h('div', { class: 'notice' + (compact ? ' compact' : '') },
    h('span', { 'aria-hidden': 'true' }, '⏳'), h('p', {}, h('b', {}, title), text));
}

function renderCart() {
  const lines = cartLines();
  const box = $('#cartContent');

  if (!lines.length) {
    setKids(box, h('div', { class: 'empty' },
      h('div', { 'aria-hidden': 'true' }, '🧺'),
      h('h3', {}, 'Keranjangmu masih kosong'),
      h('p', {}, 'Yuk, pilih roti dan kue favoritmu dulu.'),
      h('button', { type: 'button', class: 'primary-btn', 'data-close': '' }, 'Lihat menu')));
    return;
  }

  const lead = leadDays();
  setKids(box,
    lead > 0 ? notice('Ada produk pre-order', `Pesanan paling cepat dapat diambil ${lead} hari lagi.`) : null,
    h('div', { class: 'cart-list' }, lines.map(l =>
      h('div', { class: 'cart-item' },
        h('div', { class: 'cart-thumb', style: `background:${l.warna || '#EADFF8'}` },
          l.foto ? h('img', { src: l.foto, alt: '', onerror: ev => ev.target.remove() }) : (l.emoji || '🧁')),
        h('div', { class: 'cart-item-main' },
          h('div', { class: 'cart-item-title' },
            h('div', {}, h('h3', {}, l.nama), h('b', {}, rupiah(l.harga))),
            stepper(l, l.qty)),
          h('input', {
            class: 'item-note', type: 'text', maxlength: 100, 'data-note': l.id, value: l.catatan || '',
            placeholder: '+ Tambah catatan (opsional)', 'aria-label': `Catatan untuk ${l.nama}`
          }),
          h('button', { type: 'button', class: 'remove', 'data-act': 'del', 'data-id': l.id, 'aria-label': `Hapus ${l.nama}` }, 'Hapus'))))),
    h('div', { class: 'total-row' }, h('span', {}, 'Total'), h('strong', {}, rupiah(cartTotal()))),
    h('button', { type: 'button', class: 'primary-btn full', 'data-open': 'checkout' },
      'Lanjut ke Checkout ', icon('arrow', 19)));
}

/* ===================== Checkout ===================== */
const FIELDS = ['nama', 'hp', 'pickup'];

function renderCheckoutSummary() {
  const lines = cartLines();
  const n = lines.reduce((s, l) => s + l.qty, 0);
  setKids($('#coSummary'),
    h('div', {}, h('b', {}, 'Ringkasan pesanan'), h('span', {}, `${n} item`)),
    lines.map(l => h('p', {}, h('span', {}, `${l.qty}× ${l.nama}`), h('b', {}, rupiah(l.harga * l.qty)))),
    h('div', { class: 'summary-total' }, h('b', {}, 'Total'), h('strong', {}, rupiah(cartTotal()))));
  const lead = leadDays();
  setKids($('#coNotice'),
    lead > 0 ? notice(`Pre-order H+${lead}`, `Pilih tanggal ambil minimal ${lead} hari dari sekarang.`, true) : null);
}

function clearErrors(f) {
  FIELDS.forEach(n => {
    $(`#err-${n}`).textContent = '';
    f.elements[n].removeAttribute('aria-invalid');
  });
}

function prepareCheckout() {
  if (!cartLines().length) { toast('Keranjang masih kosong.'); return false; }
  const f = $('#checkoutForm');
  const cust = store(CUSTOMER_KEY, {});
  if (!f.elements.nama.value) f.elements.nama.value = cust.nama || '';
  if (!f.elements.hp.value) f.elements.hp.value = cust.hp || '';

  const min = minPickup();
  const minStr = toLocalInput(min);
  f.elements.pickup.min = minStr;
  f.elements.pickup.max = toLocalInput(addDays(new Date(), 60));
  if (!f.elements.pickup.value || f.elements.pickup.value < minStr) f.elements.pickup.value = minStr;

  $('#hint-pickup').textContent =
    `Jam ambil ${toko.jamBuka.buka}–${toko.jamBuka.tutup}. ` +
    (leadDays() > 0
      ? `Ada pre-order: paling cepat ${formatTanggal(minStr.slice(0, 10))}.`
      : `Hari ini minimal ${siapMenit()} menit dari sekarang.`);

  clearErrors(f);
  renderCheckoutSummary();
  return true;
}

function validateCheckout(f) {
  const errs = {};
  const nama = f.elements.nama.value.trim();
  if (nama.length < 2) errs.nama = 'Nama wajib diisi';
  if (!normalisasiHP(f.elements.hp.value)) errs.hp = 'Masukkan nomor HP yang valid, mis. 081234567890';

  const val = f.elements.pickup.value;
  const dt = val ? new Date(val) : null;
  if (!val || Number.isNaN(dt?.getTime())) {
    errs.pickup = 'Pilih tanggal dan jam ambil';
  } else {
    const { buka, tutup } = toko.jamBuka;
    const m = dt.getHours() * 60 + dt.getMinutes();
    const lead = leadDays();
    if (m < toMin(buka) || m > toMin(tutup)) {
      errs.pickup = `Jam ambil hanya ${buka}–${tutup}`;
    } else if (lead > 0) {
      const earliest = atTime(addDays(new Date(), lead), '00:00');
      if (dt < earliest) errs.pickup = `Produk pre-order paling cepat diambil ${formatTanggal(toLocalInput(earliest).slice(0, 10))} (H+${lead})`;
    } else if (dt < new Date(Date.now() + siapMenit() * 60000 - 60000)) {
      errs.pickup = `Waktu ambil minimal ${siapMenit()} menit dari sekarang`;
    }
  }
  return { errs, nama };
}

function showErrors(f, errs) {
  let first = null;
  for (const n of FIELDS) {
    const input = f.elements[n];
    const msg = errs[n] || '';
    $(`#err-${n}`).textContent = msg;
    if (msg) { input.setAttribute('aria-invalid', 'true'); first ||= input; }
    else input.removeAttribute('aria-invalid');
  }
  first?.focus();
}

function onSubmitCheckout(e) {
  e.preventDefault();
  const f = e.target;
  const { errs, nama } = validateCheckout(f);
  showErrors(f, errs);
  if (Object.keys(errs).length) return;
  if (!navigator.onLine) { toast('Butuh internet untuk membuka WhatsApp.'); return; }

  const lines = cartLines();
  if (!lines.length) return;

  const hp = f.elements.hp.value.trim();
  const order = {
    id: buatNomorPesanan('MM'),
    nama,
    hp,
    pickup: f.elements.pickup.value,
    catatan: f.elements.catatan.value.trim(),
    items: lines.map(l => ({ id: l.id, nama: l.nama, harga: l.harga, qty: l.qty, catatan: l.catatan || '' })),
    total: cartTotal(),
    preOrder: lines.some(l => l.preOrder),
    dibuat: Date.now(),
    status: 'menunggu'
  };

  persist(CUSTOMER_KEY, { nama, hp });
  persist(ORDERS_KEY, [order, ...store(ORDERS_KEY, [])].slice(0, MAX_ORDERS));

  // Dipanggil langsung dari event submit (gesture pengguna) agar tidak diblokir browser.
  bukaWA(toko.wa, susunPesanOrder({ toko, order }));

  cart.clear();
  f.elements.catatan.value = '';
  showSuccess(order, true);
}

/* ===================== Sukses / pembayaran ===================== */
const pickupOf = o => o.pickup || (o.tanggal ? `${o.tanggal}T${o.jam || '00:00'}` : '');

function updateOrder(id, patch) {
  const list = store(ORDERS_KEY, []);
  const i = list.findIndex(o => o.id === id);
  if (i >= 0) { list[i] = { ...list[i], ...patch }; persist(ORDERS_KEY, list); }
}

function showSuccess(order, baru = false) {
  $('#eb-success').textContent = baru ? 'PESANAN BERHASIL' : 'DETAIL PESANAN';
  $('#t-success').textContent = baru ? 'Terima kasih!' : 'Pesanan';
  renderSuccess({ ...order, pickup: pickupOf(order) });
  openSheet('success');
}

function renderSuccess(order) {
  const pay = toko.pembayaran || {};
  const banks = pay.bank || [];
  const tabs = [];
  if (pay.qris) tabs.push('QRIS');
  if (banks.length) tabs.push('Transfer');
  if (!tabs.length) tabs.push('QRIS', 'Transfer');
  let metode = tabs[0];

  /* --- cara bayar --- */
  const zoom = pay.qris?.gambar
    ? h('div', { class: 'qris-zoom', hidden: true },
        h('img', { src: pay.qris.gambar, alt: 'Kode QRIS untuk pembayaran', onerror: ev => ev.target.closest('.qris-zoom').remove() }),
        h('a', { href: pay.qris.gambar, download: 'qris.png' }, 'Simpan gambar QRIS'))
    : null;
  const zoomBtn = h('button', {
    type: 'button', 'aria-expanded': 'false',
    onclick: ev => {
      const open = zoom.hidden;
      zoom.hidden = !open;
      ev.currentTarget.setAttribute('aria-expanded', String(open));
      ev.currentTarget.textContent = open ? 'Tutup' : 'Perbesar';
    }
  }, 'Perbesar');

  const payBox = h('div', { class: 'payment-box' },
    pay.qris
      ? h('div', { class: 'qris' },
          pay.qris.gambar
            ? h('div', { class: 'qr-thumb' }, h('img', { src: pay.qris.gambar, alt: '', onerror: ev => ev.target.remove() }))
            : null,
          h('div', {}, h('b', {}, 'QRIS'), h('p', {}, `Scan dengan aplikasi bank atau e-wallet · a.n. ${pay.qris.atasNama || toko.nama}`)),
          pay.qris.gambar ? [zoomBtn] : null)
      : null,
    zoom,
    banks.map(b => h('div', { class: 'bank-row' },
      h('div', {}, h('small', {}, `Transfer Bank ${b.bank}`), h('b', {}, b.noRek), h('span', {}, `a.n. ${b.atasNama}`)),
      copyBtn(b.noRek, `No. rekening ${b.bank}`))));

  /* --- konfirmasi pembayaran --- */
  const errEl = h('p', { class: 'err', role: 'alert' });
  const tabBtns = tabs.map(t => h('button', {
    type: 'button', class: t === metode ? 'active' : '', 'aria-pressed': String(t === metode),
    onclick: () => {
      metode = t;
      tabBtns.forEach(b => {
        const on = b.textContent === t;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
  }, t));
  const inPengirim = h('input', { name: 'pengirim', type: 'text', maxlength: 60, autocomplete: 'off', placeholder: 'Nama sesuai rekening' });
  const inJumlah = h('input', {
    name: 'jumlah', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    placeholder: order.total.toLocaleString('id-ID')
  });

  const confirm = h('form', {
    class: 'confirm-form', novalidate: true,
    onsubmit: ev => {
      ev.preventDefault();
      const digits = inJumlah.value.replace(/\D/g, '');
      const jumlah = digits ? parseInt(digits, 10) : order.total;
      if (!jumlah || jumlah <= 0) { errEl.textContent = 'Jumlah dibayar tidak valid.'; inJumlah.focus(); return; }
      errEl.textContent = '';
      if (!navigator.onLine) { toast('Butuh internet untuk membuka WhatsApp.'); return; }
      const pengirim = inPengirim.value.trim() || order.nama;
      const label = metode === 'Transfer' ? 'Transfer Bank' : 'QRIS';
      updateOrder(order.id, { status: 'bukti', metodeBayar: label, jumlahBayar: jumlah });
      bukaWA(toko.wa, susunPesanBayar({ toko, order, metode: label, pengirim, jumlah }));
      toast('WhatsApp dibuka. Jangan lupa lampirkan foto bukti bayar.');
    }
  },
    h('h3', {}, 'Konfirmasi pembayaran'),
    h('div', { class: 'method-tabs' }, tabBtns),
    field('Nama pengirim', inPengirim),
    field('Jumlah dibayar', inJumlah),
    errEl,
    h('div', { class: 'upload-hint' },
      h('span', { 'aria-hidden': 'true' }, '📎'),
      h('p', {}, h('b', {}, 'Lampirkan foto bukti di WhatsApp'),
        'Setelah tombol ditekan, tambahkan foto bukti pada chat.')),
    h('button', { type: 'submit', class: 'wa-btn' }, h('span', { 'aria-hidden': 'true' }, '◉'), ' Kirim Bukti Pembayaran via WA'));

  setKids($('#successContent'),
    h('div', { class: 'success-hero' },
      h('div', { class: 'success-check' }, icon('check', 34)),
      h('h3', {}, 'Pesanan siap dikirim ke toko'),
      h('p', {}, 'Tekan Kirim di WhatsApp, lalu selesaikan pembayaran dan kirim buktinya.')),
    h('div', { class: 'receipt-card' },
      h('div', {}, h('span', {}, 'No. Pesanan'), h('b', {}, order.id), copyBtn(order.id, 'No. pesanan')),
      h('div', {}, h('span', {}, 'Waktu ambil'), h('b', {}, formatWaktu(order.pickup))),
      h('div', {}, h('span', {}, 'Total pembayaran'), h('strong', {}, rupiah(order.total)))),
    h('h3', { class: 'payment-title' }, 'Pilih cara pembayaran'),
    payBox,
    confirm,
    h('button', {
      type: 'button', class: 'resend-btn',
      onclick: () => {
        if (!navigator.onLine) { toast('Butuh internet untuk membuka WhatsApp.'); return; }
        bukaWA(toko.wa, susunPesanOrder({ toko, order }));
      }
    }, 'Kirim ulang pesanan ke WhatsApp'));
}

/* ===================== Riwayat pesanan ===================== */
function renderOrders() {
  const list = store(ORDERS_KEY, []);
  const box = $('#ordersContent');
  if (!list.length) {
    setKids(box, h('div', { class: 'empty' },
      h('div', { 'aria-hidden': 'true' }, '🧾'),
      h('h3', {}, 'Belum ada pesanan'),
      h('p', {}, 'Pesanan yang dibuat akan tersimpan di perangkat ini.'),
      h('button', { type: 'button', class: 'primary-btn', 'data-close': '' }, 'Mulai belanja')));
    return;
  }
  setKids(box,
    h('div', { class: 'history-list' }, list.map(o => {
      const sent = o.status === 'bukti';
      const n = (o.items || []).reduce((s, i) => s + (i.qty || 0), 0);
      return h('article', {},
        h('div', { class: 'history-top' },
          h('b', {}, o.id),
          h('span', { class: sent ? 'sent' : '' }, h('i'), sent ? 'Bukti dikirim' : 'Menunggu pembayaran')),
        h('p', {}, formatWaktu(pickupOf(o))),
        h('div', { class: 'history-bottom' }, h('span', {}, `${n} item`), h('strong', {}, rupiah(o.total))),
        h('button', { type: 'button', class: 'history-pay', onclick: () => showSuccess(o, false) }, 'Detail & bayar'));
    })),
    h('p', { class: 'history-note' }, 'Riwayat tersimpan di perangkat ini. Status akhir pesanan dikonfirmasi lewat WhatsApp.'));
}

/* ===================== Sheet (bottom sheet) ===================== */
const sheets = {
  cart: $('#sheet-cart'),
  checkout: $('#sheet-checkout'),
  success: $('#sheet-success'),
  orders: $('#sheet-orders')
};
const overlay = $('#overlay');

function openSheet(name) {
  if (!current) returnFocus = document.activeElement;
  for (const [k, el] of Object.entries(sheets)) el.hidden = k !== name;
  current = name;
  overlay.hidden = false;
  document.body.classList.add('no-scroll');
  updateCartBar();
  sheets[name].focus({ preventScroll: true });
}

function closeSheet() {
  if (!current) return;
  Object.values(sheets).forEach(el => { el.hidden = true; });
  current = null;
  overlay.hidden = true;
  document.body.classList.remove('no-scroll');
  updateCartBar();
  returnFocus?.focus?.({ preventScroll: true });
}

function open(name) {
  if (name === 'cart') renderCart();
  if (name === 'checkout' && !prepareCheckout()) return;
  if (name === 'orders') renderOrders();
  openSheet(name);
}

function trapFocus(e) {
  if (e.key !== 'Tab' || !current) return;
  const items = $$('button:not([disabled]), a[href], input, textarea, [tabindex]:not([tabindex="-1"])', sheets[current])
    .filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === sheets[current])) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ===================== PWA: install & service worker ===================== */
let deferredPrompt = null;

function setupInstall() {
  const btn = $('#btnInstall');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) { btn.hidden = true; return; }

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('appinstalled', () => { btn.hidden = true; deferredPrompt = null; });

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      $('#iosHint').hidden = false;
    } else {
      toast('Untuk menginstal, pilih “Tambahkan ke layar utama” dari menu browser Anda.');
    }
  });
  $('#iosHintClose').addEventListener('click', () => { $('#iosHint').hidden = true; });
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ });
}

/* ===================== Event ===================== */
function bindEvents() {
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { open(o.dataset.open); return; }
    if (e.target.closest('[data-close]')) closeSheet();
  });
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); trapFocus(e); });
  $('#brandBtn').addEventListener('click', () => { closeSheet(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  $('#search').addEventListener('input', e => { state.q = e.target.value; renderProducts(); });

  // Tombol tambah / kurang di kartu produk
  $('#grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const ctl = btn.closest('.card-ctl');
    const id = btn.dataset.id;
    if (btn.dataset.act === 'add' || btn.dataset.act === 'inc') cart.add(id);
    else if (btn.dataset.act === 'dec') cart.dec(id);
    ctl.querySelector(cart.qtyOf(id) > 0 ? '[data-act="inc"]' : '[data-act="add"]')?.focus();
  });

  // Isi keranjang
  const cartBox = $('#cartContent');
  cartBox.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === 'inc') cart.add(id);
    else if (act === 'dec') cart.dec(id);
    else if (act === 'del') cart.remove(id);
    if (act !== 'del') cartBox.querySelector(`[data-act="${act}"][data-id="${CSS.escape(id)}"]`)?.focus();
  });
  cartBox.addEventListener('input', e => {
    if (e.target.dataset.note) cart.setNote(e.target.dataset.note, e.target.value);
  });

  // Checkout
  const form = $('#checkoutForm');
  form.addEventListener('submit', onSubmitCheckout);
  form.addEventListener('input', e => {
    const n = e.target.name;
    const err = n && $(`#err-${n}`);
    if (err) { err.textContent = ''; e.target.removeAttribute('aria-invalid'); }
  });

  const offline = () => { $('#offlineBar').hidden = navigator.onLine; };
  window.addEventListener('online', offline);
  window.addEventListener('offline', offline);
  offline();
}

/* ===================== Start ===================== */
async function init() {
  setupInstall();
  bindEvents();
  registerSW();

  try {
    await loadMenu();
  } catch {
    const s = $('#menuStatus');
    setKids(s, 'Menu gagal dimuat. Periksa koneksi internet.',
      h('button', { type: 'button', class: 'btn-retry', onclick: () => location.reload() }, 'Coba lagi'));
    return;
  }

  cart.prune(id => byId.has(id) && byId.get(id).tersedia !== false);
  renderToko();
  renderChips();
  renderProducts();
  updateCartBar();
  cart.onChange(updateCartUI);
}

init();
