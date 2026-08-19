(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/atmosphere.css";
  css.id = "eoi-atmosphere-css";
  document.head.appendChild(css);

  function frac(n) {
    var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function makeSmokeLayer(target, index) {
    var layer = document.createElement("span");
    layer.className = "eoi-smoke-layer";
    layer.setAttribute("aria-hidden", "true");

    for (var i = 0; i < 5; i++) {
      var wisp = document.createElement("i");
      wisp.className = "eoi-smoke-wisp";
      var seed = index * 17 + i * 7 + 3;
      wisp.style.setProperty("--x", (8 + frac(seed) * 78).toFixed(1) + "%");
      wisp.style.setProperty("--y", (18 + frac(seed + 1) * 62).toFixed(1) + "%");
      wisp.style.setProperty("--size", Math.round(120 + frac(seed + 2) * 210) + "px");
      wisp.style.setProperty("--blur", Math.round(12 + frac(seed + 3) * 14) + "px");
      wisp.style.setProperty("--delay", (frac(seed + 4) * .42).toFixed(2) + "s");
      wisp.style.setProperty("--duration", (2.0 + frac(seed + 5) * 1.35).toFixed(2) + "s");
      layer.appendChild(wisp);
    }

    target.insertBefore(layer, target.firstChild);
  }

  function makeInkLayer(target, index) {
    var layer = document.createElement("span");
    layer.className = "eoi-ink-bloom-layer";
    layer.setAttribute("aria-hidden", "true");

    for (var i = 0; i < 4; i++) {
      var blot = document.createElement("i");
      blot.className = "eoi-ink-blot";
      var seed = index * 29 + i * 11 + 5;
      blot.style.setProperty("--x", (18 + frac(seed) * 64).toFixed(1) + "%");
      blot.style.setProperty("--y", (28 + frac(seed + 1) * 46).toFixed(1) + "%");
      blot.style.setProperty("--size", Math.round(80 + frac(seed + 2) * 150) + "px");
      blot.style.setProperty("--blur", Math.round(4 + frac(seed + 3) * 7) + "px");
      blot.style.setProperty("--rot", Math.round(-20 + frac(seed + 4) * 40) + "deg");
      blot.style.setProperty("--delay", (.12 + frac(seed + 5) * .34).toFixed(2) + "s");
      layer.appendChild(blot);
    }

    target.insertBefore(layer, target.firstChild);
  }

  function prepareTextEffects() {
    var smokeTargets = Array.prototype.slice.call(document.querySelectorAll(
      ".premium-eoi .hero h1, " +
      ".premium-eoi .artist-section .editorial-title, " +
      ".premium-eoi #work h2, " +
      ".premium-eoi .shout .ink, " +
      ".premium-eoi .hide h2, " +
      ".premium-eoi #book h2"
    ));

    var inkTargets = Array.prototype.slice.call(document.querySelectorAll(
      ".premium-eoi .process-step h3, " +
      ".premium-eoi .editorial-copy, " +
      ".premium-eoi #work .kicker, " +
      ".premium-eoi .book-card > .kicker"
    ));

    smokeTargets.forEach(function (target, index) {
      if (target.classList.contains("eoi-smoke-reveal")) return;
      target.classList.add("eoi-atmosphere-host", "eoi-smoke-reveal");
      target.setAttribute("data-smoke-text", target.textContent.trim());
      if (!reduce) {
        makeSmokeLayer(target, index);
        makeInkLayer(target, index + 17);
      }
    });

    inkTargets.forEach(function (target) {
      target.classList.add("eoi-ink-reveal");
    });

    var targets = smokeTargets.concat(inkTargets);
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach(function (target) {
        target.classList.add("eoi-revealed", "eoi-atmosphere-active");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("eoi-revealed", "eoi-atmosphere-active");
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -10% 0px",
      threshold: .18
    });

    targets.forEach(function (target) { observer.observe(target); });
  }

  function skeletonMarkup() {
    return '' +
      '<div class="eoi-skeleton-smoke"></div>' +
      '<svg class="eoi-skeleton" viewBox="0 0 120 210" xmlns="http://www.w3.org/2000/svg" role="presentation">' +
        '<g class="sk-head">' +
          '<path class="skull" d="M46 18 C47 7 72 5 76 19 C80 32 74 45 66 48 L65 56 L54 56 L53 48 C45 44 42 31 46 18 Z" />' +
          '<circle class="eye" cx="54" cy="27" r="3.4"/><circle class="eye" cx="68" cy="27" r="3.4"/>' +
          '<path class="bone bone-soft" d="M57 38 Q61 41 66 38 M55 45 L66 45" />' +
        '</g>' +
        '<path class="bone" d="M59 56 L60 72 M47 68 Q60 61 73 68 M49 74 Q60 82 71 74 M51 82 Q60 90 69 82 M53 91 Q60 97 67 91" />' +
        '<path class="bone bone-soft" d="M60 72 L60 116 M54 93 L66 93 M53 104 L67 104" />' +
        '<path class="bone" d="M49 112 Q60 120 71 112 M52 118 Q60 126 68 118" />' +
        '<g class="sk-arm-left">' +
          '<path class="bone" d="M48 69 L34 91 L29 118" />' +
          '<circle class="joint" cx="34" cy="91" r="2.4"/><circle class="joint" cx="29" cy="118" r="2.1"/>' +
          '<path class="bone bone-soft" d="M29 118 L24 131 M29 119 L28 133 M30 119 L33 132" />' +
        '</g>' +
        '<g class="sk-arm-right">' +
          '<path class="bone" d="M72 69 L86 91 L91 118" />' +
          '<circle class="joint" cx="86" cy="91" r="2.4"/><circle class="joint" cx="91" cy="118" r="2.1"/>' +
          '<path class="bone bone-soft" d="M91 118 L87 132 M91 119 L92 133 M92 119 L97 131" />' +
        '</g>' +
        '<g class="sk-leg-left">' +
          '<path class="bone" d="M55 120 L49 153 L45 187" />' +
          '<circle class="joint" cx="49" cy="153" r="2.5"/><circle class="joint" cx="45" cy="187" r="2.2"/>' +
          '<path class="bone bone-soft" d="M45 187 L37 199 M45 188 L43 201 M46 188 L50 200" />' +
        '</g>' +
        '<g class="sk-leg-right">' +
          '<path class="bone" d="M66 120 L72 153 L76 187" />' +
          '<circle class="joint" cx="72" cy="153" r="2.5"/><circle class="joint" cx="76" cy="187" r="2.2"/>' +
          '<path class="bone bone-soft" d="M76 187 L71 200 M76 188 L78 201 M77 188 L84 198" />' +
        '</g>' +
        '<circle class="joint" cx="60" cy="116" r="3"/>' +
      '</svg>';
  }

  function installSkeleton() {
    if (reduce) return;
    var shout = document.querySelector(".premium-eoi main > .shout:not([hidden])");
    if (!shout || shout.querySelector(".eoi-skeleton-stage")) return;

    var stage = document.createElement("div");
    stage.className = "eoi-skeleton-stage";
    stage.setAttribute("aria-hidden", "true");
    stage.innerHTML = skeletonMarkup();
    shout.appendChild(stage);

    if (!("IntersectionObserver" in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        window.setTimeout(function () { stage.classList.add("is-walking"); }, 420);
        observer.disconnect();
      });
    }, { threshold: .34 });

    observer.observe(shout);
  }

  function boot() {
    prepareTextEffects();
    installSkeleton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
