(function () {
  var local = location.protocol === "file:";
  if (local) document.documentElement.classList.add("is-local");

  var btn = document.getElementById("sound-toggle");
  var wrap = document.getElementById("yt-wrap");
  var closer = document.getElementById("yt-close");
  var player = null;
  var wanted = true;
  var ready = false;

  function setUi(on) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "Sound on" : "Sound";
  }
  setUi(true);

  if (closer) {
    closer.addEventListener("click", function (e) {
      e.stopPropagation();
      wanted = false;
      try { if (player && ready) player.stopVideo(); } catch (err) {}
      if (wrap) wrap.style.display = "none";
      if (btn) btn.style.display = "none";
    });
  }

  var bolt = document.getElementById("lightning");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (bolt && !reduce) {
    window.setTimeout(function () {
      bolt.classList.add("is-strike");
      window.setTimeout(function () { bolt.classList.remove("is-strike"); }, 800);
    }, 3000 + Math.floor(Math.random() * 2000));
  }

  if (local) return;

  var frame = document.getElementById("yt-floor");
  if (frame) {
    frame.src = "https://www.youtube.com/embed/UimodeZfA9o?autoplay=1&mute=1&loop=1&playlist=UimodeZfA9o&controls=1&rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
  }

  function tryLoud() {
    if (!player || !ready || !wanted) return false;
    try {
      player.unMute();
      player.setVolume(80);
      player.playVideo();
      setUi(true);
      return !player.isMuted();
    } catch (e) {
      return false;
    }
  }

  function playMuted() {
    if (!player || !ready) return;
    try {
      player.mute();
      player.playVideo();
    } catch (e) {}
  }

  function unlock() {
    if (!wanted) return;
    if (tryLoud()) {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    }
  }

  if (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      wanted = !wanted;
      if (wanted) tryLoud();
      else {
        try { if (player && ready) player.mute(); } catch (err) {}
        setUi(false);
      }
    });
  }

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("yt-floor", {
      events: {
        onReady: function () {
          ready = true;
          if (!tryLoud()) playMuted();
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED && wanted) {
            player.seekTo(0);
            tryLoud() || player.playVideo();
          }
        }
      }
    });
  };

  var tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
})();
