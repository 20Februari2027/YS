(function () {
  const $ = id => document.getElementById(id);
  const video = $("video"), canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  let stream = null, scanning = false;

  function msg(t) { $("scanmsg").textContent = t; }

  function parse(data) {
    try {
      const u = new URL(data);
      if (!/\/p\/?$/.test(u.pathname)) return null;
      const t = u.searchParams.get("t") || "", y = u.searchParams.get("y") || "";
      if (!(Hitster.SP_OK.test(t) || Hitster.YT_OK.test(y))) return null;
      return {t, y};
    } catch (e) { return null; }
  }

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
        msg("Dit is geen Hitster-kaartje, probeer een ander kaartje.");
      }
    }
    setTimeout(() => requestAnimationFrame(tick), 120);
  }

  function found(r) {
    scanning = false;
    $("scanner").hidden = true;
    $("cover").hidden = false;
    Hitster.load(r.t, r.y, true);
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg("Camera is niet beschikbaar. Open deze pagina via https:// of http://localhost.");
      return;
    }
    try {
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false});
        } catch (e) {
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
    $("cover").hidden = true; $("scanner").hidden = false;
    msg("Houd een kaartje voor de camera.");
    if (stream) { scanning = true; tick(); } else start();
  };
})();
