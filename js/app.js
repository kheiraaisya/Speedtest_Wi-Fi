/* Inisialisasi aplikasi dan alur pengukuran. */
(function () {
  var C = window.LAJU_CONFIG;
  var S = window.Laju.storage;
  var ST = window.Laju.speedtest;
  var A = window.Laju.analysis;
  var UI = window.Laju.ui;

  function $(id) { return document.getElementById(id); }

  var running = false;
  var locationInput = $("loc");
  var ssidInput = $("ssid");
  var serverSelect = $("serverSelect");
  var historyFilter = $("historyFilter");
  var repeatMode = $("repeatMode");
  function setupPicker(select, trigger, menu, valueLabel, container) {
    function sync() {
      var options = Array.from(select.options);
      var selectedIndex = Math.max(0, select.selectedIndex);
      var selectedLabel = options[selectedIndex].textContent;
      valueLabel.textContent = selectedLabel;
      trigger.setAttribute("aria-label", "Pilih: " + selectedLabel);
      menu.innerHTML = options.map(function (option, index) {
        return '<button class="picker-option' + (index === selectedIndex ? " selected" : "") +
          '" type="button" role="option" aria-selected="' + (index === selectedIndex) +
          '" data-index="' + index + '">' + option.textContent + "</button>";
      }).join("");
    }

    function close(returnFocus) {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) trigger.focus();
    }

    function open() {
      sync();
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      var selected = menu.querySelector('[aria-selected="true"]');
      if (selected) selected.focus();
    }

    trigger.onclick = function () {
      if (menu.hidden) open();
      else close(false);
    };
    trigger.onkeydown = function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open();
      }
    };
    menu.onclick = function (event) {
      var option = event.target.closest("[data-index]");
      if (!option) return;
      select.selectedIndex = Number(option.dataset.index);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
      close(true);
    };
    menu.onkeydown = function (event) {
      var options = Array.from(menu.querySelectorAll("[role=option]"));
      var current = options.indexOf(document.activeElement);
      var next = current;
      if (event.key === "ArrowDown") next = (current + 1) % options.length;
      else if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      } else return;
      event.preventDefault();
      options[next].focus();
    };
    menu.onfocusout = function () {
      window.setTimeout(function () {
        if (!menu.contains(document.activeElement)) close(false);
      }, 0);
    };
    document.addEventListener("click", function (event) {
      if (!container.contains(event.target)) close(false);
    });
    select.addEventListener("change", sync);
    return sync;
  }

  var syncLocationPicker = setupPicker(
    locationInput, $("locTrigger"), $("locMenu"), $("locLabel"), $("locationPicker")
  );
  var syncHistoryPicker = setupPicker(
    historyFilter, $("historyFilterTrigger"), $("historyFilterMenu"), $("historyFilterLabel"), $("historyPicker")
  );
  var syncServerPicker = setupPicker(
    serverSelect, $("serverSelectTrigger"), $("serverSelectMenu"), $("serverSelectLabel"), $("serverPicker")
  );

  function updateHistory() {
    UI.history(S.list(), historyFilter.value);
    syncHistoryPicker();
  }

  function chooseServer(id) {
    var serverId = C.servers[id] ? id : "cloudflare";
    serverSelect.value = serverId;
    syncServerPicker();
    C.server = C.servers[serverId];
    S.setPref("server", serverId);
    UI.network(S.getPref("ssid", ""));
  }

  locationInput.value = S.getPref("location", "Kamar");
  syncLocationPicker();
  locationInput.onchange = function () {
    S.setPref("location", locationInput.value);
    syncLocationPicker();
  };

  ssidInput.value = S.getPref("ssid", "");
  ssidInput.onchange = function () {
    S.setPref("ssid", ssidInput.value.trim());
  };

  chooseServer(S.getPref("server", "cloudflare"));
  serverSelect.onchange = function () {
    chooseServer(serverSelect.value);
  };

  window.addEventListener("online", function () {
    UI.network(S.getPref("ssid", ""));
  });
  window.addEventListener("offline", function () {
    UI.network(S.getPref("ssid", ""));
  });

  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection && connection.addEventListener) {
    connection.addEventListener("change", function () {
      UI.network(S.getPref("ssid", ""));
    });
  }

  historyFilter.onchange = updateHistory;
  updateHistory();

  $("go").onclick = async function () {
    if (running) return;
    running = true;

    var button = $("go");
    var repeatCount = repeatMode.checked ? 3 : 1;
    button.disabled = true;
    repeatMode.disabled = true;
    serverSelect.disabled = true;
    $("serverSelectTrigger").disabled = true;
    button.textContent = repeatCount > 1 ? "Tes 1/3…" : "Mengukur…";
    UI.resetMetrics();

    try {
      var trials = [];
      for (var trialIndex = 0; trialIndex < repeatCount; trialIndex++) {
        var trialLabel = repeatCount > 1 ? "Tes " + (trialIndex + 1) + "/" + repeatCount + " · " : "";
        button.textContent = repeatCount > 1 ? "Tes " + (trialIndex + 1) + "/" + repeatCount + "…" : "Mengukur…";

        UI.phase(trialLabel + "mengukur ping…");
        var ping = await ST.ping(function (ms) {
          UI.gauge(ms, null, "ms");
        });

        UI.phase(trialLabel + "mengukur unduh dan ping saat beban…");
        var download = await ST.download(function (value) {
          UI.gauge(value, "download", "Mbps");
        });

        UI.phase(trialLabel + "mengukur unggah dan ping saat beban…");
        var upload = await ST.upload(function (value) {
          UI.gauge(value, "upload", "Mbps");
        });

        var loadedSamples = download.loadedSamples.concat(upload.loadedSamples);
        var loadedPing = loadedSamples.length
          ? loadedSamples.reduce(function (sum, value) { return sum + value; }, 0) / loadedSamples.length
          : null;
        trials.push({
          download: download.speed,
          upload: upload.speed,
          ping: ping.ping,
          jitter: ping.jitter,
          loss: ping.loss,
          loadedPing: loadedPing
        });
      }

      var result = A.summarize(trials);
      result.location = locationInput.value;
      result.ssid = ssidInput.value.trim();
      result.server = C.server.name;
      result.qualityScore = A.qualityScore(result);
      var bufferbloat = A.bufferbloat(result);
      result.bufferbloatGrade = bufferbloat ? bufferbloat.grade : "";
      result.bufferbloatIncrease = bufferbloat ? bufferbloat.increase : null;

      UI.metric("mD", result.download.toFixed(1));
      UI.metric("mU", result.upload.toFixed(1));
      UI.metric("mP", Math.round(result.ping));
      UI.metric("mJ", result.jitter.toFixed(1));
      UI.metric("mLP", result.loadedPing == null ? "–" : Math.round(result.loadedPing));
      $("mPs").textContent = Math.round(result.loss) + "%";

      UI.gauge(result.download, "download", "Mbps unduh");
      UI.phase("Tes selesai");
      UI.verdict(result);
      S.add(result);
      updateHistory();
    } catch (error) {
      UI.phase(error.message || "Tes gagal.", true);
    } finally {
      running = false;
      button.disabled = false;
      repeatMode.disabled = false;
      serverSelect.disabled = false;
      $("serverSelectTrigger").disabled = false;
      button.textContent = "Ulangi tes";
    }
  };

  $("csv").onclick = function () {
    var blob = new Blob([S.toCSV()], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "laju-riwayat.csv";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  };

  var clearDialog = $("clearDialog");
  $("clear").onclick = function () {
    if (S.list().length) clearDialog.showModal();
  };
  $("cancelClear").onclick = function () {
    clearDialog.close();
  };
  $("confirmClear").onclick = function () {
    S.clear();
    updateHistory();
    clearDialog.close();
  };
  clearDialog.onclick = function (event) {
    if (event.target === clearDialog) clearDialog.close();
  };
})();
