(function () {
  var body = document.body;
  if (!body || body.classList.contains("premium-eoi")) return;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/premium.css";
  css.id = "eoi-premium-css";
  document.head.appendChild(css);

  var brandType = document.createElement("link");
  brandType.rel = "stylesheet";
  brandType.href = "css/brand-type.css";
  brandType.id = "eoi-brand-type-css";
  document.head.appendChild(brandType);

  body.classList.add("premium-eoi");

  var openBar = document.querySelector(".open-bar");
  if (openBar) openBar.textContent = "Custom tattooing by Amanda Hope Patterson · Books open · Element of Ink";

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
      lede.textContent = "Amanda Hope Patterson makes tattoos people are excited to live in and show off. Black-and-grey realism, sleeves, cover-ups and big custom pieces — drawn around the person who has to wear them.";
    }
  }

  if (hero) {
    var rail = document.createElement("div");
    rail.className = "hero-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.innerHTML = "<strong>Made to be worn. Made to be loved.</strong><span>Black & grey · Sleeves · Cover-ups · Big work</span>";
    hero.appendChild(rail);

    var scroll = document.createElement("div");
    scroll.className = "hero-scroll";
    scroll.setAttribute("aria-hidden", "true");
    scroll.textContent = "See Amanda's work";
    hero.appendChild(scroll);

    var signature = document.createElement("div");
    signature.className = "signature-strip";
    signature.setAttribute("aria-label", "Specialties");
    signature.innerHTML =
      '<div class="signature-item"><em>01</em> Black & grey realism</div>' +
      '<div class="signature-item"><em>02</em> Sleeves</div>' +
      '<div class="signature-item"><em>03</em> Cover-ups</div>' +
      '<div class="signature-item"><em>04</em> Large custom pieces</div>';
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
    if (workTitle) workTitle.textContent = "The work";
    if (workKicker) workKicker.textContent = "The kind of tattoos people leave the chair checking in every mirror they pass. Move the machine across the ink and take a closer look.";
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
          '<h2 class="editorial-title" id="artist-title">Amanda Hope Patterson.</h2>' +
          '<p class="editorial-copy">People bring Amanda all kinds of starting points — a rough idea, a memory, an old tattoo they are ready to cover, or a whole sleeve they have been thinking about for years. Her job is to turn that into something that feels right on the body and still feels like theirs when it is finished.</p>' +
          '<p class="editorial-copy artist-heart">Her work leans into black-and-grey realism, strong contrast, depth and big compositions, but the best part is simpler than that: people are genuinely excited when they see the finished tattoo. That first look matters. The piece has to be something they are proud to walk out wearing.</p>' +
          '<div class="artist-notes">' +
            '<div class="artist-note"><strong>Her lane</strong>Black & grey realism</div>' +
            '<div class="artist-note"><strong>Come to her for</strong>Sleeves · Cover-ups · Large custom work</div>' +
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
      caption.innerHTML = "<span>" + (labels[index] || "Tattoo work") + "</span><span>By Amanda Hope Patterson</span>";
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
      '<h2 class="editorial-title" id="process-title">Start with what you want.</h2>' +
      '<p class="editorial-copy">You do not need to show up with perfect wording or a finished drawing. Tell Amanda what you have in your head, what matters about it, and where you want it to live. That is enough to start.</p>' +
    '</div>' +
    '<div class="process-grid">' +
      '<article class="process-step reveal-premium"><b>01 / TELL HER</b><h3>The idea.</h3><p>Send the subject, reference, memory or half-formed thought. Good tattoos do not need to begin as polished briefs.</p></article>' +
      '<article class="process-step reveal-premium"><b>02 / WORK IT OUT</b><h3>The tattoo.</h3><p>From there, the idea gets shaped around placement, scale and the kind of work Amanda does best.</p></article>' +
      '<article class="process-step reveal-premium"><b>03 / SIT FOR IT</b><h3>Your piece.</h3><p>Then comes the part that matters: turning the idea into something you get to leave wearing.</p></article>' +
    '</div>';

  if (shouts.length) shouts[0].insertAdjacentElement("afterend", process);
  else if (work) work.insertAdjacentElement("afterend", process);

  var skin = document.getElementById("skin");
  if (skin) {
    var skinTitle = skin.querySelector("h2");
    var skinKicker = skin.querySelector(".kicker");
    if (skinTitle) skinTitle.textContent = "Try your hand.";
    if (skinKicker) skinKicker.textContent = "A tiny taste of how unforgiving a clean line can be. Press Ink, draw on the practice skin, and see how your hand behaves.";
  }

  var book = document.getElementById("book");
  if (book) {
    var bookTitle = book.querySelector("h2");
    var bookKicker = book.querySelector(".kicker");
    var bookCite = book.querySelector(".cite");
    var submit = book.querySelector("button[type='submit']");
    if (bookTitle) bookTitle.textContent = "Tell Amanda what you're thinking.";
    if (bookKicker) bookKicker.textContent = "It does not have to be perfectly figured out. Send your idea and a way to reach you.";
    if (bookCite) bookCite.textContent = "Booking / Amanda Hope Patterson";
    if (submit) submit.textContent = "Send it to Amanda";
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
