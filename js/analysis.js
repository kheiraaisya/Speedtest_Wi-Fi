/* Perhitungan skor, median tes berulang, bufferbloat, dan rekomendasi aktivitas. */
(function () {
  var C = window.LAJU_CONFIG;
  var METRICS = ["download", "upload", "ping", "jitter", "loss", "loadedPing"];

  function median(values) {
    var sorted = values.filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!sorted.length) return null;
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function summarize(trials) {
    var result = { trials: trials };
    METRICS.forEach(function (key) {
      var values = trials.map(function (trial) { return trial[key]; }).filter(Number.isFinite);
      result[key] = median(values);
      if (values.length) {
        result[key + "Min"] = Math.min.apply(null, values);
        result[key + "Max"] = Math.max.apply(null, values);
      }
    });
    result.repetitions = trials.length;
    return result;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function bufferbloat(result) {
    if (!Number.isFinite(result.loadedPing) || !Number.isFinite(result.ping)) return null;
    var increase = Math.max(0, result.loadedPing - result.ping);
    var bands = [
      { max: 5, grade: "A", label: "Sangat baik" },
      { max: 20, grade: "B", label: "Baik" },
      { max: 50, grade: "C", label: "Cukup" },
      { max: 100, grade: "D", label: "Kurang" },
      { max: 200, grade: "E", label: "Buruk" },
      { max: Infinity, grade: "F", label: "Sangat buruk" }
    ];
    var band = bands.find(function (item) { return increase <= item.max; });
    return { increase: increase, grade: band.grade, label: band.label };
  }

  function qualityScore(result) {
    var delta = bufferbloat(result);
    var parts = {
      download: clamp(result.download, 0, 100),
      upload: clamp(result.upload / 30 * 100, 0, 100),
      ping: clamp((220 - result.ping) / 2, 0, 100),
      jitter: clamp((50 - result.jitter) / 45 * 100, 0, 100),
      loss: clamp(100 - result.loss * 10, 0, 100)
    };
    if (delta) parts.bufferbloat = clamp(100 - delta.increase / 2, 0, 100);

    var total = 0;
    var weight = 0;
    Object.keys(parts).forEach(function (key) {
      var partWeight = C.limits.scoreWeights[key];
      total += parts[key] * partWeight;
      weight += partWeight;
    });
    return Math.round(total / weight);
  }

  function assessActivity(metrics, criteria, impacts) {
    var severity = 0;
    var requirements = [];
    var observed = [];

    Object.keys(criteria).forEach(function (key) {
      var thresholds = criteria[key];
      var value = metrics[key];
      var minimum = key === "download" || key === "upload";
      var passed = minimum ? value >= thresholds[0] : value <= thresholds[0];
      var warning = minimum ? value >= thresholds[1] : value <= thresholds[1];
      severity = Math.max(severity, passed ? 0 : warning ? 1 : 2);
      requirements.push((minimum ? "≥" : "≤") + thresholds[0] + (key === "loss" ? "%" : key === "download" || key === "upload" ? " Mbps" : " ms"));
      observed.push((key === "download" ? "Unduh " : key === "upload" ? "Unggah " : key === "ping" ? "Ping " : key === "jitter" ? "Jitter " : "Loss ") +
        (Number(value).toFixed(key === "jitter" ? 1 : 0)) + (key === "loss" ? "%" : key === "download" || key === "upload" ? " Mbps" : " ms"));
    });

    return {
      status: severity === 0 ? "✓" : "⚠",
      level: severity === 0 ? "good" : severity === 1 ? "warn" : "bad",
      description: severity === 0 ? "Nyaman" : severity === 1
        ? "Bisa, " + impacts.moderate
        : "Bisa, risiko " + impacts.high,
      requirements: requirements.join(", "),
      observed: observed.join(", ")
    };
  }

  function recommendations(result) {
    var limits = C.limits.activities;
    return [
      { name: "Streaming 1080p", data: assessActivity(result, limits.stream1080, { moderate: "sesekali tersendat", high: "sering buffering" }) },
      { name: "Streaming 4K", data: assessActivity(result, limits.stream4k, { moderate: "resolusi bisa turun", high: "buffering / resolusi turun" }) },
      { name: "Video call", data: assessActivity(result, limits.videoCall, { moderate: "mungkin ada jeda", high: "lag audio/video" }) },
      { name: "Zoom / Google Meet", data: assessActivity(result, limits.meeting, { moderate: "mungkin ada jeda", high: "lag atau putus-putus" }) },
      { name: "Gaming online", data: assessActivity(result, limits.gaming, { moderate: "delay mungkin terasa", high: "input delay / lag" }) },
      { name: "Unduh file besar", data: assessActivity(result, limits.largeDownload, { moderate: "unduh lebih lama", high: "unduh jauh lebih lama" }) }
    ];
  }

  window.Laju.analysis = {
    summarize: summarize,
    bufferbloat: bufferbloat,
    qualityScore: qualityScore,
    recommendations: recommendations
  };
})();
