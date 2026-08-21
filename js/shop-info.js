(function () {
  "use strict";
  if (document.getElementById("shop-info")) return;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/shop-info.css";
  css.id = "eoi-shop-info-css";
  document.head.appendChild(css);

  var config = {
    location: "Street address · City, ON · TO BE CONFIRMED",
    hours: [
      ["Monday", "TBD"], ["Tuesday", "TBD"], ["Wednesday", "TBD"],
      ["Thursday", "TBD"], ["Friday", "TBD"], ["Saturday", "TBD"], ["Sunday", "TBD"]
    ],
    cataloguePrice: "From $___",
    customHourly: "$___ / hour"
  };

  var pages = [
    [
      ["rose", "Rose", "$___"], ["dagger", "Dagger", "$___"],
      ["snake", "Snake", "$___"], ["heart", "Sacred heart", "$___"]
    ],
    [
      ["swallow", "Swallow", "$___"], ["moth", "Moth", "$___"],
      ["spider", "Spider", "$___"], ["shoe", "Horseshoe", "$___"]
    ],
    [
      ["skull", "Skull", "$___"], ["panther", "Panther", "$___"],
      ["eye", "Eye", "$___"], ["raven", "Raven", "$___"]
    ],
    [
      ["anchor", "Anchor", "$___"], ["scorpion", "Scorpion", "$___"],
      ["candle", "Candle", "$___"], ["dice", "Lucky dice", "$___"]
    ]
  ];

  function icon(name) {
    var map = {
      rose: '<circle cx="80" cy="62" r="24"/><path d="M80 86v50M80 106l-23 18M80 116l23 17M59 61c12-16 31-17 43-2"/>',
      dagger: '<path d="M80 18l17 58-17 56-17-56zM45 80h70M59 80L45 95M101 80l14 15M70 133h20"/>',
      snake: '<path d="M108 26c-56 6-58 42-14 48 39 6 27 44-11 41-27-2-33 17-9 24M108 26l15 7-13 10"/><circle cx="115" cy="31" r="2"/>',
      heart: '<path d="M80 134C58 105 33 86 36 57c3-25 34-31 44-7 10-24 41-18 44 7 3 29-22 48-44 77zM80 23v24M60 31l13 16M100 31L87 47"/>',
      swallow: '<path d="M24 89c30-7 43-30 56-44 13 14 26 37 56 44-26 2-43 11-56 29-13-18-30-27-56-29zM80 45l-7 44 7 29 7-29z"/>',
      moth: '<path d="M80 35v93M68 57C40 34 20 53 34 83c8 17 22 27 36 33M92 57c28-23 48-4 34 26-8 17-22 27-36 33M70 36l10-17 10 17M70 82h20"/>',
      spider: '<ellipse cx="80" cy="82" rx="16" ry="25"/><circle cx="80" cy="50" r="11"/><path d="M66 65L38 44M63 77L31 70M64 91l-31 12M69 102l-22 25M94 65l28-21M97 77l32-7M96 91l31 12M91 102l22 25"/>',
      shoe: '<path d="M52 30c-21 17-22 69-2 98 8 12 20 8 19-6-11-18-10-52 1-69 6-9 14-9 20 0 11 17 12 51 1 69-1 14 11 18 19 6 20-29 19-81-2-98-16-13-40-13-56 0z"/>',
      skull: '<path d="M45 69c0-30 15-47 35-47s35 17 35 47c0 21-8 31-20 38v25H65v-25c-12-7-20-17-20-38zM61 75l12 7-12 7M99 75l-12 7 12 7M72 109h16"/>',
      panther: '<path d="M36 103c14-47 40-77 81-64-18 7-22 19-20 34 16 7 23 22 21 44-19-6-32-2-43 12-14-12-27-20-39-26zM88 59l18-16M56 88l-20-16"/><circle cx="98" cy="76" r="2"/>',
      eye: '<path d="M25 80c17-24 35-35 55-35s38 11 55 35c-17 24-35 35-55 35S42 104 25 80z"/><circle cx="80" cy="80" r="19"/><circle cx="80" cy="80" r="7"/><path d="M80 27V12M52 35L42 22M108 35l10-13"/>',
      raven: '<path d="M25 98c23-5 37-27 50-50 18 20 37 27 60 30-20 9-32 21-38 39-16-7-30-8-44-3-8-7-17-12-28-16zM76 48l18-17-3 25"/>',
      anchor: '<path d="M80 24v101M58 44h44M48 96c4 21 15 32 32 32s28-11 32-32M48 96l-16 12M112 96l16 12"/><circle cx="80" cy="28" r="9"/>',
      scorpion: '<path d="M80 39c-20 4-27 24-18 39 8 13 25 15 34 4 10-12 7-31-6-40M90 42c24-15 41 6 26 23M61 84l-23 20M65 94l-9 28M99 84l23 20M95 94l9 28M78 106v29"/>',
      candle: '<path d="M59 61h42v71H59zM80 60V39M80 39c-14-15 0-27 0-27s14 12 0 27zM53 132h54M62 82c11 6 25 6 36 0"/>',
      dice: '<rect x="38" y="38" width="84" height="84" rx="12" transform="rotate(8 80 80)"/><circle cx="58" cy="58" r="5"/><circle cx="101" cy="61" r="5"/><circle cx="80" cy="80" r="5"/><circle cx="58" cy="101" r="5"/><circle cx="101" cy="103" r="5"/>'
    };
    return '<svg class="flash-icon" viewBox="0 0 160 160" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' + (map[name] || map.rose) + '</g></svg>';
  }

  var section = document.createElement("section");
  section.id = "shop-info";
  section.className = "shop-info-section";
  section.setAttribute("aria-labelledby", "shop-info-title");
  section.innerHTML =
    '<div class="shop-wrap">' +
      '<div class="shop-head reveal-premium">' +
        '<div class="section-index">05 / VISIT + PRICING</div>' +
        '<h2 class="editorial-title" id="shop-info-title">Know before you come in.</h2>' +
        '<p class="editorial-copy">This section is staged with placeholders until Amanda confirms the shop details and rates. Elements of Ink is a tattoo shop and podcast. Nothing marked TBD is being presented as final pricing or business information.</p>' +
      '</div>' +
      '<div class="shop-visit-grid">' +
        '<div class="street-placeholder reveal-premium" role="img" aria-label="Placeholder for a street-view photo of the Elements of Ink storefront">' +
          '<div class="street-sky"></div><div class="street-building"><b>ELEMENTS OF INK</b><span>SHOP @ STREET VIEW</span></div><div class="street-road"></div>' +
          '<div class="placeholder-stamp">Replace with real storefront / street-view photo</div>' +
        '</div>' +
        '<div class="shop-facts reveal-premium">' +
          '<div class="fact-block"><span class="fact-label">Location · placeholder</span><strong>' + config.location + '</strong><p>Street-view image, map link and exact directions can drop in here once confirmed.</p></div>' +
          '<div class="fact-block"><span class="fact-label">Shop hours · placeholder</span><div class="hours-list" id="shop-hours"></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="pricing-intro reveal-premium">' +
        '<div><span class="fact-label">Walk-in / catalogue pieces · placeholder</span><strong>' + config.cataloguePrice + '</strong><p>Use the arrows to flip through a sample classic-flash catalogue. Final designs and rates get replaced with Amanda’s real shop offering.</p></div>' +
        '<div><span class="fact-label">Custom work · placeholder</span><strong>' + config.customHourly + '</strong><p>Hourly custom rate placeholder only. Final pricing can reflect Amanda’s actual minimums, day rates, deposits or piece pricing.</p></div>' +
      '</div>' +
      '<div class="flash-book-wrap reveal-premium">' +
        '<div class="flash-book-top"><span>Elements of Ink · Sample flash book</span><span id="flash-page-count">Page 01 / 04</span></div>' +
        '<div class="flash-book" id="flash-book" tabindex="0" aria-live="polite"><div class="flash-page" id="flash-page"></div></div>' +
        '<div class="flash-controls">' +
          '<button type="button" id="flash-prev" aria-label="Previous flash page">← Back</button>' +
          '<span>Classic catalogue placeholder</span>' +
          '<button type="button" id="flash-next" aria-label="Next flash page">Next →</button>' +
        '</div>' +
      '</div>' +
      '<div class="artist-working-slot reveal-premium">' +
        '<div class="working-photo-placeholder"><span>WORKING PORTRAIT</span><strong>Amanda tattooing someone.</strong><p>Use a real @thedirtyginge working photo here — no stock artist, no stand-in.</p></div>' +
        '<div><span class="fact-label">Artist image upgrade</span><h3>Amanda at work.</h3><p>The current posed portrait can be replaced by a real photo from her Instagram showing her actually tattooing. The layout is ready for that image as soon as we have the exact post/photo file.</p></div>' +
      '</div>' +
    '</div>';

  var book = document.getElementById("book");
  var skin = document.getElementById("skin");
  var process = document.getElementById("process");
  if (skin && skin.parentNode) skin.parentNode.insertBefore(section, skin);
  else if (book && book.parentNode) book.parentNode.insertBefore(section, book);
  else if (process) process.insertAdjacentElement("afterend", section);

  var hours = section.querySelector("#shop-hours");
  config.hours.forEach(function (row) {
    var line = document.createElement("div");
    line.innerHTML = "<span>" + row[0] + "</span><b>" + row[1] + "</b>";
    hours.appendChild(line);
  });

  var page = section.querySelector("#flash-page");
  var count = section.querySelector("#flash-page-count");
  var prev = section.querySelector("#flash-prev");
  var next = section.querySelector("#flash-next");
  var flashBook = section.querySelector("#flash-book");
  var pageIndex = 0;

  function render(direction) {
    page.classList.remove("turn-forward", "turn-back");
    void page.offsetWidth;
    page.classList.add(direction === "back" ? "turn-back" : "turn-forward");
    page.innerHTML = pages[pageIndex].map(function (item, index) {
      return '<article class="flash-item"><div class="flash-number">' + String(pageIndex * 4 + index + 1).padStart(2, "0") + '</div>' + icon(item[0]) + '<h3>' + item[1] + '</h3><span>Classic flash · ' + item[2] + '</span></article>';
    }).join("");
    count.textContent = "Page " + String(pageIndex + 1).padStart(2, "0") + " / " + String(pages.length).padStart(2, "0");
  }

  prev.addEventListener("click", function () {
    pageIndex = (pageIndex - 1 + pages.length) % pages.length;
    render("back");
  });
  next.addEventListener("click", function () {
    pageIndex = (pageIndex + 1) % pages.length;
    render("forward");
  });
  flashBook.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") prev.click();
    if (event.key === "ArrowRight") next.click();
  });
  render("forward");

  var links = document.querySelector(".nav-links");
  if (links && !links.querySelector('a[href="#shop-info"]')) {
    var visit = document.createElement("a");
    visit.href = "#shop-info";
    visit.textContent = "Visit / Pricing";
    var instagram = links.querySelector('a[href*="instagram.com"]');
    links.insertBefore(visit, instagram || null);
  }
})();