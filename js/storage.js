/* Penyimpanan lokal: riwayat dan preferensi di localStorage. */
(function () {
  var C = window.LAJU_CONFIG;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  window.Laju.storage = {
    list: function () { return read(C.storageKey, []); },
    add: function (result) {
      var all = read(C.storageKey, []);
      var item = Object.assign({ id: Date.now(), ts: Date.now() }, result);
      all.unshift(item);
      write(C.storageKey, all.slice(0, C.historyLimit));
      return item;
    },
    clear: function () { try { localStorage.removeItem(C.storageKey); } catch (e) {} },
    getPref: function (k, d) { var p = read(C.prefsKey, {}); return k in p ? p[k] : d; },
    setPref: function (k, v) { var p = read(C.prefsKey, {}); p[k] = v; write(C.prefsKey, p); },
    toCSV: function () {
      var rows = [["waktu", "lokasi", "wifi", "server", "jumlah_tes", "unduh_median_mbps", "unduh_min_mbps", "unduh_maks_mbps", "unggah_median_mbps", "unggah_min_mbps", "unggah_maks_mbps", "ping_ms", "jitter_ms", "loss_pct", "ping_saat_beban_ms", "skor_kualitas", "bufferbloat_grade"]];
      read(C.storageKey, []).forEach(function (r) {
        rows.push([new Date(r.ts).toISOString(), r.location, r.ssid, r.server, r.repetitions || 1,
          r.download, r.downloadMin, r.downloadMax, r.upload, r.uploadMin, r.uploadMax,
          r.ping, r.jitter, r.loss, r.loadedPing, r.qualityScore, r.bufferbloatGrade]
          .map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }));
      });
      return rows.map(function (r) { return r.join(","); }).join("\n");
    }
  };
})();
