/* Scanpagina: camera -> QR (BarcodeDetector of jsQR) -> Hitster.load(code). Eén tik start de camera en ontgrendelt het geluid. */
(function () {
  const $ = id => document.getElementById(id);
  const video = $("video"), canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  const SIZE = 480;
  let stream = null, scanning = false;
  const msg = t => { $("scanmsg").textContent = t; };
  const log = m => { if (window.Hitster && Hitster.log) Hitster.log(m); };

  const CODE = /^[A-Za-z0-9]{20,64}$/;
  // Kaart-QR: <site>/p/?a=<code>. Oude kaartjes (?t=<Spotify-ID>) hebben geen geluidscode.
  function parse(data) {
    const s = String(data || "").trim();
    let m = s.match(/[?&]a=([A-Za-z0-9]{20,64})(?![A-Za-z0-9])/);
    if (m) return {a: m[1]};
    m = s.match(/p\.scdn\.co\/mp3-preview\/([A-Za-z0-9]{20,64})/i);
    if (m) return {a: m[1]};
    if (/[?&]t=[A-Za-z0-9]{22}(?![A-Za-z0-9])/.test(s)) return {a: "oud"};
    return null;
  }

  const GAP_MS = 1500;
  let lastBad = "", lastId = "", blocked = false, noQrSince = 0;
  let detector = null, stats = {n: 0, ms: 0};
  if ("BarcodeDetector" in window) {
    try { detector = new BarcodeDetector({formats: ["qr_code"]}); } catch (e) { detector = null; }
  }

  async function decode() {
    const t0 = performance.now();
    let data = "";
    if (detector) {
      try { const r = await detector.detect(canvas); if (r.length) data = r[0].rawValue; }
      catch (e) { log("BarcodeDetector fout, jsQR: " + e); detector = null; }
    }
    if (!detector && !data) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, {inversionAttempts: "dontInvert"});
      if (code && code.data) data = code.data;
    }
    stats.n++; stats.ms += performance.now() - t0;
    if (stats.n === 150) { log("decodeertijd gem. " + (stats.ms / 150).toFixed(1) + " ms/frame (" + (detector ? "BarcodeDetector" : "jsQR") + ")"); stats = {n: 0, ms: 0}; }
    return data;
  }

  let pending = false;
  function schedule() {
    if (!scanning || pending) return;
    pending = true;
    const go = () => { if (!pending) return; pending = false; tick(); };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(go); else requestAnimationFrame(go);
    setTimeout(go, 250); // vangnet als er geen videoframe-callback komt
  }

  // Midden-vierkant van het beeld (zelfde als het richtkader), geschaald naar SIZE px.
  async function tick() {
    if (!scanning) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const side = Math.min(video.videoWidth, video.videoHeight);
      const out = Math.min(SIZE, side);
      canvas.width = out; canvas.height = out;
      ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, out, out);
      const data = await decode();
      if (!scanning) return;
      const now = Date.now();
      if (data) {
        noQrSince = 0;
        const r = parse(data);
        if (r && blocked && r.a === lastId) {
          if (lastBad !== "same") { lastBad = "same"; log("genegeerd: zelfde kaartje nog in beeld " + r.a.slice(0, 6)); }
          msg("Haal het vorige kaartje weg en houd een nieuw kaartje voor de camera.");
        } else if (r) {
          log("geaccepteerd " + r.a.slice(0, 6) + (blocked ? " (ander kaartje)" : ""));
          found(r); return;
        } else if (data !== lastBad) {
          lastBad = data;
          log("geen kaartje: " + data.slice(0, 40));
          msg("Dit is geen kaartje van dit spel. Gelezen: \u201c" + data.slice(0, 60) + "\u201d. Probeer een ander kaartje.");
        }
      } else {
        if (!noQrSince) noQrSince = now;
        if (blocked && now - noQrSince >= GAP_MS) {
          blocked = false; lastBad = "";
          log("geen QR in beeld >= " + GAP_MS + " ms: scanner vrij");
          msg("Houd een kaartje voor de camera.");
        }
      }
    }
    schedule();
  }

  function found(r) {
    scanning = false;
    $("scanner").hidden = true;
    lastId = r.a; blocked = false;
    Hitster.load(r.a, true);
  }

  async function start() {
    Hitster.unlock(); // synchroon in de tik
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg("Camera is niet beschikbaar. Open deze pagina via https:// of http://localhost.");
      return;
    }
    try {
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment", width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
        } catch (e) {
          if (e && e.name === "NotAllowedError") throw e;
          stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        }
        video.srcObject = stream;
        try {
          const tr = stream.getVideoTracks()[0];
          const caps = tr.getCapabilities ? tr.getCapabilities() : {};
          if (caps.focusMode && caps.focusMode.indexOf("continuous") > -1) await tr.applyConstraints({advanced: [{focusMode: "continuous"}]});
          const s = tr.getSettings ? tr.getSettings() : {};
          log("camera " + s.width + "x" + s.height);
        } catch (e) {}
      }
      await video.play();
      $("startcam").hidden = true; $("viewfinder").hidden = false;
      msg("Houd een kaartje voor de camera.");
      scanning = true; schedule();
    } catch (e) {
      msg(e && e.name === "NotAllowedError"
        ? "Geen toegang tot de camera. Sta de camera toe in je browser en probeer opnieuw."
        : "Geen camera gevonden of de camera is in gebruik.");
    }
  }

  $("startcam").onclick = start;
  $("next").onclick = () => {
    log("scan volgende getikt");
    Hitster.stop();
    blocked = true; noQrSince = 0; lastBad = "";
    $("scanner").hidden = false;
    msg("Haal het vorige kaartje weg en houd een nieuw kaartje voor de camera.");
    if (stream) { video.play(); scanning = true; schedule(); } else start();
  };
  window.HitsterScan = {parse};
})();

