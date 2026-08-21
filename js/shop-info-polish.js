(function () {
  "use strict";

  var section = document.getElementById("shop-info");
  if (!section) return;

  /* The working-photo treatment belongs in Amanda's artist section, not here. */
  var duplicateArtistSlot = section.querySelector(".artist-working-slot");
  if (duplicateArtistSlot) duplicateArtistSlot.remove();

  /* Keep the shop placeholder identity consistent with the new display system. */
  var style = document.createElement("style");
  style.id = "eoi-shop-info-polish";
  style.textContent =
    ".premium-eoi #shop-info .street-building b," +
    ".premium-eoi #shop-info .flash-item h3{" +
      "font-family:'Big Shoulders Display','Arial Narrow',Arial,sans-serif!important;" +
      "font-weight:800!important;" +
    "}" +
    ".premium-eoi #shop-info .street-building b{letter-spacing:.02em}";
  document.head.appendChild(style);

  /* premium-layout.js initializes before shop-info.js creates this section.
     Register these late-added reveal nodes here so they never remain opacity:0. */
  var nodes = Array.prototype.slice.call(section.querySelectorAll(".reveal-premium"));
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!("IntersectionObserver" in window) || reduce) {
    nodes.forEach(function (node) { node.classList.add("is-visible"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });

    nodes.forEach(function (node) {
      var rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) {
        node.classList.add("is-visible");
      } else {
        observer.observe(node);
      }
    });
  }

  function loadOptional(src, errorLabel) {
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onerror = function () { console.error(errorLabel); };
    document.head.appendChild(script);
  }

  /* Replace temporary vector drawings with real tattoo reference photography. */
  loadOptional("js/catalogue-photo-upgrade.js", "Elements of Ink real-photo catalogue upgrade failed to load");

  /* Put verified contact details up top and repeat them in the footer; unknown facts stay explicit placeholders. */
  loadOptional("js/contact-banner.js", "Elements of Ink contact banner failed to load");
})();
