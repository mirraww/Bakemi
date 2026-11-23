# Website Menu Bakery (PWA + WhatsApp)

Katalog menu yang bisa di-install seperti aplikasi. Pelanggan memilih menu, mengisi data & jadwal ambil,
lalu WhatsApp terbuka dengan template pesanan yang sudah terisi. Konfirmasi pembayaran juga lewat WhatsApp.
Pickup saja, pembayaran QRIS / transfer bank, mendukung pre-order. Tanpa backend.

## Menjalankan di komputer

Jangan buka `index.html` dengan klik dua kali (file://) — modul JS, fetch, dan service worker butuh server.

```bash
cd bakery
python3 -m http.server 8080
# buka http://localhost:8080
```

## Yang WAJIB diganti di `data/menu.json`

| Field | Isi |
|---|---|
| `toko.nama` | Nama lengkap bakery (dipakai di template WhatsApp) |
| `toko.merek`, `toko.jenis` | Nama di header ("Manis Manja") dan subjudul kecil ("BAKERY") |
| `toko.jamLabel` | Teks jam buka di kartu "Toko Kami" |
| `toko.wa` | Nomor WA tujuan, format `62812xxxxxxx` (tanpa + / 0 di depan) |
| `toko.alamat`, `toko.maps`, `toko.instagram` | Info toko |
| `toko.jamBuka` | Jam buka & tutup (juga batas jam ambil) |
| `toko.siapMenit` | Minimal menit persiapan jika ambil hari ini |
| `toko.pembayaran.bank` | Rekening bank (boleh lebih dari satu) |
| `toko.pembayaran.qris.gambar` | Ganti file `images/qris.png` dengan gambar QRIS asli |

## Mengelola menu

Setiap produk di `produk`:

```json
{
  "id": "p001",
  "nama": "Croissant Butter",
  "kategori": "Roti",
  "harga": 25000,
  "deskripsi": "Renyah di luar, lembut di dalam.",
  "foto": "images/croissant.webp",
  "emoji": "🥐",
  "warna": "#F8E4BE",
  "tersedia": true,
  "preOrder": false,
  "poHari": 2,
  "label": "Best Seller"
}
```

- `id` harus unik dan jangan diubah setelah dipakai.
- `foto` boleh kosong — akan tampil `emoji` di atas latar warna `warna`. Gunakan WebP, lebar ±800px, < 100 KB.
- Tampilan mengikuti desain Figma Make "Menu Bakery dan Pesanan WhatsApp" (font Fraunces + Nunito dari Google Fonts;
  saat offline font otomatis kembali ke font sistem).
- `tersedia: false` → tampil "Habis" dan tidak bisa dipesan.
- `preOrder: true` + `poHari: 2` → tanggal ambil paling cepat H+2. Jika keranjang berisi beberapa item pre-order, dipakai H terbesar.
- `kategori` harus sama persis dengan salah satu isi `kategori` di atas.

## Deploy ke GitHub Pages

Website akan tersedia di **https://mirraww.github.io/Bakemi/**. Workflow GitHub Actions
mempublikasikan isi folder `bakery` setiap kali ada push ke branch `main`.

Aktifkan sekali di GitHub: buka **Settings → Pages**, lalu pada **Build and deployment → Source**
pilih **GitHub Actions**. Setelah itu cek tab **Actions** sampai workflow deployment selesai.
Website harus dibuka lewat HTTPS agar bisa dipasang sebagai aplikasi.

### Pasang di HP

- **Android:** buka link website di Chrome, tekan **Install** di halaman (atau menu ⋮ → **Install app** / **Tambahkan ke layar utama**), lalu konfirmasi.
- **iPhone/iPad:** buka link di Safari, tekan **Bagikan** → **Tambah ke Layar Utama** → **Tambah**.
- Setelah terpasang, buka ikon **Manis Manja Bakery** dari layar utama. Aplikasi juga bisa menampilkan menu tersimpan saat offline.

**Setelah mengubah `index.html`, `css/`, atau `js/`, naikkan `VERSION` di `sw.js`** (mis. `bakery-v2`),
kalau tidak pelanggan akan tetap melihat versi lama. Mengubah `menu.json` tidak perlu.

## Batasan

- Link `wa.me` hanya mengisi teks. Pelanggan tetap menekan **Kirim** di WhatsApp, dan **foto bukti transfer
  harus dilampirkan sendiri** oleh pelanggan (sudah ada petunjuknya di layar).
- Total dihitung di sisi pelanggan sebagai tampilan. Karena tidak ada backend, pemilik tetap memverifikasi
  pesanan dan pembayaran di chat.
- Riwayat pesanan hanya tersimpan di perangkat pelanggan (localStorage).
- Notifikasi otomatis, status pesanan, atau dashboard admin membutuhkan backend / WhatsApp Business API.
