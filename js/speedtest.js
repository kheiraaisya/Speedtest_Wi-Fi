/* Mesin pengukuran: ping, unduh, unggah. Kecepatan = byte diterima/dikirim ÷ waktu. */
(function () {
  var C = window.LAJU_CONFIG;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function requestSignal(ms, parentSignal) {
    var controller = new AbortController();
    setTimeout(function () { controller.abort(); }, ms);
    if (parentSignal) {
      if (parentSignal.aborted) controller.abort();
      else parentSignal.addEventListener("abort", function () { controller.abort(); }, { once: true });
    }
    return controller.signal;
  }

  async function probeWhileLoaded(signal, samples) {
    while (!signal.aborted) {
      var started = performance.now();
      try {
        var response = await fetch(C.server.ping(), {
          cache: "no-store",
          signal: requestSignal(3000, signal)
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        await response.arrayBuffer();
        samples.push(performance.now() - started);
      } catch (error) {
        if (signal.aborted) return;
      }
      await sleep(C.loadedProbeIntervalMs);
    }
  }

  async function ping(onSample) {
    try {
      var warmup = await fetch(C.server.ping(), {
        cache: "no-store",
        signal: requestSignal(C.pingWarmupTimeoutMs)
      });
      if (!warmup.ok) throw new Error("HTTP " + warmup.status);
      await warmup.arrayBuffer();
    } catch (e) { /* Pemanasan opsional; jangan menahan tes jika server lambat. */ }

    var times = [], lost = 0;
    var consecutiveFailures = 0;
    var sampleCount = C.pingCount;
    for (var i = 0; i < sampleCount; i++) {
      var t0 = performance.now();
      var sample = null;
      try {
        var r = await fetch(C.server.ping(), {
          cache: "no-store",
          signal: requestSignal(C.pingRequestTimeoutMs)
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        await r.arrayBuffer();
        var ms = performance.now() - t0;
        times.push(ms);
        sample = ms;
        consecutiveFailures = 0;
      } catch (e) {
        lost++;
        consecutiveFailures++;
      }
      if (i === 2) {
        if (!times.length) {
          sampleCount = Math.min(sampleCount, C.slowPingCount);
        } else {
          var initialSamples = times.slice().sort(function (a, b) { return a - b; });
          var middle = Math.floor(initialSamples.length / 2);
          var initialMedian = initialSamples.length % 2
            ? initialSamples[middle]
            : (initialSamples[middle - 1] + initialSamples[middle]) / 2;
          if (initialMedian >= C.slowPingThresholdMs) {
            sampleCount = Math.min(sampleCount, C.slowPingCount);
          }
        }
      }
      if (onSample) onSample(sample, i + 1, sampleCount);
      if (consecutiveFailures >= C.maxConsecutivePingFailures) {
        throw new Error("Server tes " + C.server.name + " tidak merespons setelah " +
          C.maxConsecutivePingFailures + " ping berturut-turut. Periksa koneksi atau pilih server lain.");
      }
      await sleep(80);
    }
    if (!times.length) throw new Error("Server tes tidak bisa dijangkau. Periksa koneksi internet.");
    var sortedTimes = times.slice().sort(function (a, b) { return a - b; });
    var middle = Math.floor(sortedTimes.length / 2);
    var pingMedian = sortedTimes.length % 2
      ? sortedTimes[middle]
      : (sortedTimes[middle - 1] + sortedTimes[middle]) / 2;
    var j = 0;
    for (var k = 1; k < times.length; k++) j += Math.abs(times[k] - times[k - 1]);
    return {
      ping: pingMedian,
      jitter: times.length > 1 ? j / (times.length - 1) : 0,
      loss: lost / sampleCount * 100,
      samples: times.length,
      attempts: sampleCount
    };
  }

  // Jalankan worker paralel selama `seconds`, laporkan kecepatan langsung tiap 200 ms.
  async function timed(seconds, spawn, onProgress) {
    var state = { bytes: 0, fail: 0 }, ctl = new AbortController();
    var t0 = performance.now(), wb = 0, wt = t0, warmed = false, samples = [];
    var workers = spawn(state, ctl.signal);
    var latencySamples = [];
    workers.push(probeWhileLoaded(ctl.signal, latencySamples));
    while (performance.now() - t0 < seconds * 1000 && state.fail < 5) {
      await sleep(Math.min(200, Math.max(0, seconds * 1000 - (performance.now() - t0))));
      var now = performance.now();
      samples.push([now, state.bytes]);
      while (samples.length > 1 && now - samples[0][0] > 1000) samples.shift();
      if (!warmed && now - t0 >= C.warmupSec * 1000) { warmed = true; wb = state.bytes; wt = now; }
      var dt = (now - samples[0][0]) / 1000;
      if (onProgress && dt > 0) {
        var rate = (state.bytes - samples[0][1]) * 8 / dt / 1e6;
        var progress = Math.min((now - t0) / (seconds * 1000), 1);
        onProgress(rate, progress);
      }
    }
    var ended = performance.now(), finalBytes = state.bytes;
    ctl.abort();
    await Promise.allSettled(workers);
    if (state.bytes === 0) throw new Error("Tes gagal: tidak ada data yang diterima.");
    var secs = (ended - wt) / 1000;
    if (secs <= 0 || finalBytes <= wb) throw new Error("Tes terlalu singkat atau tidak ada data yang diterima.");
    var loadedPing = latencySamples.length
      ? latencySamples.reduce(function (sum, value) { return sum + value; }, 0) / latencySamples.length
      : null;
    return {
      speed: (finalBytes - wb) * 8 / secs / 1e6,
      loadedPing: loadedPing,
      loadedSamples: latencySamples
    };
  }

  function spawnDownload(state, signal) {
    return Array.from({ length: C.threads }, async function () {
      while (!signal.aborted && state.fail < 5) {
        try {
          var r = await fetch(C.server.download(25e6), { cache: "no-store", signal: signal });
          if (!r.ok || !r.body) throw new Error("Server unduh HTTP " + r.status);
          var reader = r.body.getReader();
          for (;;) {
            var chunk = await reader.read();
            if (chunk.done) break;
            state.bytes += chunk.value.length;
          }
        } catch (e) {
          if (signal.aborted) return;
          state.fail++;
          await sleep(200);
        }
      }
    });
  }

  function randomBlob(size) {
    var parts = [];
    for (var remaining = size; remaining > 0; remaining -= 65536) {
      var chunk = new Uint8Array(Math.min(65536, remaining));
      crypto.getRandomValues(chunk);
      parts.push(chunk);
    }
    return new Blob(parts);
  }

  function spawnUpload(state, signal) {
    var blob = randomBlob(4 * 1048576);
    return Array.from({ length: C.threads }, async function () {
      while (!signal.aborted && state.fail < 5) {
        await new Promise(function (resolve) {
          var x = new XMLHttpRequest(), last = 0;
          x.open("POST", C.server.upload());
          x.timeout = 30000;
          x.upload.onprogress = function (e) { state.bytes += e.loaded - last; last = e.loaded; };
          x.onerror = x.ontimeout = function () { state.fail++; resolve(); };
          x.onloadend = function () { if (x.status < 200 || x.status >= 300) state.fail++; resolve(); };
          signal.addEventListener("abort", function () { x.abort(); }, { once: true });
          x.send(blob);
        });
      }
    });
  }

  window.Laju.speedtest = {
    ping: ping,
    download: function (onProgress) { return timed(C.downloadSec, spawnDownload, onProgress); },
    upload: function (onProgress) { return timed(C.uploadSec, spawnUpload, onProgress); }
  };
})();
