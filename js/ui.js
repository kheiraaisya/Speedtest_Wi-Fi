/* Tampilan: gauge, metrik, jaringan, grafik, dan daftar riwayat. */
(function () {
  var C = window.LAJU_CONFIG;
  var A = window.Laju.analysis;
  var GAUGE_LENGTH = 235.6;
  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function color(v, kind) {
    if (kind === "download") {
      return C.downloadCategories.find(function (category) { return v < category.max; }).color;
    }
    var l = C.limits[kind];
    return v < l[0] ? "var(--bad)" : v < l[1] ? "var(--warn)" : "var(--ok)";
  }
  function when(timestamp) {
    return new Date(timestamp).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  var UI = {
    renderLegend: function () {
      $("speedLegend").innerHTML = C.downloadCategories.map(function (category) {
        return '<span><i style="background:' + category.color + '"></i>' + category.label + "</span>";
      }).join("");
    },
    gauge: function (v, kind, unit) {
      $("ring").style.strokeDashoffset = GAUGE_LENGTH - GAUGE_LENGTH * Math.min(v / C.limits.gaugeMax, 1);
      $("ring").style.stroke = kind ? color(v, kind) : "";
      $("num").textContent = v.toFixed(kind ? 1 : 0);
      $("unit").textContent = unit;
    },
    phase: function (text, isError) {
      var phase = $("phase");
      phase.textContent = text;
      phase.className = "phase" + (isError ? " err" : "");
    },
    metric: function (id, value) {
      $(id).textContent = value;
    },
    resetMetrics: function () {
      ["mD", "mU", "mP", "mJ", "mLP"].forEach(function (id) {
        $(id).textContent = "–";
      });
      $("mPs").textContent = "–";
      $("verdict").innerHTML = "";
      $("qualityPanel").hidden = true;
      $("recommendations").hidden = true;
      $("repeatSummary").hidden = true;
      $("activityRows").innerHTML = "";
    },
    verdict: function (r) {
      var category = C.downloadCategories.find(function (item) { return r.download < item.max; });
      $("verdict").innerHTML = "<b>" + category.label + ".</b> Kecepatan unduh median " + r.download.toFixed(1) + " Mbps.";

      var score = A.qualityScore(r);
      var scoreLabel = score >= 90 ? "Sangat baik" : score >= 75 ? "Baik" : score >= 60 ? "Cukup" : score >= 40 ? "Kurang" : "Buruk";
      $("qualityScore").textContent = score;
      $("qualityLabel").textContent = scoreLabel + " / 100";

      var buffer = A.bufferbloat(r);
      $("bufferbloatGrade").textContent = buffer ? buffer.grade : "–";
      $("bufferbloatText").textContent = buffer
        ? "+" + Math.round(buffer.increase) + " ms · " + buffer.label +
          (buffer.increase > 100 ? ". Latensi dapat terasa saat jaringan sibuk." : ". Kenaikan latensi saat jaringan sibuk.")
        : "Ping saat beban tidak berhasil diukur.";
      $("qualityPanel").hidden = false;

      if (r.repetitions > 1) {
        $("repeatSummary").textContent = "Median dari " + r.repetitions + " tes · Unduh " +
          r.downloadMin.toFixed(1) + "–" + r.downloadMax.toFixed(1) + " Mbps · Unggah " +
          r.uploadMin.toFixed(1) + "–" + r.uploadMax.toFixed(1) + " Mbps · Ping " +
          Math.round(r.pingMin) + "–" + Math.round(r.pingMax) + " ms · Jitter " +
          r.jitterMin.toFixed(1) + "–" + r.jitterMax.toFixed(1) + " ms · Loss " +
          r.lossMin.toFixed(1) + "–" + r.lossMax.toFixed(1) + "%";
        $("repeatSummary").hidden = false;
      }

      $("activityRows").innerHTML = A.recommendations(r).map(function (item) {
        return '<tr><th scope="row">' + esc(item.name) + '</th><td><span class="activity-status ' +
          item.data.level + '" aria-label="' + esc(item.data.description) + '">' + item.data.status +
          '</span> <span class="activity-description">' + esc(item.data.description) + '</span></td><td>' + esc(item.data.requirements) +
          '</td><td>' + esc(item.data.observed) + "</td></tr>";
      }).join("");
      $("recommendations").hidden = false;
    },
    network: function (ssid) {
      var n = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      $("ssid").value = ssid || "";
      $("nStatus").textContent = navigator.onLine ? "Terhubung" : "Offline";
      $("nEst").textContent = n && n.downlink ? n.downlink + " Mbps" : "Tidak didukung";
      $("nRtt").textContent = n && n.rtt != null ? n.rtt + " ms" : "Tidak didukung";
    },
    chart: function (items) {
      var data = items.slice(0, 10).reverse();
      if (!data.length) { $("chart").innerHTML = '<div class="empty">Belum ada hasil. Jalankan tes pertamamu.</div>'; return; }
      var max = Math.max(100, Math.ceil(Math.max.apply(null, data.map(function (d) { return d.download; })) / 50) * 50);
      var x = function (i) { return data.length === 1 ? 330 : 50 + i * (560 / (data.length - 1)); };
      var y = function (v) { return 120 - v / max * 100; };
      var pts = data.map(function (d, i) { return x(i) + "," + y(d.download).toFixed(1); }).join(" ");
      var dots = data.map(function (d, i) { return '<circle cx="' + x(i) + '" cy="' + y(d.download).toFixed(1) + '" r="4" fill="var(--bg)" stroke="var(--acc)" stroke-width="2.5"/>'; }).join("");
      var labels = data.map(function (d, i) { var t = new Date(d.ts); return '<text x="' + (x(i) - 10) + '" y="150">' + t.getDate() + "/" + (t.getMonth() + 1) + "</text>"; }).join("");
      $("chart").innerHTML = '<svg class="chart" viewBox="0 0 640 170" role="img" aria-label="Grafik kecepatan unduh">' +
        '<g stroke="var(--line)"><line x1="40" y1="20" x2="630" y2="20"/><line x1="40" y1="70" x2="630" y2="70"/><line x1="40" y1="120" x2="630" y2="120"/></g>' +
        '<text x="0" y="24">' + max + '</text><text x="6" y="74">' + max / 2 + '</text><text x="12" y="124">0</text>' +
        '<polyline fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" points="' + pts + '"/>' + dots + labels + "</svg>";
    },
    list: function (items) {
      $("list").innerHTML = items.slice(0, 8).map(function (r) {
        return "<li><div><b>" + esc(r.location || "Tanpa lokasi") + "</b></div><div class=\"r\">" + Math.round(r.download) + " Mbps</div>" +
          '<div class="t">' + when(r.ts) + (r.ssid ? " · " + esc(r.ssid) : "") + " · Ping " + Math.round(r.ping) +
          (r.server ? " · " + esc(r.server) : "") + '</div><div class="t r">Unggah ' + Math.round(r.upload) + "</div></li>";
      }).join("");
    },
    tip: function (items) {
      var byHour = {};
      items.forEach(function (r) { var h = new Date(r.ts).getHours(); (byHour[h] = byHour[h] || []).push(r.download); });
      var hours = Object.keys(byHour).map(function (h) { var a = byHour[h]; return { h: +h, avg: a.reduce(function (s, v) { return s + v; }, 0) / a.length }; });
      if (items.length < 3 || hours.length < 2) { $("tip").innerHTML = "<b>Saran:</b> Lakukan tes di jam yang berbeda. Setelah beberapa hasil, Laju menunjukkan kapan WiFi kamu paling lambat."; return; }
      hours.sort(function (a, b) { return a.avg - b.avg; });
      var slow = hours[0], fast = hours[hours.length - 1], p = function (h) { return ("0" + h).slice(-2) + ".00"; };
      $("tip").innerHTML = "<b>Pola:</b> WiFi kamu paling lambat sekitar pukul " + p(slow.h) + " (rata-rata " + Math.round(slow.avg) + " Mbps) dan paling cepat sekitar pukul " + p(fast.h) + " (" + Math.round(fast.avg) + " Mbps).";
    },
    history: function (items, selectedLocation) {
      var filter = $("historyFilter");
      var locations = Array.from(new Set(items.map(function (item) { return item.location || "Tanpa lokasi"; }))).sort();
      filter.innerHTML = '<option value="">Semua lokasi</option>' + locations.map(function (location) {
        return '<option value="' + esc(location) + '">' + esc(location) + "</option>";
      }).join("");
      filter.value = locations.indexOf(selectedLocation) >= 0 ? selectedLocation : "";
      var visibleItems = filter.value
        ? items.filter(function (item) { return (item.location || "Tanpa lokasi") === filter.value; })
        : items;
      UI.chart(visibleItems);
      UI.list(visibleItems);
      UI.tip(visibleItems);
    }
  };
  UI.renderLegend();
  window.Laju.ui = UI;
})();
