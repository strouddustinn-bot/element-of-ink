(function () {
  var body = document.body;
  if (!body || body.classList.contains("premium-eoi")) return;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/premium.css";
  css.id = "eoi-premium-css";
  document.head.appendChild(css);
  body.classList.add("premium-eoi");

  var openBar = document.querySelector(".open-bar");
  if (openBar) openBar.textContent = "Black & grey realism · Books open · Element of Ink";

  var nav = document.querySelector("nav");
  var links = document.querySelector(".nav-links");
  if (links) {
    links.innerHTML =
      '<a href="#work">Work</a>' +
      '<a href="#artist">Amanda</a>' +
      '<a href="#process">Process</a>' +
      '<a href="https://www.instagram.com/SUMDIRTYGINGE/" rel="noreferrer">Instagram</a>';
  }

  if (nav) {
    window.addEventListener("scroll", function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 36);
    }, { passive: true });
  }

  var hero = document.querySelector(".hero");
  var heroCopy = document.querySelector(".hero-copy");
  if (heroCopy) {
    var h1 = heroCopy.querySelector("h1");
    var lede = heroCopy.querySelector(".lede");
    if (h1) h1.textContent = "Element of Ink";
    if (lede) {
      lede.textContent = "Amanda's black-and-grey realism, sleeves, cover-ups and large sit-down work — built to hold attention long after the session ends.";
    }
  }

  if (hero) {
    var rail = document.createElement("div");
    rail.className = "hero-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.innerHTML = "<strong>Black & grey, built with weight.</strong><span>Sleeves · Cover-ups · Large work</span>";
    hero.appendChild(rail);

    var scroll = document.createElement("div");
    scroll.className = "hero-scroll";
    scroll.setAttribute("aria-hidden", "true");
    scroll.textContent = "Scroll to the work";
    hero.appendChild(scroll);

    var signature = document.createElement("div");
    signature.className = "signature-strip";
    signature.setAttribute("aria-label", "Specialties");
    signature.innerHTML =
      '<div class="signature-item"><em>01</em> Black & grey realism</div>' +
      '<div class="signature-item"><em>02</em> Sleeves</div>' +
      '<div class="signature-item"><em>03</em> Cover-ups</div>' +
      '<div class="signature-item"><em>04</em> Large sit-down work</div>';
    hero.insertAdjacentElement("afterend", signature);
  }

  var dock = document.querySelector(".book-dock");
  if (dock) dock.setAttribute("aria-hidden", "true");
  var marquee = document.querySelector(".marquee");
  if (marquee) marquee.setAttribute("aria-hidden", "true");

  var work = document.getElementById("work");
  var mosaic = work && work.querySelector(".mosaic");
  var amandaImg = mosaic && mosaic.querySelector(".p-amanda");
  var amandaPanel = amandaImg && amandaImg.closest(".panel");

  if (work) {
    var center = work.querySelector(".center");
    var workTitle = work.querySelector("h2");
    var workKicker = work.querySelector(".kicker");
    if (workTitle) workTitle.textContent = "Selected work";
    if (workKicker) workKicker.textContent = "Black and grey, narrative sleeves, animals, mythic figures and large pieces. Move the machine across the ink.";
    if (center) center.classList.add("reveal-premium");
  }

  if (work && amandaImg && amandaPanel) {
    var artist = document.createElement("section");
    artist.id = "artist";
    artist.className = "artist-section";
    artist.setAttribute("aria-labelledby", "artist-title");
    artist.innerHTML =
      '<div class="artist-grid">' +
        '<div class="artist-portrait" id="artist-portrait"></div>' +
        '<div class="artist-copy reveal-premium">' +
          '<div class="section-index">02 / THE ARTIST</div>' +
          '<h2 class="editorial-title" id="artist-title">Amanda.</h2>' +
          '<p class="editorial-copy">The portfolio moves through black-and-grey realism, portraits, animals, mythic subjects and large connected pieces. The common thread is depth, contrast and work that reads from across the room before it rewards a closer look.</p>' +
          '<div class="artist-notes">' +
            '<div class="artist-note"><strong>Focus</strong>Black & grey realism</div>' +
            '<div class="artist-note"><strong>Projects</strong>Sleeves · Cover-ups · Large work</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    work.parentNode.insertBefore(artist, work);

    var portrait = artist.querySelector("#artist-portrait");
    amandaImg.loading = "eager";
    portrait.appendChild(amandaImg);
    amandaPanel.remove();
  }

  if (mosaic) {
    var labels = [
      "Black & grey chest",
      "Kraken / ship",
      "Crucifixion",
      "Poseidon",
      "Wolf",
      "Reaper",
      "Jaguar",
      "Father Time",
      "Rhino",
      "Story sleeve",
      "Back piece",
      "Portrait",
      "Norse / raven"
    ];
    var panels = mosaic.querySelectorAll(".panel");
    panels.forEach(function (panel, index) {
      var number = String(index + 1).padStart(2, "0");
      panel.setAttribute("data-index", number);
      panel.setAttribute("aria-label", labels[index] || "Tattoo work");
      var caption = document.createElement("div");
      caption.className = "work-caption";
      caption.innerHTML = "<span>" + (labels[index] || "Tattoo work") + "</span><span>Element of Ink</span>";
      panel.appendChild(caption);
      panel.classList.add("reveal-premium");
    });
  }

  var shouts = document.querySelectorAll("main > .shout");
  if (shouts.length > 1) shouts[1].hidden = true;

  var process = document.createElement("section");
  process.id = "process";
  process.className = "process-section";
  process.setAttribute("aria-labelledby", "process-title");
  process.innerHTML =
    '<div class="process-head reveal-premium">' +
      '<div class="section-index">04 / THE PROCESS</div>' +
      '<h2 class="editorial-title" id="process-title">Start with the idea.</h2>' +
      '<p class="editorial-copy">Booking is deliberately simple. Send the concept. Give Amanda enough to understand what you want. The first job is getting the piece into the right conversation.</p>' +
    '</div>' +
    '<div class="process-grid">' +
      '<article class="process-step reveal-premium"><b>01 / SEND IT</b><h3>Your idea.</h3><p>Name the piece, subject or direction you have in mind. It does not need to arrive as a finished art brief.</p></article>' +
      '<article class="process-step reveal-premium"><b>02 / SHAPE IT</b><h3>The piece.</h3><p>The conversation narrows the direction around the work Amanda actually does: black and grey, sleeves, cover-ups and larger compositions.</p></article>' +
      '<article class="process-step reveal-premium"><b>03 / SIT FOR IT</b><h3>The session.</h3><p>Once the direction is right, the work moves from an idea on a screen to ink that has to live on the body.</p></article>' +
    '</div>';

  if (shouts.length) shouts[0].insertAdjacentElement("afterend", process);
  else if (work) work.insertAdjacentElement("afterend", process);

  var skin = document.getElementById("skin");
  if (skin) {
    var skinTitle = skin.querySelector("h2");
    var skinKicker = skin.querySelector(".kicker");
    if (skinTitle) skinTitle.textContent = "Try the hand.";
    if (skinKicker) skinKicker.textContent = "A small interactive study in pressure, line and patience. Press Ink, draw on the hide, then watch the line fade.";
  }

  var book = document.getElementById("book");
  if (book) {
    var bookTitle = book.querySelector("h2");
    var bookKicker = book.querySelector(".kicker");
    var bookCite = book.querySelector(".cite");
    var submit = book.querySelector("button[type='submit']");
    if (bookTitle) bookTitle.textContent = "Bring the idea.";
    if (bookKicker) bookKicker.textContent = "Your name, your email, and what you want to build. That starts the conversation.";
    if (bookCite) bookCite.textContent = "Booking / Amanda";
    if (submit) submit.textContent = "Send booking request";
  }

  var reveal = Array.prototype.slice.call(document.querySelectorAll(".reveal-premium"));
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveal.forEach(function (el) { observer.observe(el); });
  } else {
    reveal.forEach(function (el) { el.classList.add("is-visible"); });
  }
})();
