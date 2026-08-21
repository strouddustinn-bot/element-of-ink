(function () {
  "use strict";

  var section = document.getElementById("shop-info");
  if (!section) return;

  var page = section.querySelector("#flash-page");
  var count = section.querySelector("#flash-page-count");
  var oldPrev = section.querySelector("#flash-prev");
  var oldNext = section.querySelector("#flash-next");
  var book = section.querySelector("#flash-book");
  var topLabel = section.querySelector(".flash-book-top span:first-child");
  var controlLabel = section.querySelector(".flash-controls span");
  if (!page || !count || !oldPrev || !oldNext || !book) return;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/catalogue-photo.css";
  css.id = "eoi-catalogue-photo-css";
  document.head.appendChild(css);

  if (topLabel) topLabel.textContent = "Elements of Ink · temporary tattoo reference catalogue";
  if (controlLabel) controlLabel.textContent = "Reference photos only · not Amanda's work";

  var notice = document.createElement("p");
  notice.className = "catalogue-photo-notice";
  notice.textContent = "Temporary reference photography for layout only. These are not Amanda Hope Patterson's tattoos or fixed-price flash. Replace with Amanda's own catalogue before launch.";
  book.insertAdjacentElement("beforebegin", notice);

  var prev = oldPrev.cloneNode(true);
  var next = oldNext.cloneNode(true);
  oldPrev.replaceWith(prev);
  oldNext.replaceWith(next);

  function img(id) {
    return "https://images.unsplash.com/" + id + "?auto=format&fit=crop&w=1200&q=82";
  }

  var pages = [
    [
      { title: "Black & grey realism", photo: img("photo-1648421831812-fd24fa8273c6"), credit: "Najib Kalil / Unsplash" },
      { title: "Illustrative blackwork", photo: img("photo-1669476526639-e390ead82f4b"), credit: "Cindy Bartillon / Unsplash" },
      { title: "Fine-line script", photo: img("photo-1497498093158-8be2377762d4"), credit: "Cory Woodward / Unsplash" },
      { title: "Minimal script", photo: img("photo-1570168983832-8989dae1522e"), credit: "Agathè Lov / Unsplash" }
    ],
    [
      { title: "Nautical black & grey", photo: img("photo-1700159098623-a2256f4c2b50"), credit: "Youpix Lab / Unsplash" },
      { title: "Blackwork portrait", photo: img("photo-1645836594987-3596702e8870"), credit: "Eduardo Vaccari / Unsplash" },
      { title: "Colour character piece", photo: img("photo-1647929369462-3258f892eb70"), credit: "Valeria Nikitina / Unsplash" },
      { title: "Black & grey arm work", photo: img("photo-1656016977634-54a275682d17"), credit: "Filipe Cantador / Unsplash" }
    ],
    [
      { title: "Skull reference", photo: img("photo-1550057931-140eca7716eb"), credit: "Lauren Mitchell / Unsplash" },
      { title: "Skeleton / floral reference", photo: img("photo-1718661426798-208d614f4f1e"), credit: "hayleigh b / Unsplash" },
      { title: "Fine-line floral", photo: img("photo-1651692883249-ed36b3523419"), credit: "Graham Mansfield / Unsplash" },
      { title: "Rose reference", photo: img("photo-1559577638-ccfeeb3eca64"), credit: "Yeganeh Shahpourzadeh / Unsplash" }
    ]
  ];

  var pageIndex = 0;

  function render(direction) {
    page.classList.remove("turn-forward", "turn-back", "photo-catalogue-page");
    void page.offsetWidth;
    page.classList.add("photo-catalogue-page", direction === "back" ? "turn-back" : "turn-forward");

    page.innerHTML = pages[pageIndex].map(function (item, index) {
      var number = String(pageIndex * 4 + index + 1).padStart(2, "0");
      return '<article class="flash-item photo-flash-item">' +
        '<img src="' + item.photo + '" alt="Tattoo reference photograph: ' + item.title + '" loading="lazy" referrerpolicy="no-referrer" />' +
        '<div class="photo-flash-shade"></div>' +
        '<div class="flash-number">' + number + '</div>' +
        '<div class="photo-flash-copy">' +
          '<h3>' + item.title + '</h3>' +
          '<span>REFERENCE ONLY · PRICE TBD</span>' +
          '<small>' + item.credit + '</small>' +
        '</div>' +
      '</article>';
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

  book.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev.click();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next.click();
    }
  }, true);

  render("forward");
})();
