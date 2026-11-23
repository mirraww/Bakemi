// Utilitas format + penyusun template pesan WhatsApp.

export const rupiah = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export const toMin = t => {
  const [a, b] = String(t).split(':').map(Number);
  return a * 60 + b;
};

const pad = n => String(n).padStart(2, '0');

// Date -> 'YYYY-MM-DD' (zona waktu lokal)
export const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 'YYYY-MM-DD' -> 'Jumat, 20 November 2026'
export function formatTanggal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// 'YYYY-MM-DDTHH:mm' (nilai datetime-local) -> 'Jumat, 20 November 2026, 10:00'
export function formatWaktu(local) {
  if (!local) return 'Belum dipilih';
  const [tgl, jam = ''] = String(local).split('T');
  return jam ? `${formatTanggal(tgl)}, ${jam.slice(0, 5)}` : formatTanggal(tgl);
}

// Menerima 0812-3456-7890 / +62 812 3456 7890 / 6281234567890 / 81234567890.
// Mengembalikan 62xxxxxxxxxx, atau null kalau tidak valid.
export function normalisasiHP(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('620')) d = '62' + d.slice(3);
  else if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^62\d{8,12}$/.test(d) ? d : null;
}

export function buatNomorPesanan(prefix = 'BK', now = new Date()) {
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${yy}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${rand}`;
}

// Rapikan teks bebas dari pelanggan (hilangkan baris baru agar format WA tidak rusak)
const rapikan = s => String(s || '').replace(/\s+/g, ' ').trim();

export function susunPesanOrder({ toko, order }) {
  const baris = order.items.map((it, i) => {
    let s = `${i + 1}. ${it.nama} x${it.qty} = ${rupiah(it.harga * it.qty)}`;
    if (it.catatan) s += `\n   _Catatan: ${rapikan(it.catatan)}_`;
    return s;
  }).join('\n');

  return [
    `Halo *${toko.nama}*, saya mau pesan 🙏`,
    '',
    `*No. Pesanan:* ${order.id}`,
    `*Nama:* ${rapikan(order.nama)}`,
    `*No. HP:* ${order.hp}`,
    `*Metode:* Ambil di toko (pickup)`,
    `*Waktu ambil:* ${formatWaktu(order.pickup)}` + (order.preOrder ? ' _(pre-order)_' : ''),
    '',
    '*Pesanan:*',
    baris,
    '',
    `*Total:* ${rupiah(order.total)}`,
    `*Catatan:* ${rapikan(order.catatan) || '-'}`,
    '',
    'Mohon konfirmasi ketersediaan & total ya. Saya akan bayar via QRIS / transfer setelah dikonfirmasi. Terima kasih!'
  ].join('\n');
}

export function susunPesanBayar({ toko, order, metode, pengirim, jumlah }) {
  return [
    `Halo *${toko.nama}*, saya sudah melakukan pembayaran 🙏`,
    '',
    `*No. Pesanan:* ${order.id}`,
    `*Atas Nama:* ${rapikan(pengirim)}`,
    `*Metode:* ${metode}`,
    `*Jumlah Dibayar:* ${rupiah(jumlah)}`,
    `*Total Pesanan:* ${rupiah(order.total)}`,
    '',
    'Bukti pembayaran saya lampirkan di chat ini. Mohon dicek ya, terima kasih!'
  ].join('\n');
}

export function urlWA(nomor, pesan) {
  let n = String(nomor || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return `https://wa.me/${n}?text=${encodeURIComponent(pesan)}`;
}

// Dibuka lewat <a target="_blank"> yang diklik langsung dari event pengguna,
// supaya tidak diblokir pop-up blocker.
export function bukaWA(nomor, pesan) {
  const a = document.createElement('a');
  a.href = urlWA(nomor, pesan);
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}
