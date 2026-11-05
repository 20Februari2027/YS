/* Spoilervrije speler: Spotify-embed (iFrame API, 30 s preview zonder login), verborgen onder #cover.
   Eén controller wordt hergebruikt. Elke load krijgt een token; play() wordt pas gestuurd als de embed
   de nieuwe URI meldt (playback_update.playingURI) of na een korte time-out, en alleen voor het actuele token.
   Zo speelt een tweede scan niet het vorige nummer en start 'Scan volgende' niets. */
(function () {
  const $ = id => document.getElementById(id);
  const SP_OK = /^[A-Za-z0-9]{22}$/;
  const WARM = "4cOdK2wGLETKBW3PvgPWqT"; // neutrale track: start-URI en 'rust'-stand
  const WARM_URI = "spotify:track:" + WARM;
  let ctrl = null, loading = false, ready = false, readyN = 0;
  let wantUri = "", token = 0, playSent = false, playing = false, loadedUri = "";
  let tTap = null, tPlay = null;
  const H = {SP_OK};

  const hint = t => { $("hint").textContent = t; };
  const tapHint = () => { $("play").classList.add("pulse"); hint("Tik op de grote knop om af te spelen."); };
  const clearTimers = () => { clearTimeout(tTap); clearTimeout(tPlay); };

  function setPlayingUi(v) {
    playing = v;
    $("play").innerHTML = v ? "&#10074;&#10074;" : "&#9654;";
    if (v) { $("play").classList.remove("pulse"); clearTimeout(tTap); hint("Je hoort een preview van 30 seconden."); }
  }

  function sendPlay(tok) {
    if (tok !== token || !wantUri || !ctrl) return;
    playSent = true;
    dbg("play " + wantUri.slice(-4)); try { ctrl.play(); } catch (e) {}
    clearTimeout(tTap);
    tTap = setTimeout(() => { if (tok === token && !playing) tapHint(); }, 3000);
  }

  // Laad de actuele wens in de (bestaande) controller en start daarna pas play().
  function apply() {
    if (!ready || !ctrl) return;
    if (!wantUri) return;
    const tok = token;
    $("play").disabled = false;
    if (loadedUri !== wantUri) {
      loadedUri = wantUri;
      dbg("loadUri " + wantUri.slice(-4)); try { ctrl.loadUri(wantUri); } catch (e) {}
      playSent = false;
      clearTimeout(tPlay);
      // Time-out als de embed geen playingURI meldt.
      tPlay = setTimeout(() => { if (!playSent) sendPlay(tok); }, 900);
    }
    if (!H.auto) tapHint();
  }

  // De echte API vuurt "ready" na elke loadUri opnieuw af: nooit opnieuw laden om een ready, alleen verder gaan.
  function onReady() {
    if (!wantUri) return;
    if (loadedUri !== wantUri) { apply(); return; }
    $("play").disabled = false;
    if (H.auto && !playSent) { clearTimeout(tPlay); sendPlay(token); }
    else if (!H.auto) tapHint();
  }

  function onUpdate(e) {
    const d = e.data || {};
    const uri = d.playingURI || "";
    // Updates van een ander (oud/rust-)nummer negeren.
    if (wantUri && uri && uri !== wantUri) return;
    if (!wantUri) { setPlayingUi(false); return; }
    if (!playSent && H.auto && uri === wantUri) { clearTimeout(tPlay); sendPlay(token); return; }
    setPlayingUi(!d.isPaused);
  }

  let api = null;
  const dbg = (function () {
    if (!/[?&]debug=1/.test(location.search)) return () => {};
    const el = document.createElement("pre");
    el.style.cssText = "position:fixed;left:0;right:0;top:0;max-height:38vh;overflow:auto;margin:0;padding:6px;z-index:99;background:rgba(30,46,30,.92);color:#E8EFE4;font:10px/1.3 monospace;text-align:left;white-space:pre-wrap";
    document.body.appendChild(el);
    return m => { el.textContent += ((performance.now() / 1000).toFixed(1) + " " + m + "\n"); el.scrollTop = el.scrollHeight; };
  })();
  H.log = dbg;

  function make() {
    if (!api || ctrl) return;
    const uri = wantUri || WARM_URI;
    api.createController($("sp"), {uri, width: "100%", height: 152}, c => {
      ctrl = c; loadedUri = uri; dbg("controller gemaakt " + uri.slice(-4));
      c.addListener("ready", () => { readyN++; ready = true; dbg("ready (" + readyN + "e)"); onReady(); });
      c.addListener("playback_update", e => { const d = e.data || {}; dbg("update " + String(d.playingURI || "").slice(-4) + " paused=" + d.isPaused); onUpdate(e); });
    });
  }

  function ensure() {
    if (ctrl) return;
    if (api) { make(); return; }
    if (loading) return;
    loading = true;
    window.onSpotifyIframeApiReady = a => { api = a; make(); };
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1"; s.async = true;
    document.body.appendChild(s);
  }
  // Moet vanuit een tik worden aangeroepen.
  H.prepare = ensure;
  H.auto = false;

  H.load = function (t, auto) {
    clearTimers();
    token++;
    try { if (ctrl) ctrl.pause(); } catch (e) {}
    setPlayingUi(false);
    if (!SP_OK.test(t || "")) { wantUri = ""; $("play").disabled = true; hint("Dit kaartje heeft geen geldige link."); return; }
    wantUri = "spotify:track:" + t; H.auto = !!auto; playSent = false;
    $("play").disabled = true; $("play").classList.remove("pulse");
    hint("Laden...");
    ensure(); apply();
  };

  // 'Scan volgende': alles annuleren, embed pauzeren en weggooien; direct (binnen de tik) een nieuwe, stille embed aanmaken.
  H.stop = function () {
    clearTimers();
    token++;
    wantUri = ""; playSent = false; H.auto = false;
    dbg("stop: pause + destroy embed");
    try { if (ctrl) ctrl.pause(); } catch (e) {}
    try { if (ctrl && ctrl.destroy) ctrl.destroy(); } catch (e) {}
    ctrl = null; ready = false; loadedUri = "";
    $("under").innerHTML = '<div id="sp"></div>';
    setPlayingUi(false);
    $("play").classList.remove("pulse");
    $("play").disabled = true;
    hint("");
    make();
  };
  $("play").onclick = () => {
    if (!ctrl || !wantUri) return;
    H.auto = true; playSent = true;
    dbg("klik: " + (playing ? "pause" : "play"));
    try { if (playing) ctrl.pause(); else ctrl.play(); } catch (e) {}
  };
  window.Hitster = H;
})();


