/* Spoilervrije speler: Spotify-embed (iFrame API, 30 s preview zonder login), verborgen onder #cover. */
(function () {
  const $ = id => document.getElementById(id);
  const SP_OK = /^[A-Za-z0-9]{22}$/;
  const WARM = "4cOdK2wGLETKBW3PvgPWqT"; // neutrale track om de speler bij de eerste tik aan te maken
  let ctrl = null, loading = false, ready = false;
  let want = "", autoplay = false, playing = false, timer = null, loaded = "";
  const H = {SP_OK};

  const hint = t => { $("hint").textContent = t; };
  const tapHint = () => { $("play").classList.add("pulse"); hint("Tik op de grote knop om af te spelen."); };

  function setPlaying(v) {
    playing = v;
    $("play").innerHTML = v ? "&#10074;&#10074;" : "&#9654;";
    if (v) { $("play").classList.remove("pulse"); clearTimeout(timer); hint("Je hoort een preview van 30 seconden."); }
  }

  function apply() {
    if (!ready || !want) return;
    const uri = "spotify:track:" + want;
    $("play").disabled = false;
    if (loaded !== uri) { ctrl.loadUri(uri); loaded = uri; }
    if (autoplay) {
      ctrl.play();
      clearTimeout(timer);
      timer = setTimeout(() => { if (!playing) tapHint(); }, 3000);
    } else tapHint();
  }

  function ensure() {
    if (ctrl || loading) return;
    loading = true;
    window.onSpotifyIframeApiReady = api => {
      api.createController($("sp"), {uri: "spotify:track:" + (want || WARM), width: "100%", height: 152}, c => {
        ctrl = c; loaded = "spotify:track:" + (want || WARM);
        c.addListener("ready", () => { ready = true; apply(); });
        c.addListener("playback_update", e => setPlaying(!e.data.isPaused));
      });
    };
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1"; s.async = true;
    document.body.appendChild(s);
  }

  // Moet vanuit een tik worden aangeroepen.
  H.prepare = ensure;

  H.load = function (t, auto) {
    clearTimeout(timer);
    try { if (ctrl) ctrl.pause(); } catch (e) {}
    setPlaying(false);
    if (!SP_OK.test(t || "")) { $("play").disabled = true; hint("Dit kaartje heeft geen geldige link."); return; }
    want = t; autoplay = !!auto;
    $("play").disabled = true; $("play").classList.remove("pulse");
    hint("Laden...");
    ensure(); apply();
  };

  H.stop = function () {
    clearTimeout(timer);
    try { if (ctrl) ctrl.pause(); } catch (e) {}
    setPlaying(false);
  };

  $("play").onclick = () => {
    if (!ctrl) return;
    autoplay = true;
    ctrl.togglePlay();
  };

  window.Hitster = H;
})();
