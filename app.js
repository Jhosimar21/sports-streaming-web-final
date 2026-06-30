const categories = ["Todos", "Futbol", "Baloncesto", "Motor", "Tenis"];
const demoStream = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const events = [
  {
    id: "arena",
    title: "Arena Max Sports",
    league: "Liga Nacional",
    category: "Futbol",
    time: "18:00",
    status: "live",
    image: "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80",
    desc: "Canal principal para contenido deportivo autorizado, previas y transmisiones en vivo.",
    streams: [
      { name: "Demo HLS publico", url: demoStream },
      { name: "Stream principal autorizado", url: "PEGA_AQUI_TU_STREAM_1.m3u8" },
      { name: "Stream respaldo autorizado", url: "PEGA_AQUI_TU_STREAM_2.m3u8" },
    ],
  },
  {
    id: "court",
    title: "Court Vision",
    league: "Basket Pro",
    category: "Baloncesto",
    time: "20:30",
    status: "live",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    desc: "Cobertura de baloncesto, entrevistas y analisis.",
    streams: [{ name: "Demo HLS publico", url: demoStream }],
  },
];

let hlsInstance = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let manualPause = false;
let selectedStreamUrl = "";

const grid = document.querySelector("#eventGrid");
const filters = document.querySelector("#categoryFilters");
const agenda = document.querySelector("#agendaList");
const channels = document.querySelector("#channelRow");
const search = document.querySelector("#searchInput");

function setStreamStatus(text) {
  const el = document.querySelector("#streamStatus");
  if (el) el.textContent = "Estado: " + text;
}

function renderFilters(active = "Todos") {
  if (!filters) return;

  filters.innerHTML = categories
    .map((cat) => `<button class="${cat === active ? "active" : ""}" data-cat="${cat}">${cat}</button>`)
    .join("");

  filters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => renderEvents(button.dataset.cat || "Todos"));
  });
}

function eventCard(event) {
  return `
    <article class="event-card">
      <img src="${event.image}" alt="${event.title}">
      <div class="event-card-body">
        <div class="event-meta">
          <span>${event.category}</span>
          <strong class="status ${event.status}">${event.status === "live" ? "En vivo" : "Proximo"}</strong>
        </div>
        <h3>${event.title}</h3>
        <p>${event.league} - ${event.time}</p>
        <button data-id="${event.id}">Ver evento</button>
      </div>
    </article>
  `;
}

function renderEvents(category = "Todos") {
  if (!grid) return;

  renderFilters(category);

  const term = (search?.value || "").toLowerCase();

  const list = events.filter((event) => {
    const matchCategory = category === "Todos" || event.category === category;
    const matchSearch = [event.title, event.league, event.category].join(" ").toLowerCase().includes(term);
    return matchCategory && matchSearch;
  });

  grid.innerHTML = list.map(eventCard).join("");

  grid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => selectEvent(button.dataset.id));
  });
}

function selectEvent(id) {
  const event = events.find((item) => item.id === id) || events[0];

  document.querySelector("#playerTitle").textContent = event.title;
  document.querySelector("#selectedEvent").textContent = event.title;
  document.querySelector("#selectedDescription").textContent = event.desc;

  renderStreamOptions(event);
  location.hash = "player";
}

function renderStreamOptions(event) {
  const select = document.querySelector("#streamSelect");
  const input = document.querySelector("#streamUrl");

  if (!select) {
    if (input && event.streams[0]) input.value = event.streams[0].url;
    return;
  }

  select.innerHTML = "";

  event.streams.forEach((stream) => {
    const option = document.createElement("option");
    option.value = stream.url;
    option.textContent = stream.name;
    select.appendChild(option);
  });

  selectedStreamUrl = event.streams[0]?.url || "";
  select.value = selectedStreamUrl;

  if (input) input.value = selectedStreamUrl;
}

function renderAgenda() {
  if (!agenda) return;

  agenda.innerHTML = events
    .map(
      (event) => `
        <article class="agenda-item">
          <strong>${event.time}</strong>
          <div>
            <h3>${event.title}</h3>
            <p>${event.league} · ${event.category}</p>
          </div>
          <span>${event.status === "live" ? "En vivo" : "Programado"}</span>
        </article>
      `
    )
    .join("");
}

function renderChannels() {
  if (!channels) return;

  channels.innerHTML = events
    .map(
      (event) => `
        <article class="channel-card" style="background-image:url(${event.image})">
          <h3>${event.title}</h3>
          <p>${event.category} · ${event.status === "live" ? "En vivo" : "Proximo"}</p>
        </article>
      `
    )
    .join("");
}

