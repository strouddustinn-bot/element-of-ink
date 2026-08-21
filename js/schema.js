(function () {
  "use strict";

  var current = new URL(window.location.href);
  var base = new URL("./", current);
  var siteUrl = base.href;

  function url(path) {
    return new URL(path, base).href;
  }

  function id(fragment) {
    return siteUrl + fragment;
  }

  document.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
    if (script.id === "eoi-full-schema") return;

    try {
      var parsed = JSON.parse(script.textContent || "{}");
      var type = parsed && parsed["@type"];
      var isEOI = parsed && parsed.name === "Elements of Ink";
      var isTattooParlor = type === "TattooParlor" || (Array.isArray(type) && type.indexOf("TattooParlor") !== -1);

      if (isEOI && isTattooParlor) script.remove();
    } catch (err) {
      // Leave unrelated or non-JSON-LD script blocks alone.
    }
  });

  var portfolio = [
    ["tattoo-16.jpg", "Hyper-realism chest piece"],
    ["tattoo-01.jpg", "Kraken pulling a ship under"],
    ["tattoo-05.jpg", "Winged crucifixion tattoo"],
    ["tattoo-09.jpg", "Poseidon with lightning and a ship"],
    ["tattoo-14.jpg", "Snarling wolf tattoo"],
    ["tattoo-13.jpg", "Reaper tattoo"],
    ["tattoo-02.jpg", "Jaguar tattoo"],
    ["tattoo-15.jpg", "Father Time with an astrolabe"],
    ["tattoo-12.jpg", "Rhino chest tattoo"],
    ["tattoo-08.jpg", "Story sleeve with a teddy bear, baseball, and childhood scenes"],
    ["tattoo-04.jpg", "Large back piece tattoo"],
    ["tattoo-03.jpg", "Colour portrait tattoo"],
    ["tattoo-17.jpg", "Norse god and raven sleeve"]
  ];

  var imageNodes = portfolio.map(function (entry, index) {
    return {
      "@type": "ImageObject",
      "@id": id("#portfolio-image-" + String(index + 1).padStart(2, "0")),
      "contentUrl": url("assets/" + entry[0]),
      "url": url("assets/" + entry[0]),
      "caption": entry[1],
      "about": { "@id": id("#studio") }
    };
  });

  var services = [
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "@id": id("#service-hyper-realism"),
        "name": "Hyper-realism tattooing",
        "serviceType": "Hyper-realism tattooing",
        "provider": { "@id": id("#studio") },
        "url": siteUrl + "#work"
      }
    },
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "@id": id("#service-sleeves"),
        "name": "Tattoo sleeves",
        "serviceType": "Custom tattoo sleeves",
        "provider": { "@id": id("#studio") },
        "url": siteUrl + "#work"
      }
    },
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "@id": id("#service-coverups"),
        "name": "Cover-up tattoos",
        "serviceType": "Tattoo cover-up work",
        "provider": { "@id": id("#studio") },
        "url": siteUrl + "#work"
      }
    },
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "@id": id("#service-large-work"),
        "name": "Large-scale custom tattoo work",
        "serviceType": "Large custom tattoo compositions",
        "provider": { "@id": id("#studio") },
        "url": siteUrl + "#work"
      }
    }
  ];

  var graph = [
    {
      "@type": "WebSite",
      "@id": id("#website"),
      "url": siteUrl,
      "name": "Elements of Ink",
      "description": "Elements of Ink — hyper-realism, sleeves, cover-ups and large custom tattoo work by Amanda Hope Patterson.",
      "inLanguage": "en-CA",
      "publisher": { "@id": id("#studio") }
    },
    {
      "@type": "WebPage",
      "@id": id("#home"),
      "url": siteUrl,
      "name": "Elements of Ink — Amanda Hope Patterson",
      "description": "Hyper-realism, sleeves, cover-ups and large custom tattoo work by Amanda Hope Patterson at Elements of Ink.",
      "isPartOf": { "@id": id("#website") },
      "about": [
        { "@id": id("#studio") },
        { "@id": id("#amanda") }
      ],
      "mainEntity": { "@id": id("#studio") },
      "primaryImageOfPage": { "@id": id("#portfolio-image-01") },
      "inLanguage": "en-CA"
    },
    {
      "@type": ["TattooParlor", "LocalBusiness", "Organization"],
      "@id": id("#studio"),
      "name": "Elements of Ink",
      "url": siteUrl,
      "description": "Tattoo shop and podcast featuring Amanda Hope Patterson's hyper-realism, sleeves, cover-ups and large custom work.",
      "image": imageNodes.slice(0, 4).map(function (node) { return { "@id": node["@id"] }; }),
      "sameAs": [
        "https://www.instagram.com/thedirtyginge/"
      ],
      "brand": {
        "@type": "Brand",
        "name": "Elements of Ink"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "booking inquiries",
          "url": siteUrl + "#book"
      },
      "hasOfferCatalog": { "@id": id("#services") },
      "subjectOf": { "@id": id("#portfolio") },
      "mainEntityOfPage": { "@id": id("#home") }
    },
    {
      "@type": "Person",
      "@id": id("#amanda"),
      "name": "Amanda Hope Patterson",
      "givenName": "Amanda",
      "additionalName": "Hope",
      "familyName": "Patterson",
      "jobTitle": "Tattoo Artist",
      "description": "Tattoo artist and podcast creator at Elements of Ink specializing in hyper-realism, with custom sleeves, cover-ups and large-scale work.",
      "image": url("assets/tattoo-18.jpg"),
      "sameAs": [
        "https://www.instagram.com/thedirtyginge/"
      ],
      "affiliation": { "@id": id("#studio") },
      "knowsAbout": [
        "Hyper-realism tattooing",
        "Tattoo sleeves",
        "Cover-up tattoos",
        "Large-scale custom tattoo work"
      ],
      "mainEntityOfPage": siteUrl + "#artist"
    },
    {
      "@type": "OfferCatalog",
      "@id": id("#services"),
      "name": "Tattoo services",
      "itemListElement": services
    },
    {
      "@type": "ImageGallery",
      "@id": id("#portfolio"),
      "url": siteUrl + "#work",
      "name": "Elements of Ink selected tattoo work by Amanda Hope Patterson",
      "description": "Selected tattoo portfolio featuring hyper-realism, sleeves, portraits, animals, cover-ups and large custom compositions.",
      "isPartOf": { "@id": id("#home") },
      "about": { "@id": id("#studio") },
      "associatedMedia": imageNodes.map(function (node) { return { "@id": node["@id"] }; })
    }
  ].concat(imageNodes);

  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "eoi-full-schema";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph
  });
  document.head.appendChild(script);
})();