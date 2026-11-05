/* Spoilervrije speler: één <audio>-element met de 30 s Spotify-preview (mp3). Geen iframe, geen embed.
   Het element wordt nooit vervangen. In de eerste tik (Hitster.unlock) speelt het element synchroon een
   stil geluidje: daarmee mag iOS het element daarna ook zonder tik van bron laten wisselen en afspelen. */
(function () {
  const $ = id => document.getElementById(id);
  const A_OK = /^[A-Za-z0-9]{20,64}$/;
  const PREVIEW = "https://p.scdn.co/mp3-preview/";
  const H = {A_OK, auto: false};

  const dbg = (function () {
    if (!/[?&]debug=1/.test(location.search)) return () => {};
    const el = document.createElement("pre");
    el.style.cssText = "position:fixed;left:0;right:0;top:0;max-height:38vh;overflow:auto;margin:0;padding:6px;z-index:99;background:rgba(30,46,30,.92);color:#E8EFE4;font:10px/1.3 monospace;text-align:left;white-space:pre-wrap";
    document.body.appendChild(el);
    return m => { el.textContent += ((performance.now() / 1000).toFixed(2) + " " + m + "\n"); el.scrollTop = el.scrollHeight; };
  })();
  H.log = dbg;

  // 0,25 s stilte als WAV (8 kHz, 8 bit mono), zodat er geen extra bestand nodig is.
  function silentWav() {
    const n = 2000, b = new Uint8Array(44 + n);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    const u32 = (o, v) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = v >>> 24; };
    w(0, "RIFF"); u32(4, 36 + n); w(8, "WAVEfmt "); u32(16, 16);
    b[20] = 1; b[22] = 1; u32(24, 8000); u32(28, 8000); b[32] = 1; b[34] = 8;
    w(36, "data"); u32(40, n); b.fill(128, 44);
    let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return "data:audio/wav;base64," + btoa(s);
  }

  const audio = new Audio();
  audio.preload = "auto"; audio.setAttribute("playsinline", "");
  let wantA = "", srcs = [], srcIdx = 0, token = 0, unlocked = false, tHint = null, tLoad = 0;
  const SILENT = silentWav();

  const hint = t => { $("hint").textContent = t; };
  const tapHint = () => { $("play").classList.add("pulse"); hint("Tik op de grote knop om af te spelen."); };
  function setUi(playing) {
    $("play").innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
    if (playing) { $("play").classList.remove("pulse"); clearTimeout(tHint); hint("Je hoort een preview van 30 seconden."); }
  }
  const isReal = () => !!wantA && srcs.length > 0 && audio.src === srcs[srcIdx].u;

  ["loadstart", "loadedmetadata", "canplay", "waiting", "stalled", "ended"].forEach(ev =>
    audio.addEventListener(ev, () => { if (isReal() || ev === "loadstart") dbg("audio " + ev + " t=" + audio.currentTime.toFixed(2)); }));
  audio.addEventListener("playing", () => {
    if (!isReal()) return;
    dbg("playing t=" + audio.currentTime.toFixed(2) + " (" + Math.round(performance.now() - tLoad) + " ms na load)");
    setUi(true);
  });
  audio.addEventListener("pause", () => { if (isReal()) { dbg("pause t=" + audio.currentTime.toFixed(2)); setUi(false); } });
  audio.addEventListener("ended", () => { if (isReal()) setUi(false); });
  function tryNext(tok) {
    if (tok !== token || srcIdx + 1 >= srcs.length) return false;
    srcIdx++;
    dbg("bron " + srcs[srcIdx].b + " (reserve)");
    audio.src = srcs[srcIdx].u;
    try { audio.currentTime = 0; } catch (e) {}
    startPlay(tok, "reserve");
    return true;
  }
  audio.addEventListener("error", () => {
    if (!isReal()) return;
    const c = audio.error ? audio.error.code : "?";
    dbg("audio fout code " + c + " bij bron " + srcs[srcIdx].b);
    if (tryNext(token)) return;
    hint("Dit fragment kan niet worden afgespeeld (fout " + c + "). Controleer je verbinding of scan het kaartje opnieuw.");
  });

  function startPlay(tok, from) {
    if (tok !== token) return;
    let p;
    try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
    if (p && p.then) p.then(
      () => dbg("play ok (" + from + ") t=" + audio.currentTime.toFixed(2)),
      e => { if (tok !== token) return; dbg("play GEBLOKKEERD (" + from + "): " + (e && e.name)); tapHint(); });
  }

  // Moet synchroon in een tik worden aangeroepen (Start camera).
  H.prepare = function () {};
  H.unlock = function () {
    if (unlocked) return;
    unlocked = true;
    dbg("unlock: stil geluid in tik");
    try {
      audio.src = SILENT; audio.muted = false; audio.volume = 1;
      const p = audio.play();
      if (p && p.then) p.then(() => dbg("unlock ok"), e => { unlocked = false; dbg("unlock GEBLOKKEERD: " + (e && e.name)); });
    } catch (e) { unlocked = false; dbg("unlock fout " + e); }
  };

  // Kaartcode -> preview-code via kaarten.json (zonder titels); altijd vers ophalen zodat een site-update direct werkt.
  let map = null, mapP = null;
  function getMap() {
    if (!mapP) {
      mapP = fetch("../kaarten.json?x=" + Date.now(), {cache: "no-store"})
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(m => { map = m; dbg("kaarten.json geladen: " + Object.keys(m).length + " codes"); return m; })
        .catch(e => { mapP = null; dbg("kaarten.json fout: " + e); throw e; });
    }
    return mapP;
  }
  getMap().catch(() => {});

  H.load = function (arg, auto) {
    if (typeof arg === "string") arg = {a: arg};
    arg = arg || {};
    clearTimeout(tHint);
    token++;
    const tok = token;
    try { audio.pause(); } catch (e) {}
    setUi(false);
    $("play").classList.remove("pulse");
    wantA = ""; srcs = []; $("play").disabled = true;
    if (arg.k) {
      const k = String(arg.k);
      const use = m => {
        if (tok !== token) return;
        if (m && m[k]) go(m[k], auto, tok, k);
        else { dbg("kaartcode onbekend: " + k); hint("Dit kaartje is onbekend. Is de site al bijgewerkt met dit kaartje?"); }
      };
      if (map) { use(map); return; }
      hint("Laden...");
      getMap().then(use, () => { if (tok === token) hint("De kaartenlijst kon niet worden geladen. Controleer je internetverbinding en scan opnieuw."); });
      return;
    }
    go(arg.a || (arg.t ? "oud" : ""), auto, tok);
  };

  // Kaartvermelding (lijst van {b, u}; oude vorm: alleen een Spotify-previewcode) naar bronnenlijst.
  function toSources(a) {
    if (Array.isArray(a)) return a.filter(x => x && /^https:\/\//.test(x.u || ""));
    if (typeof a === "string" && A_OK.test(a)) return [{b: "spotify", u: PREVIEW + a}];
    return [];
  }

  function go(a, auto, tok, k) {
    const list = toSources(a);
    if (!list.length) {
      wantA = ""; srcs = []; $("play").disabled = true;
      hint(a === "oud" ? "Dit is een oud kaartje zonder geluidscode. Print de kaartjes opnieuw." : "Dit kaartje heeft geen geldige code.");
      return;
    }
    wantA = k || String(a); srcs = list; srcIdx = 0; H.auto = !!auto;
    $("play").disabled = false;
    hint("Laden...");
    tLoad = performance.now();
    dbg("bron " + list[0].b + " " + list[0].u.slice(-14) + " (auto=" + H.auto + ", " + list.length + " bron(nen))");
    audio.src = list[0].u;
    try { audio.currentTime = 0; } catch (e) {}
    if (H.auto) startPlay(tok, "scan"); else tapHint();
    tHint = setTimeout(() => { if (tok === token && audio.paused) { dbg("speelt niet na 1,5 s: tikhint"); tapHint(); } }, 1500);
  }

  // 'Scan volgende': alleen pauzeren en vergeten; het element blijft bestaan (en ontgrendeld).
  H.stop = function () {
    clearTimeout(tHint);
    token++;
    wantA = ""; srcs = []; H.auto = false;
    try { audio.pause(); } catch (e) {}
    dbg("stop: pause");
    setUi(false);
    $("play").classList.remove("pulse");
    $("play").disabled = true;
    hint("");
  };

  $("play").onclick = () => {
    if (!wantA) return;
    H.auto = true; token++;
    dbg("klik: " + (audio.paused ? "play" : "pause") + " t=" + audio.currentTime.toFixed(2));
    if (!audio.paused) { try { audio.pause(); } catch (e) {} return; }
    if (audio.ended) { try { audio.currentTime = 0; } catch (e) {} }
    startPlay(token, "klik");
    clearTimeout(tHint);
  };
  window.Hitster = H;
})();


