(function () {
  "use strict";

  var hero = document.getElementById("hero-videos");
  if (!hero) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 1100px) and (pointer: fine)").matches;
  var tablet = window.matchMedia("(min-width: 700px) and (max-width: 1099px)").matches;
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(connection && connection.saveData);

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/hero-reel.css";
  css.id = "eoi-hero-reel-css";
  document.head.appendChild(css);

  var videos = Array.prototype.slice.call(hero.querySelectorAll("video"));
  var images = Array.prototype.slice.call(hero.querySelectorAll("img"));

  videos.forEach(function (video, index) {
    video.classList.add("eoi-hero-video");
    video.dataset.heroIndex = String(index);
    video.muted = true;
    video.playsInline = true;
    video.removeAttribute("autoplay");
    video.loop = false;
    video.pause();
  });

  images.forEach(function (image, index) {
    image.classList.add("eoi-hero-poster");
    image.dataset.heroIndex = String(index);
  });

  function safePlay(video) {
    if (!video) return;
    var promise = video.play();
    if (promise && typeof promise.catch === "function") promise.catch(function () {});
  }

  function stopAll() {
    videos.forEach(function (video) {
      video.pause();
      video.classList.remove("is-active", "is-next");
    });
  }

  function useStatic() {
    stopAll();
    hero.classList.remove("eoi-hero-reel", "eoi-hero-single");
    hero.classList.add("eoi-hero-static");
    images.forEach(function (image, index) {
      image.classList.toggle("is-active", index === 0);
    });
  }

  function useSingleVideo() {
    stopAll();
    hero.classList.remove("eoi-hero-reel", "eoi-hero-static");
    hero.classList.add("eoi-hero-single");
    images.forEach(function (image) { image.classList.remove("is-active"); });
    if (!videos[0]) return useStatic();
    videos[0].loop = true;
    videos[0].preload = "metadata";
    videos[0].classList.add("is-active");
    safePlay(videos[0]);
  }

  function useDesktopReel() {
    if (videos.length < 2) return useSingleVideo();

    stopAll();
    hero.classList.remove("eoi-hero-single", "eoi-hero-static");
    hero.classList.add("eoi-hero-reel");
    images.forEach(function (image) { image.classList.remove("is-active"); });

    var current = 0;
    var transitioning = false;

    videos.forEach(function (video, index) {
      video.loop = false;
      video.preload = index < 2 ? "auto" : "metadata";
      video.currentTime = 0;
    });

    function activate(index, immediate) {
      var previous = videos[current];
      var next = videos[index];
      if (!next) return;

      transitioning = true;
      next.currentTime = 0;
      next.classList.add("is-next");
      safePlay(next);

      requestAnimationFrame(function () {
        next.classList.add("is-active");
        next.classList.remove("is-next");
        if (!immediate && previous && previous !== next) previous.classList.remove("is-active");

        window.setTimeout(function () {
          if (previous && previous !== next) {
            previous.pause();
            previous.currentTime = 0;
          }
          current = index;
          transitioning = false;
          var preload = videos[(current + 1) % videos.length];
          if (preload) preload.preload = "auto";
        }, immediate ? 0 : 1050);
      });
    }

    videos.forEach(function (video, index) {
      video.addEventListener("timeupdate", function () {
        if (index !== current || transitioning || !isFinite(video.duration) || video.duration <= 0) return;
        if (video.duration - video.currentTime <= 1.15) {
          activate((current + 1) % videos.length, false);
        }
      });
      video.addEventListener("ended", function () {
        if (index !== current || transitioning) return;
        activate((current + 1) % videos.length, false);
      });
      video.addEventListener("error", function () {
        if (index !== current) return;
        activate((current + 1) % videos.length, false);
      });
    });

    videos[0].classList.add("is-active");
    safePlay(videos[0]);
  }

  if (reduce || saveData) useStatic();
  else if (desktop) useDesktopReel();
  else if (tablet) useSingleVideo();
  else useStatic();

  // Replace the existing button node so the legacy inline audio handler cannot
  // compete with this playlist controller, regardless of script load order.
  var oldButton = document.getElementById("sound-toggle");
  var button = oldButton;
  if (oldButton && oldButton.parentNode) {
    button = oldButton.cloneNode(true);
    oldButton.parentNode.replaceChild(button, oldButton);
  }

  if (!button) return;

  var tracks = [
    "assets/audio/track-1.mp3",
    "assets/audio/track-2.mp3",
    "assets/audio/track-3.mp3",
    "assets/audio/track-4.mp3"
  ];
  var trackIndex = 0;
  var audio = new Audio(tracks[trackIndex]);
  audio.preload = "metadata";
  audio.volume = 0.72;

  function setSoundState(on) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.textContent = on ? "Sound on" : "Play soundtrack";
  }

  function playCurrentTrack() {
    var promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(function () { setSoundState(false); });
    }
  }

  audio.addEventListener("ended", function () {
    trackIndex = (trackIndex + 1) % tracks.length;
    audio.src = tracks[trackIndex];
    playCurrentTrack();
  });

  audio.addEventListener("error", function () {
    trackIndex = (trackIndex + 1) % tracks.length;
    audio.src = tracks[trackIndex];
    if (button.getAttribute("aria-pressed") === "true") playCurrentTrack();
  });

  setSoundState(false);
  button.addEventListener("click", function () {
    var on = button.getAttribute("aria-pressed") !== "true";
    if (on) playCurrentTrack();
    else audio.pause();
    setSoundState(on);
  });
})();