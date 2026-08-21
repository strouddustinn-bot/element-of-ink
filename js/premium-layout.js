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
  if (openBar) openBar.textContent = "Tattoo shop + podcast · Hyper-realism by Amanda Hope Patterson · Books open · Elements of Ink";

  var nav = document.querySelector("nav");
  var links = document.querySelector(".nav-links");
  if (links) {
    links.innerHTML =
      '<a href="#work">Work</a>' +
      '<a href="#artist">Amanda</a>' +
      '<a href="#process">Process</a>' +
      '<a href="https://www.instagram.com/thedirtyginge/" rel="noreferrer">Instagram</a>';
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
    var verse = heroCopy.querySelector(".verse");
    var cite = heroCopy.querySelector(".cite");
    if (h1) h1.textContent = "Elements of Ink";
    if (verse) verse.textContent = "Hyper-realism by Amanda Hope Patterson.";
    if (cite) cite.textContent = "Elements of Ink";
    if (lede) {
      lede.textContent = "Amanda specializes in hyper-realism, with custom sleeves, cover-ups and large pieces built around the person wearing them. Her clients get to leave with artwork they are genuinely excited to show people.";
    }
  }

  if (hero) {
    var rail = document.createElement("div");
    rail.className = "hero-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.innerHTML = "<strong>Hyper-realism by Amanda Hope Patterson.</strong><span>Custom work · Sleeves · Cover-ups · Large pieces</span>";
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
      '<div class="signature-item"><em>01</em> Hyper-realism</div>' +
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
    if (workKicker) workKicker.textContent = "Finished tattoos by Amanda Hope Patterson — hyper-realism, portrait work, sleeves, cover-ups and larger custom pieces. Move the machine across the ink to explore the gallery.";
    if (center) center.classList.add("reveal-premium");
  }

  if (work) {
    var artist = document.createElement("section");
    artist.id = "artist";
    artist.className = "artist-section";
    artist.setAttribute("aria-labelledby", "artist-title");
    artist.innerHTML =
      '<div class="artist-grid">' +
        '<div class="artist-portrait artist-working-target" id="artist-portrait">' +
          '<div class="artist-photo-placeholder" role="img" aria-label="Placeholder for a real working photo of Amanda Hope Patterson tattooing a client">' +
            '<span>REAL WORKING PHOTO</span>' +
            '<strong>Amanda tattooing.</strong>' +
            '<p>Replace with a verified @thedirtyginge photo of Amanda working with a client.</p>' +
          '</div>' +
        '</div>' +
        '<div class="artist-copy reveal-premium">' +
          '<div class="section-index">02 / THE ARTIST</div>' +
          '<h2 class="editorial-title" id="artist-title">Amanda Hope Patterson.</h2>' +
          '<p class="editorial-copy">Amanda specializes in hyper-realism. People come to her with everything from a portrait or memory to a cover-up, a full sleeve or an idea they have been holding onto for years. She works through the details with them and turns that idea into a piece that fits the body and still feels personal.</p>' +
          '<p class="editorial-copy artist-heart">The reaction at the end of a session says a lot about the work. Her clients are excited. They want to look at it, photograph it and show it off. They get to carry something Amanda made specifically for them, and that pride in the finished piece is a big part of what makes her work special.</p>' +
          '<div class="artist-notes">' +
            '<div class="artist-note"><strong>Specialty</strong>Hyper-realism</div>' +
            '<div class="artist-note"><strong>Also known for</strong>Sleeves · Cover-ups · Large custom work</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    work.parentNode.insertBefore(artist, work);
    if (amandaPanel) amandaPanel.remove();
  }

  if (mosaic) {
    var labels = [
      "Hyper-realism chest piece", "Kraken / ship", "Crucifixion", "Poseidon", "Wolf", "Reaper", "Jaguar",
      "Father Time", "Rhino", "Story sleeve", "Back piece", "Portrait", "Norse / raven"
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
  if (shouts.length) {
    var shoutInk = shouts[0].querySelector(".ink");
    var shoutCite = shouts[0].querySelector(".cite");
    if (shoutInk) shoutInk.textContent = "Hyper-realism. Made personal.";
    if (shoutCite) shoutCite.textContent = "Amanda Hope Patterson";
  }
  if (shouts.length > 1) shouts[1].hidden = true;

  var process = document.createElement("section");
  process.id = "process";
  process.className = "process-section";
  process.setAttribute("aria-labelledby", "process-title");
  process.innerHTML =
    '<div class="process-head reveal-premium">' +
      '<div class="section-index">04 / THE PROCESS</div>' +
      '<h2 class="editorial-title" id="process-title">Start with your idea.</h2>' +
      '<p class="editorial-copy">You do not need a finished drawing before you reach out. Send Amanda the idea, references if you have them, the placement you are considering and anything important about the piece.</p>' +
    '</div>' +
    '<div class="process-grid">' +
      '<article class="process-step reveal-premium"><b>01 / SEND YOUR IDEA</b><h3>Tell Amanda.</h3><p>Share the subject, reference, memory or concept you want to explore.</p></article>' +
      '<article class="process-step reveal-premium"><b>02 / PLAN THE PIECE</b><h3>Work out the details.</h3><p>Amanda can shape the idea around placement, scale, composition and the level of realism you want.</p></article>' +
      '<article class="process-step reveal-premium"><b>03 / BOOK THE SESSION</b><h3>Get tattooed.</h3><p>Once the direction is right, book the time and let Amanda turn the plan into the finished piece.</p></article>' +
    '</div>';

  if (shouts.length) shouts[0].insertAdjacentElement("afterend", process);
  else if (work) work.insertAdjacentElement("afterend", process);

  var skin = document.getElementById("skin");
  if (skin) {
    var skinTitle = skin.querySelector("h2");
    var skinKicker = skin.querySelector(".kicker");
    if (skinTitle) skinTitle.textContent = "Try the practice skin.";
    if (skinKicker) skinKicker.textContent = "Use the interactive practice skin to try a line yourself. Press Ink, draw, and see how steady your hand is.";
  }

  var book = document.getElementById("book");
  if (book) {
    var bookTitle = book.querySelector("h2");
    var bookKicker = book.querySelector(".kicker");
    var bookCite = book.querySelector(".cite");
    var submit = book.querySelector("button[type='submit']");
    if (bookTitle) bookTitle.textContent = "Have an idea for Amanda?";
    if (bookKicker) bookKicker.textContent = "Send the idea and your contact information. It does not need to be completely figured out yet.";
    if (bookCite) bookCite.textContent = "Booking / Amanda Hope Patterson";
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