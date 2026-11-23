[README.md](https://github.com/user-attachments/files/35258881/README.md)
# Manis Manja Bakery — Website Menu (PWA + WhatsApp)

Website katalog menu untuk toko roti & kue. Pelanggan memilih menu, mengisi jadwal ambil, lalu tombol
**Pesan via WhatsApp** membuka WhatsApp dengan **template pesanan yang sudah terisi otomatis**.
Pembayaran (QRIS / transfer bank) dan **bukti bayar** juga dikonfirmasi lewat WhatsApp.

Dibangun dengan **HTML, CSS, dan JavaScript murni** (tanpa framework, tanpa build, tanpa backend).
Tampilan mengikuti desain Figma Make *"Menu Bakery dan Pesanan WhatsApp"*.

## Fitur

- Katalog menu per kategori (Semua, Roti, Kue, Cake, Minuman) dengan pencarian
- Badge produk: Best Seller, Baru, Habis, dan Pre-order
- Keranjang dengan catatan per item, tersimpan di perangkat pelanggan
- Checkout **pickup saja** (ambil di toko) dengan validasi nama, nomor HP, dan waktu ambil
- **Pre-order**: tanggal ambil otomatis dibatasi minimal H+2 (atau H+3, sesuai produk)
- Template pesan WhatsApp otomatis + pratinjau di layar checkout
- Halaman pembayaran: QRIS (bisa diperbesar dan disimpan) dan nomor rekening (tombol salin)
- Form konfirmasi pembayaran dengan template WhatsApp tersendiri
- Riwayat pesanan di perangkat, dengan status "Menunggu pembayaran" / "Bukti dikirim"
- **PWA**: bisa di-install, menu tetap tampil saat offline
- Status buka/tutup toko dihitung otomatis dari jam buka
- Responsif (HP → desktop) dan memperhatikan aksesibilitas (target sentuh 44px, label ARIA, fokus terkunci di dalam dialog)

## Struktur Folder

```
bakery/
├── index.html          # Halaman tunggal (kerangka + bottom sheet)
├── manifest.json       # Pengaturan PWA (nama, warna, ikon)
├── sw.js               # Service worker (cache & offline)
├── css/
│   └── style.css       # Seluruh gaya (diterapkan dari desain Figma)
├── js/
│   ├── app.js          # Render menu, keranjang, checkout, pembayaran, riwayat, PWA
│   ├── cart.js         # Keranjang (localStorage)
│   └── whatsapp.js     # Format rupiah/tanggal, validasi HP, penyusun template WA
├── data/
│   └── menu.json       # Info toko + daftar produk  ← file yang paling sering Anda ubah
├── images/
│   └── qris.png        # GANTI dengan gambar QRIS toko Anda
└── icons/              # Ikon PWA (192, 512, maskable, apple-touch)
```

## Menjalankan di Komputer

Jangan membuka `index.html` dengan klik dua kali (`file://`). Modul JavaScript, `fetch`, dan service worker
membutuhkan server. Cukup jalankan server lokal sederhana:

```bash
cd bakery
python3 -m http.server 8080
```

Lalu buka **http://localhost:8080**. Alternatif: `npx serve` atau ekstensi *Live Server* di VS Code.

## Wajib Diganti Sebelum Dipakai

Semua data di bawah ini masih **contoh**. Ubah di `data/menu.json` (bagian `toko`):

| Field | Isi |
|---|---|
| `nama` | Nama lengkap bakery (dipakai di template WhatsApp) |
| `merek`, `jenis` | Nama di header ("Manis Manja") dan subjudul kecil ("BAKERY") |
| `wa` | **Nomor WhatsApp tujuan**, format `62812xxxxxxx` (tanpa `+`, tanpa `0` di depan) |
| `alamat`, `maps` | Alamat dan link Google Maps |
| `jamBuka` | `buka` dan `tutup` (juga menjadi batas jam ambil) |
| `jamLabel` | Teks jam buka di kartu "Toko Kami" |
| `siapMenit` | Minimal menit persiapan jika ambil hari ini (default 60) |
| `pembayaran.bank` | Daftar rekening (boleh lebih dari satu). Hapus bagian ini jika tidak memakai transfer |
| `pembayaran.qris` | Ganti file `images/qris.png` dengan gambar QRIS asli. Hapus bagian ini jika tidak memakai QRIS |

Lalu perbarui juga: `manifest.json` (nama aplikasi), `<title>` dan meta di `index.html`, serta ikon di `icons/` bila ingin logo sendiri.

## Mengelola Menu

Setiap produk di array `produk` pada `data/menu.json`:

```json
{
  "id": "p001",
  "nama": "Croissant Butter",
  "kategori": "Roti",
  "harga": 25000,
  "deskripsi": "Renyah berlapis, wangi butter Prancis",
  "foto": "images/croissant.webp",
  "emoji": "🥐",
  "warna": "#F8E4BE",
  "tersedia": true,
  "preOrder": false,
  "poHari": 2,
  "label": "Best Seller"
}
```

| Field | Keterangan |
|---|---|
| `id` | Wajib, **unik**, jangan diubah setelah dipakai (keranjang pelanggan menyimpan id ini) |
| `kategori` | Harus sama persis dengan salah satu isi array `kategori` di atasnya |
| `harga` | Angka rupiah, tanpa titik |
| `foto` | Opsional. Kosongkan untuk menampilkan `emoji` di atas latar `warna`. Disarankan WebP, lebar ±800px, di bawah 100 KB |
| `tersedia` | `false` → tampil "Habis" dan tidak bisa dipesan |
| `preOrder` + `poHari` | Contoh `true` dan `2` → tanggal ambil paling cepat H+2. Jika keranjang berisi beberapa item pre-order, dipakai H terbesar |
| `label` | Opsional: "Best Seller", "Baru", dan sebagainya |

**Menambah kategori:** tambahkan nama di array `kategori`, lalu pakai di produk.
**Mengubah harga/stok:** cukup edit `menu.json` dan unggah ulang. Tidak perlu menaikkan versi service worker.

## Alur Pemesanan

1. Pelanggan memilih menu, lalu mengisi catatan per item bila perlu.
2. Di **Checkout**: nama, nomor HP, tanggal & jam ambil, catatan.
3. Tombol **Pesan via WhatsApp** membuka `wa.me` dengan template di bawah. Pelanggan menekan **Kirim** di WhatsApp.
4. Layar sukses menampilkan nomor pesanan, total, QRIS, dan rekening.
5. Pemilik membalas dengan konfirmasi ketersediaan.
6. Setelah membayar, pelanggan mengisi **Konfirmasi pembayaran** → WhatsApp terbuka dengan template bukti bayar → pelanggan **melampirkan foto bukti transfer sendiri** (ikon 📎) lalu Kirim.

### Template Pesanan

```
Halo *Manis Manja Bakery*, saya mau pesan 🙏

*No. Pesanan:* MM-261123-337
*Nama:* Ayu Lestari
*No. HP:* 0812-3456-7890
*Metode:* Ambil di toko (pickup)
*Waktu ambil:* Selasa, 24 November 2026, 10:00

*Pesanan:*
1. Croissant Butter x2 = Rp 50.000
   _Catatan: tanpa kacang_
2. Brownies Fudge x1 = Rp 65.000

*Total:* Rp 115.000
*Catatan:* paper bag tambahan

Mohon konfirmasi ketersediaan & total ya. Saya akan bayar via QRIS / transfer setelah dikonfirmasi. Terima kasih!
```

### Template Konfirmasi Pembayaran

```
Halo *Manis Manja Bakery*, saya sudah melakukan pembayaran 🙏

*No. Pesanan:* MM-261123-337
*Atas Nama:* Ayu L
*Metode:* Transfer Bank
*Jumlah Dibayar:* Rp 115.000
*Total Pesanan:* Rp 115.000

Bukti pembayaran saya lampirkan di chat ini. Mohon dicek ya, terima kasih!
```

Teks template ada di `js/whatsapp.js` (fungsi `susunPesanOrder` dan `susunPesanBayar`) dan bebas Anda ubah.

## Mengubah Tampilan

Warna utama ada sebagai variabel di bagian atas `css/style.css`:

```css
:root {
  --lilac: #eadff8;   --purple: #7b5ea7;   --pink: #ffd6e6;
  --rose:  #b04a7a;   --cream:  #fff8f0;   --ink:  #3b2a4d;
  --green: #11803f;   /* khusus tombol WhatsApp */
}
```

Font **Fraunces** (judul) dan **Nunito** (isi) dimuat dari Google Fonts lewat `index.html`. Saat offline atau
gagal dimuat, otomatis memakai font sistem.

## Deploy (wajib HTTPS agar PWA bisa di-install)

Unggah seluruh isi folder `bakery/` ke hosting statis, misalnya **Netlify**, **Vercel**, **Cloudflare Pages**, atau **GitHub Pages**.
Tidak ada langkah build.

### Penting: versi service worker

Service worker menyimpan `index.html`, CSS, dan JS di perangkat pelanggan agar bisa offline.
**Setiap kali Anda mengubah `index.html`, `css/`, atau `js/`, naikkan `VERSION` di `sw.js`**
(mis. `bakery-v2` → `bakery-v3`). Jika tidak, pelanggan tetap melihat versi lama.
Perubahan di `data/menu.json` **tidak** memerlukan hal ini (diambil dari jaringan lebih dulu).

| File | Strategi cache |
|---|---|
| HTML, CSS, JS, ikon | Cache-first (cepat, bisa offline) |
| `data/menu.json` | Network-first, cadangan dari cache saat offline |
| Foto produk (`images/`) | Stale-while-revalidate |

## Install sebagai Aplikasi

- **Android / Chrome / desktop:** tombol **Install** di header, atau menu browser → *Install app*.
- **iPhone (Safari):** tekan **Bagikan** → **Tambah ke Layar Utama**. Tombol Install akan menampilkan petunjuk ini.

## Data yang Disimpan di Perangkat Pelanggan

Tersimpan di `localStorage` browser pelanggan, tidak dikirim ke server mana pun:

| Key | Isi |
|---|---|
| `bakery_cart` | Isi keranjang (hanya `id`, jumlah, catatan; harga selalu diambil dari `menu.json`) |
| `bakery_customer` | Nama dan nomor HP terakhir (agar tidak mengisi ulang) |
| `bakery_orders` | Riwayat maksimal 20 pesanan terakhir |

## Keterbatasan

- Link `wa.me` hanya mengisi **teks**. Pesan **tidak terkirim otomatis**, pelanggan tetap menekan **Kirim**.
- **Foto bukti transfer tidak bisa dilampirkan otomatis**; pelanggan melampirkannya sendiri di WhatsApp (petunjuknya sudah ada di layar).
- Total harga dihitung di sisi pelanggan sebagai tampilan. Karena tidak ada backend, **pemilik tetap memverifikasi pesanan, harga, dan pembayaran di chat**.
- Status pesanan ("Bukti dikirim") hanya tercatat di perangkat pelanggan. Tidak ada notifikasi atau dashboard admin.
- Riwayat pesanan tidak tersinkron antar perangkat.
- Untuk notifikasi otomatis, status pesanan, atau dashboard admin, dibutuhkan backend atau WhatsApp Business API.

## Pemecahan Masalah

| Masalah | Penyebab dan solusi |
|---|---|
| Halaman kosong / menu tidak muncul | Dibuka lewat `file://`. Jalankan lewat server lokal (lihat di atas) |
| Menu "gagal dimuat" | `data/menu.json` tidak valid (cek koma atau kurung) atau path salah. Periksa lewat jsonlint.com |
| WhatsApp tidak terbuka ke nomor yang benar | Format `wa` salah. Harus `62812…` tanpa `+`, spasi, atau `0` di depan |
| Perubahan kode tidak muncul di HP | Service worker masih memakai cache lama. Naikkan `VERSION` di `sw.js` lalu muat ulang dua kali |
| Tombol Install tidak muncul | Butuh HTTPS (kecuali `localhost`) dan belum ter-install. Di iPhone, pakai menu Bagikan |
| Produk tidak masuk kategori | Nama `kategori` produk tidak sama persis dengan isi array `kategori` |
| Keranjang pelanggan hilang item | `id` produk diubah atau dihapus dari `menu.json`; item itu otomatis dibuang |

## Teknologi

HTML5 · CSS3 (custom properties, grid, flexbox) · JavaScript ES Modules · Service Worker · Web App Manifest · `localStorage` · tautan `wa.me`.
Tidak ada dependensi dan tidak ada langkah build.
