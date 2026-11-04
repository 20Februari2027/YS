(function () {
  const $ = id => document.getElementById(id);
  const SP_OK = /^[A-Za-z0-9]{22}$/, YT_OK = /^[\w-]{11}$/;
  let SPOTIFY = "", YOUTUBE = "", mode = "none";
  let sp = null, spLoading = false, spApi = null, yt = null, ytLoading = false, ytApi = false;
  let wantPlay = false, token = 0;

  const setIcon = playing => { $("play").innerHTML = playing ? "&#10074;&#10074;" : "&#9654;"; };
  const hint = t => { $("hint").textContent = t; };
  const showAlt = on => { $("alt").hidden = !(on && YOUTUBE); };
  const enable = () => { $("play").disabled = false; hint(""); };

  function ensureSpotify() {
    const uri = "spotify:track:" + SPOTIFY;
    if (sp) { sp.loadUri(uri); enable(); if (wantPlay) sp.play(); return; }
    if (spLoading) return;
    spLoading = true;
    window.onSpotifyIframeApiReady = api => {
      spApi = api;
      api.createController($("sp"), {uri: "spotify:track:" + SPOTIFY, width: "100%", height: 152}, c => {
        sp = c;
        c.addListener("ready", () => { if (mode === "spotify") { enable(); if (wantPlay) c.play(); } });
        c.addListener("playback_update", e => {
          const d = e.data;
          if (mode === "spotify") setIcon(!d.isPaused);
          if (mode === "spotify" && d.duration > 0 && d.duration <= 31000 && !d.isPaused)
            hint("Je hoort nu een preview van 30 seconden. Log in bij open.spotify.com (Premium) voor het hele nummer.");
        });
      });
    };
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1"; s.async = true;
    document.body.appendChild(s);
    const my = token;
    setTimeout(() => { if (!sp && my === token && mode === "spotify") { hint("Spotify laadt niet."); showAlt(true); } }, 8000);
  }

  function ensureYouTube() {
    if (yt) { wantPlay ? yt.loadVideoById(YOUTUBE) : yt.cueVideoById(YOUTUBE); enable(); return; }
    if (ytLoading) return;
    ytLoading = true;
    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player("yt", {height: "200", width: "200", videoId: YOUTUBE, playerVars: {playsinline: 1},
        events: {
          onReady: () => { if (mode === "youtube") { enable(); if (wantPlay) yt.playVideo(); } },
          onStateChange: e => { if (mode === "youtube") setIcon(e.data === 1); }
        }});
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(s);
  }

  function stop() {
    token++; wantPlay = false;
    try { if (sp) sp.pause(); } catch (e) {}
    try { if (yt && yt.pauseVideo) yt.pauseVideo(); } catch (e) {}
  }

  function load(t, y, autoplay) {
    stop();
    SPOTIFY = SP_OK.test(t || "") ? t : "";
    YOUTUBE = YT_OK.test(y || "") ? y : "";
    mode = SPOTIFY ? "spotify" : (YOUTUBE ? "youtube" : "none");
    wantPlay = !!autoplay; setIcon(false); showAlt(false);
    if (mode === "none") { $("play").disabled = true; hint("Geen afspeelbare link voor dit kaartje."); return false; }
    $("play").disabled = true; hint("Laden...");
    if (mode === "spotify") { ensureSpotify(); showAlt(true); } else ensureYouTube();
    return true;
  }

  $("play").onclick = () => {
    if (mode === "spotify" && sp) sp.togglePlay();
    else if (mode === "youtube" && yt) (yt.getPlayerState() === 1 ? yt.pauseVideo() : yt.playVideo());
  };
  $("alt").onclick = () => {
    if (sp) sp.pause();
    mode = "youtube"; showAlt(false); setIcon(false); hint("Laden...");
    $("play").disabled = true; wantPlay = true; ensureYouTube();
  };

  window.Hitster = {load, stop, SP_OK, YT_OK};
})();
