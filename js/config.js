/* Pengaturan aplikasi Laju. Edit nilai di bagian yang sesuai. */
window.Laju = window.Laju || {};

window.LAJU_CONFIG = {
  // Server pengukuran. Server lokal tersedia saat aplikasi disajikan oleh server/server.py.
  servers: {
    cloudflare: {
      name: "Cloudflare",
      ping: function () { return "https://speed.cloudflare.com/__down?bytes=0&r=" + Math.random(); },
      download: function (bytes) { return "https://speed.cloudflare.com/__down?bytes=" + bytes + "&r=" + Math.random(); },
      upload: function () { return "https://speed.cloudflare.com/__up"; }
    },
    local: {
      name: "Server lokal",
      ping: function () { return "/api/ping?r=" + Math.random(); },
      download: function (bytes) { return "/api/download?mb=" + Math.ceil(bytes / 1048576); },
      upload: function () { return "/api/upload"; }
    }
  },

  // Pengukuran: jumlah sampel/durasi dalam detik/koneksi paralel.
  pingCount: 10,
  downloadSec: 8,
  uploadSec: 8,
  threads: 4,
  warmupSec: 1,
  loadedProbeIntervalMs: 500,

  // Batas atas tiap kategori kecepatan unduh (Mbps), tidak termasuk nilai max.
  downloadCategories: [
    { max: 1, label: "Sangat lambat", color: "var(--bad)" },
    { max: 10, label: "Lambat", color: "#f97316" },
    { max: 30, label: "Sedang", color: "var(--warn)" },
    { max: 100, label: "Cepat", color: "var(--ok)" },
    { max: Infinity, label: "Sangat cepat", color: "var(--acc)" }
  ],

  // Ambang aktivitas dan tampilan gauge.
  limits: {
    download: [30, 60],
    upload: [15, 30],
    gaugeMax: 100,
    videoCall: { download: 5, upload: 3, ping: 80 },
    game: { ping: 40, jitter: 15 },
    streaming4k: 25,
    largeDownload: 50,
    activities: {
      stream1080: { download: [8, 4], loss: [1, 5] },
      stream4k: { download: [25, 15], loss: [1, 5] },
      videoCall: { download: [5, 3], upload: [3, 1], ping: [80, 150], jitter: [20, 40], loss: [1, 5] },
      meeting: { download: [5, 3], upload: [3, 1], ping: [100, 180], jitter: [20, 40], loss: [1, 5] },
      gaming: { download: [10, 5], ping: [50, 100], jitter: [15, 30], loss: [1, 3] },
      largeDownload: { download: [50, 20], loss: [3, 10] }
    },
    scoreWeights: { download: 0.20, upload: 0.10, ping: 0.20, jitter: 0.15, loss: 0.15, bufferbloat: 0.20 }
  },

  // Penyimpanan lokal browser.
  historyLimit: 100,
  storageKey: "laju.history.v1",
  prefsKey: "laju.prefs.v1"
};
