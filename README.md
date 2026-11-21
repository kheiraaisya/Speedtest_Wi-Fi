# Laju – Speedtest WiFi

Speedtest WiFi yang jalan sepenuhnya di browser (desktop dan HP). Tanpa instalasi, tanpa backend.
Riwayat hasil disimpan di **local storage** browser.

## Cara pakai

Buka `index.html` di browser (klik dua kali), lalu tekan **Mulai tes**.
Untuk HP: taruh folder ini di hosting statis (GitHub Pages, Netlify), atau pakai server opsional di bawah.

## Struktur

```
laju-web/
├── index.html
├── css/style.css      # tampilan (variabel warna di :root)
├── js/
│   ├── config.js      # server tes, durasi, batas warna gauge
│   ├── speedtest.js   # ping, unduh, unggah (koneksi paralel)
│   ├── analysis.js    # skor kualitas, median, bufferbloat, kelayakan aktivitas
│   ├── storage.js     # local storage: riwayat + preferensi + ekspor CSV
│   ├── ui.js          # gauge, grafik, daftar riwayat, saran
│   └── app.js         # penghubung tombol dan alur tes
└── server/            # opsional: server tes sendiri (Python)
```

## Pengaturan

Pengaturan utama dikelompokkan di `js/config.js`:

- `servers`: pilihan Cloudflare atau server lokal; server lokal memerlukan aplikasi dijalankan melalui `server/server.py`.
- `pingCount`, `downloadSec`, `uploadSec`, `threads`, `warmupSec`: parameter pengukuran.
- `downloadCategories`: kategori dan warna kecepatan unduh; `max` adalah batas atas Mbps yang tidak termasuk kategori tersebut.
- `limits`: patokan aktivitas seperti video call, game, dan streaming.
- `limits.scoreWeights` dan `limits.activities`: bobot skor dan ambang status rekomendasi.
- `historyLimit` dan key penyimpanan: batas serta nama data di local storage.

## Cara kerja

- **Ping/jitter:** 10 request kecil, dihitung rata-rata dan selisih antar sampel.
- **Ping saat beban:** ping disampel selama unduh dan unggah; kenaikannya dipakai untuk estimasi bufferbloat.
- **Unduh/unggah:** 4 koneksi paralel selama 8 detik. Kecepatan = byte ÷ waktu (Mbps), detik pertama diabaikan (pemanasan).
- **Tes 3×:** opsi pada layar tes menjalankan tiga pengukuran berurutan. Angka utama adalah median dan ringkasan menampilkan rentang hasil; ini membandingkan kondisi selama tes singkat, bukan perubahan sepanjang hari.
- **Skor & rekomendasi:** skor kualitas 0–100 menggabungkan unduh, unggah, ping, jitter, loss, dan ping saat beban. Status tabel menunjukkan tingkat kenyamanan/risiko lag, bukan kepastian bisa atau tidaknya tersambung.
- **Riwayat:** filter hasil menurut lokasi dan ekspor CSV (termasuk server tes).
- **Server tes:** bawaan memakai Cloudflare. Untuk server lokal, jalankan perintah berikut, buka `http://localhost:8000`, lalu pilih **Server lokal** di aplikasi:
  ```bash
  pip install -r server/requirements.txt
  python server/server.py
  ```

## Batasan

- Browser tidak bisa membaca nama WiFi atau kekuatan sinyal, jadi nama WiFi diisi manual.
- Hasil mengukur jalur ke server tes, bukan hanya WiFi. Tes di jam dan lokasi berbeda untuk membandingkan.
- Local storage terikat ke satu browser dan satu perangkat.

## Ide pengembangan

- [ ] Pilihan server tes di pengaturan
- [ ] Tes terjadwal dan notifikasi saat kecepatan turun
- [ ] PWA supaya bisa di-install di HP
- [ ] Impor/ekspor riwayat JSON