function resetPlayer(video) {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();
}

function scheduleReconnect(reason) {
  if (!selectedStreamUrl || manualPause) return;

  clearTimeout(reconnectTimer);
  reconnectAttempts += 1;

  const delay = Math.min(3000 + reconnectAttempts * 1000, 10000);
  setStreamStatus(`reconectando por ${reason} en ${Math.round(delay / 1000)}s`);

  reconnectTimer = setTimeout(() => {
    loadStream(selectedStreamUrl, true);
  }, delay);
}

function loadStream(url, reconnect = false) {
  const video = document.querySelector("#videoPlayer");
  const empty = document.querySelector("#playerEmpty");
  const quality = document.querySelector("#qualitySelect");

  if (!video || !url) {
    setStreamStatus("selecciona o pega una URL valida");
    return;
  }

  selectedStreamUrl = url;
  manualPause = false;
  if (!reconnect) reconnectAttempts = 0;

  clearTimeout(reconnectTimer);
  resetPlayer(video);

  if (quality) quality.innerHTML = "<option>Auto</option>";

  if (url.includes(".m3u8") && window.Hls?.isSupported()) {
    hlsInstance = new window.Hls({ enableWorker: true, lowLatencyMode: true });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);

    hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, (_, data) => {
      data.levels?.forEach((level, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = level.height ? `${level.height}p` : `Nivel ${index + 1}`;
        quality?.appendChild(option);
      });

      empty?.classList.add("hidden");
      setStreamStatus(reconnect ? "HLS reconectado" : "HLS cargado");
      video.play().catch(() => {});
    });

    hlsInstance.on(window.Hls.Events.ERROR, (_, data) => {
      if (data.fatal) scheduleReconnect("error del HLS");
      else setStreamStatus("buffering o reconexion");
    });

    return;
  }

  video.src = url;
  empty?.classList.add("hidden");
  setStreamStatus(reconnect ? "stream reconectado" : "stream cargado");
  video.play().catch(() => {});
}

document.querySelector("#themeButton")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

search?.addEventListener("input", () => {
  renderEvents(document.querySelector(".filters .active")?.dataset.cat || "Todos");
});

document.querySelector("#streamSelect")?.addEventListener("change", (event) => {
  const input = document.querySelector("#streamUrl");
  selectedStreamUrl = event.target.value;
  if (input) input.value = selectedStreamUrl;
});

document.querySelector("#loadStream")?.addEventListener("click", () => {
  const input = document.querySelector("#streamUrl");
  const select = document.querySelector("#streamSelect");
  loadStream(input?.value.trim() || select?.value.trim());
});

document.querySelector("#loadDemo")?.addEventListener("click", () => {
  const input = document.querySelector("#streamUrl");
  if (input) input.value = demoStream;
  loadStream(demoStream);
});

document.querySelector("#playButton")?.addEventListener("click", () => {
  manualPause = false;
  document.querySelector("#videoPlayer")?.play();
});

document.querySelector("#pauseButton")?.addEventListener("click", () => {
  manualPause = true;
  clearTimeout(reconnectTimer);
  document.querySelector("#videoPlayer")?.pause();
});

document.querySelector("#volumeSlider")?.addEventListener("input", (event) => {
  const video = document.querySelector("#videoPlayer");
  if (video) video.volume = Number(event.target.value);
});

document.querySelector("#fullscreenButton")?.addEventListener("click", () => {
  document.querySelector("#videoPlayer")?.requestFullscreen?.();
});

document.querySelector("#qualitySelect")?.addEventListener("change", (event) => {
  if (hlsInstance) hlsInstance.currentLevel = event.target.value === "Auto" ? -1 : Number(event.target.value);
});

const video = document.querySelector("#videoPlayer");

if (video) {
  video.addEventListener("playing", () => {
    reconnectAttempts = 0;
    setStreamStatus("reproduciendo");
  });

  video.addEventListener("pause", () => {
    if (!manualPause && !video.ended) scheduleReconnect("pausa inesperada");
  });

  video.addEventListener("ended", () => scheduleReconnect("fin del video"));
  video.addEventListener("error", () => scheduleReconnect("error del video"));
  video.addEventListener("stalled", () => scheduleReconnect("stream detenido"));
  video.addEventListener("waiting", () => setStreamStatus("buffering"));
}

renderFilters();
renderEvents();
renderAgenda();
renderChannels();
selectEvent("arena");
setStreamStatus("esperando fuente autorizada");