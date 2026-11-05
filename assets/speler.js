/* Spoilervrije speler: Spotify-embed (iFrame API, 30 s preview zonder login), verborgen onder #cover.
   Eén controller wordt hergebruikt. Elke load krijgt een token; play() wordt pas gestuurd als de embed
   de nieuwe URI meldt (playback_update.playingURI) of na een korte time-out, en alleen voor het actuele token.
   Zo speelt een tweede scan niet het vorige nummer en start 'Scan volgende' niets. */
(function () {
  const $ = id => document.getElementById(id);
  const SP_OK = /^[A-Za-z0-9]{22}$/;
  const WARM = "4cOdK2wGLETKBW3PvgPWqT"; // neutrale track: start-URI en 'rust'-stand
  const WARM_URI = "spotify:track:" + WARM;
  let ctrl = null, loading = false, ready = false;
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
    try { ctrl.play(); } catch (e) {}
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
      try { ctrl.loadUri(wantUri); } catch (e) {}
      playSent = false;
      clearTimeout(tPlay);
      // Time-out als de embed geen playingURI meldt.
      tPlay = setTimeout(() => { if (!playSent) sendPlay(tok); }, 900);
    }
    if (!H.auto) tapHint();
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

  function ensure() {
    if (ctrl || loading) return;
    loading = true;
    window.onSpotifyIframeApiReady = api => {
      api.createController($("sp"), {uri: wantUri || WARM_URI, width: "100%", height: 152}, c => {
        ctrl = c; loadedUri = wantUri || WARM_URI;
        c.addListener("ready", () => { ready = true; if (wantUri) { loadedUri = ""; } apply(); });
        c.addListener("playback_update", onUpdate);
      });
    };
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

  // 'Scan volgende': alles annuleren, pauzeren en terug naar de neutrale track zodat er niets nawerkt.
  H.stop = function () {
    clearTimers();
    token++;
    wantUri = ""; playSent = false; H.auto = false;
    try { if (ctrl) { ctrl.pause(); if (loadedUri !== WARM_URI) { ctrl.loadUri(WARM_URI); loadedUri = WARM_URI; } } } catch (e) {}
    setPlayingUi(false);
    $("play").classList.remove("pulse");
  };

  $("play").onclick = () => {
    if (!ctrl || !wantUri) return;
    H.auto = true; playSent = true;
    ctrl.togglePlay();
  };

  window.Hitster = H;
})();
