/* Scanpagina: webcam -> jsQR -> Hitster.load(...). Eén tik start de camera en maakt de speler klaar. */
(function () {
  const $ = id => document.getElementById(id);
  const video = $("video"), canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  let stream = null, scanning = false;

  const msg = t => { $("scanmsg").textContent = t; };

  const ID = /^[A-Za-z0-9]{22}$/;
  // Accepteert onze kaart-URL (elk pad, ?t=), een Spotify-tracklink/-URI of alleen het 22-tekens ID.
  function parse(data) {
    const s = String(data || "").trim();
    if (ID.test(s)) return {t: s};
    let m = s.match(/spotify:track:([A-Za-z0-9]{22})/i) || s.match(/open\.spotify\.com\/(?:[\w-]+\/)?track\/([A-Za-z0-9]{22})/i);
    if (m) return {t: m[1]};
    try {
      const u = new URL(s);
      const t = (u.searchParams.get("t") || "").trim();
      if (ID.test(t)) return {t};
    } catch (e) {}
    m = s.match(/[?&]t=([A-Za-z0-9]{22})(?![A-Za-z0-9])/);
    return m ? {t: m[1]} : null;
  }

  let lastBad = "";
  function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, {inversionAttempts: "attemptBoth"});
      if (code && code.data) {
        const r = parse(code.data);
        if (r) { found(r); return; }
        if (code.data !== lastBad) { lastBad = code.data; msg("Dit is geen Hitster-kaartje. Gelezen: \u201c" + code.data.slice(0, 60) + "\u201d. Probeer een ander kaartje."); }
      }
    }
    setTimeout(() => requestAnimationFrame(tick), 120);
  }

  function found(r) {
    scanning = false;
    video.pause();
    $("scanner").hidden = true;
    Hitster.load(r.t, true);
  }

  async function start() {
    Hitster.prepare();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg("Camera is niet beschikbaar. Open deze pagina via https:// of http://localhost.");
      return;
    }
    try {
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false});
        } catch (e) {
          if (e && e.name === "NotAllowedError") throw e;
          stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        }
        video.srcObject = stream;
      }
      await video.play();
      $("startcam").hidden = true; $("viewfinder").hidden = false;
      msg("Houd een kaartje voor de camera.");
      scanning = true; tick();
    } catch (e) {
      msg(e && e.name === "NotAllowedError"
        ? "Geen toegang tot de camera. Sta de camera toe in je browser en probeer opnieuw."
        : "Geen camera gevonden of de camera is in gebruik.");
    }
  }

  $("startcam").onclick = start;
  $("next").onclick = () => {
    Hitster.stop();
    $("scanner").hidden = false;
    msg("Houd een kaartje voor de camera.");
    if (stream) { video.play(); scanning = true; tick(); } else start();
  };
})();

