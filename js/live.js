(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var debug = /(?:\?|&)inkDebug=1(?:&|$)/.test(location.search);

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function magnetize(el) {
    if (!el || !fine || reduce) return;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var x = e.clientX - (r.left + r.width / 2);
      var y = e.clientY - (r.top + r.height / 2);
      el.style.transform = "translate(" + (x * 0.16) + "px," + (y * 0.16) + "px)";
    });
    el.addEventListener("pointerleave", function () { el.style.transform = ""; });
  }

  function installTattooCursor() {
    var oldOrb = document.getElementById("orb");
    if (oldOrb) oldOrb.style.display = "none";
    if (!fine || reduce) return;

    document.documentElement.classList.add("has-orb");
    var style = document.createElement("style");
    style.textContent =
      "#tattoo-machine-cursor{position:fixed;left:0;top:0;width:58px;height:58px;z-index:140;pointer-events:none;opacity:0;transform:translate3d(-100px,-100px,0);transition:opacity .16s ease,filter .16s ease;filter:drop-shadow(0 3px 4px rgba(0,0,0,.58));will-change:transform}" +
      "#tattoo-machine-cursor svg{display:block;width:100%;height:100%;overflow:visible}" +
      "#tattoo-machine-cursor.is-hot{filter:drop-shadow(0 3px 5px rgba(0,0,0,.65)) drop-shadow(0 0 5px rgba(224,180,90,.28))}" +
      "#tattoo-machine-cursor.is-ink .needle{animation:eoi-needle .11s linear infinite alternate}" +
      "@keyframes eoi-needle{from{transform:translate(0,0)}to{transform:translate(-.7px,1.2px)}}" +
      ".mosaic .panel img{opacity:1!important}.mosaic .panel .ink-live{opacity:1!important}#orb{display:none!important}";
    document.head.appendChild(style);

    var cursor = document.createElement("div");
    cursor.id = "tattoo-machine-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML =
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-8 30 31)">' +
      '<path d="M22 39 L13 54" fill="none" stroke="#d7d7d2" stroke-width="4.8" stroke-linecap="round"/>' +
      '<path d="M13 54 L8 62" class="needle" fill="none" stroke="#f3e6d2" stroke-width="1.35" stroke-linecap="round"/>' +
      '<path d="M21 39 L30 41 L34 34 L25 31 Z" fill="#2a1218" stroke="#e0b45a" stroke-width="1.7" stroke-linejoin="round"/>' +
      '<path d="M25 31 L24 16 L32 9 L46 12 L50 22 L42 28 L34 27" fill="none" stroke="#e0b45a" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="31" y="15" width="9" height="12" rx="2.2" fill="#160b10" stroke="#c4a48a" stroke-width="1.4"/>' +
      '<rect x="42" y="17" width="8" height="11" rx="2.2" fill="#160b10" stroke="#c4a48a" stroke-width="1.4"/>' +
      '<path d="M28 12 L49 15" stroke="#f3e6d2" stroke-width="2.1" stroke-linecap="round"/>' +
      '<circle cx="27" cy="12" r="3.2" fill="#8b1e2d" stroke="#e0b45a" stroke-width="1.4"/>' +
      '<path d="M30 39 L38 45" stroke="#8b1e2d" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M38 45 C47 48 49 54 55 56" fill="none" stroke="#8b1e2d" stroke-width="2.3" stroke-linecap="round"/>' +
      '</g></svg>';
    document.body.appendChild(cursor);

    var x = -100;
    var y = -100;
    window.addEventListener("pointermove", function (e) {
      x = e.clientX;
      y = e.clientY;
      cursor.style.opacity = "1";
      var hot = e.target.closest("a, button, .panel, .pigskin, input, textarea, label");
      cursor.classList.toggle("is-hot", !!hot);
      cursor.classList.toggle("is-ink", !!e.target.closest(".panel, .pigskin"));
    }, { passive: true });

    document.documentElement.addEventListener("mouseleave", function () { cursor.style.opacity = "0"; });
    (function follow() {
      cursor.style.transform = "translate3d(" + (x - 8) + "px," + (y - 62) + "px,0)";
      requestAnimationFrame(follow);
    })();
  }

  loadScript("js/premium-layout.js")
    .catch(function (err) {
      console.error("Element of Ink premium layout failed to load", err);
    })
    .then(function () {
      return loadScript("js/atmosphere.js");
    })
    .catch(function (err) {
      console.error("Element of Ink atmosphere failed to load", err);
    })
    .then(function () {
      magnetize(document.querySelector(".nav-cta"));
      magnetize(document.querySelector(".big-book"));
      magnetize(document.querySelector(".easy button"));
      installTattooCursor();

      if (reduce || !fine) return null;

      return loadScript("js/ink-mask.js")
        .then(function () { return loadScript("js/ink-organic.js"); })
        .then(function () { return loadScript("js/ink-render.js"); })
        .then(function () {
          if (window.EOIOrganicInk && window.EOIOrganicInk.start) {
            window.EOIOrganicInk.start({ debug: debug });
          }
        });
    })
    .catch(function (err) {
      console.error("Element of Ink interaction failed to load", err);
    });
})();
