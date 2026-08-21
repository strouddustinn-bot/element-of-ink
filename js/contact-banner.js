(function () {
  "use strict";
  if (document.getElementById("eoi-contact-banner")) return;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "css/contact-banner.css";
  css.id = "eoi-contact-banner-css";
  document.head.appendChild(css);

  var nav = document.querySelector("nav");
  var hero = document.querySelector(".hero");
  var openBar = document.querySelector(".open-bar");

  if (openBar) {
    openBar.textContent = "HYPER-REALISM · AMANDA HOPE PATTERSON · BOOKS OPEN";
  }

  var banner = document.createElement("section");
  banner.id = "eoi-contact-banner";
  banner.className = "eoi-contact-banner";
  banner.setAttribute("aria-label", "Elements of Ink contact information");
  banner.innerHTML =
    '<div class="eoi-contact-banner-inner">' +
      '<div class="eoi-contact-lead"><span>CONTACT AMANDA</span><strong>READY TO TALK TATTOOS?</strong></div>' +
      '<a class="eoi-contact-item is-live" href="https://www.instagram.com/thedirtyginge/" rel="noreferrer"><small>INSTAGRAM</small><b>@thedirtyginge</b></a>' +
      '<div class="eoi-contact-item is-placeholder"><small>PHONE</small><b>NUMBER TBD</b></div>' +
      '<div class="eoi-contact-item is-placeholder"><small>SHOP</small><b>LOCATION TBD</b></div>' +
    '</div>';

  if (hero && hero.parentNode) hero.parentNode.insertBefore(banner, hero);
  else if (nav && nav.parentNode) nav.insertAdjacentElement("afterend", banner);

  var footer = document.querySelector("footer");
  if (footer) {
    footer.classList.add("eoi-contact-footer");
    footer.innerHTML =
      '<div class="eoi-footer-brand"><strong>Elements of Ink</strong><span>Tattoo shop + podcast · Amanda Hope Patterson</span></div>' +
      '<div class="eoi-footer-contact">' +
        '<span class="eoi-footer-label">CONTACT AMANDA</span>' +
        '<a href="https://www.instagram.com/thedirtyginge/" rel="noreferrer">@thedirtyginge</a>' +
      '</div>' +
      '<div class="eoi-footer-contact eoi-footer-placeholders">' +
        '<span class="eoi-footer-label">SHOP DETAILS</span>' +
        '<span>PHONE · NUMBER TBD</span>' +
        '<span>LOCATION · TBD</span>' +
        '<span>HOURS · TBD</span>' +
      '</div>';
  }
})();
