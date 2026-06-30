
  streams.forEach((stream) => {
    const option = document.createElement("option");
    option.value = stream.url;
    option.textContent = stream.name;
    select.appendChild(option);
  });

  if (streams[0]) {
    select.value = streams[0].url;
    if (ui.streamInput) ui.streamInput.value = isValidStream(streams[0].url) ? streams[0].url : "";
  }
}

function selectEvent(id) {
  const event = eventById(id);
  player.selectedEventId = event.id;

  if (ui.playerTitle) ui.playerTitle.textContent = event.title;
  if (ui.selectedEvent) ui.selectedEvent.textContent = event.title;
  if (ui.selectedDescription) ui.selectedDescription.textContent = event.desc;

  renderStreamOptions(event);
  location.hash = "player";
}

function resetPlayer() {
  if (!ui.video) return;

  if (player.hls) {
    player.hls.destroy();
    player.hls = null;
  }

  ui.video.pause();
  ui.video.removeAttribute("src");
  ui.video.load();

  if (ui.quality) ui.quality.innerHTML = "<option>Auto</option>";
}

function loadStream(url, reconnect = false) {
  if (!ui.video || !isValidStream(url)) {
    setStatus("ingresa una URL valida");
    return;
  }

  player.manualPause = false;
  clearTimeout(player.reconnectTimer);
  if (!reconnect) player.reconnectAttempts = 0;

  saveLastStream(player.selectedEventId, url);
  resetPlayer();

  if (url.includes(".m3u8")) loadHls(url, reconnect);
  else loadNative(url, reconnect ? "MP4 reconectado" : "MP4 cargado");
}

function loadHls(url, reconnect) {
  if (window.Hls && window.Hls.isSupported()) {
    player.hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
    player.hls.loadSource(url);
    player.hls.attachMedia(ui.video);

    player.hls.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
      data.levels?.forEach((level, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = level.height ? level.height + "p" : "Nivel " + (index + 1);
        ui.quality?.appendChild(option);
      });

      ui.empty?.classList.add("hidden");
      setStatus(reconnect ? "HLS reconectado" : "HLS cargado");
      ui.video.play().catch(() => {});
    });

    player.hls.on(window.Hls.Events.ERROR, (_, data) => {
      setStatus(data.fatal ? "error fatal en stream" : "buffering o reconexion");
      if (data.fatal) scheduleReconnect("error del HLS");
    });

    return;
  }

  if (ui.video.canPlayType("application/vnd.apple.mpegurl")) {
    loadNative(url, reconnect ? "HLS nativo reconectado" : "HLS nativo cargado");
    return;
  }

  setStatus("este navegador no soporta HLS");
}

function loadNative(url, message) {
  ui.video.src = url;
  ui.empty?.classList.add("hidden");
  setStatus(message);
  ui.video.play().catch(() => {});
}

function scheduleReconnect(reason) {
  const saved = getLastStream();
  if (!saved?.url || player.manualPause) return;

  clearTimeout(player.reconnectTimer);
  player.reconnectAttempts += 1;

  const delay = Math.min(3000 + player.reconnectAttempts * 1000, 10000);
  setStatus("reconectando por " + reason + " en " + Math.round(delay / 1000) + "s");

  player.reconnectTimer = setTimeout(() => loadStream(saved.url, true), delay);
}

function bindControls() {
  $("#themeButton")?.addEventListener("click", () => document.body.classList.toggle("dark"));

  ui.search?.addEventListener("input", () => {
    renderEvents($(".filters .active")?.dataset.cat || "Todos");
  });

  $("#loadStream")?.addEventListener("click", () => loadStream(ui.streamInput?.value.trim()));

  $("#loadDemo")?.addEventListener("click", () => {
    const demoUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
    if (ui.streamInput) ui.streamInput.value = demoUrl;
    loadStream(demoUrl);
  });

  $("#playButton")?.addEventListener("click", () => {
    player.manualPause = false;
    ui.video?.play();
  });

  $("#pauseButton")?.addEventListener("click", () => {
    player.manualPause = true;
    clearTimeout(player.reconnectTimer);
    ui.video?.pause();
  });

  $("#volumeSlider")?.addEventListener("input", (event) => {
    if (ui.video) ui.video.volume = Number(event.target.value);
  });

  $("#fullscreenButton")?.addEventListener("click", () => ui.video?.requestFullscreen?.());

  ui.quality?.addEventListener("change", (event) => {
    if (player.hls) {
      player.hls.currentLevel = event.target.value === "Auto" ? -1 : Number(event.target.value);
    }
  });
}

function bindReconnect() {
  ui.video?.addEventListener("playing", () => {
    player.reconnectAttempts = 0;
    setStatus("reproduciendo");
  });

  ui.video?.addEventListener("pause", () => {
    if (!player.manualPause && !ui.video.ended) scheduleReconnect("pausa inesperada");
  });

  ui.video?.addEventListener("ended", () => scheduleReconnect("fin del video"));
  ui.video?.addEventListener("error", () => scheduleReconnect("error del video"));
  ui.video?.addEventListener("stalled", () => scheduleReconnect("stream detenido"));
  ui.video?.addEventListener("waiting", () => setStatus("buffering"));
}

function init() {
  renderEvents();
  renderAgenda();
  renderChannels();
  bindControls();
  bindReconnect();
  selectEvent(events[0].id);

  const saved = getLastStream();
  if (saved?.url && ui.streamInput) ui.streamInput.value = saved.url;
}

init();
