(function () {
  "use strict";

  var style = document.createElement("style");
  style.id = "eoi-k-glyph-style";
  style.textContent =
    ".eoi-legible-k{" +
      "font-family:Needlehide,'Cormorant Garamond',Georgia,serif!important;" +
      "font-weight:400!important;" +
      "font-style:normal!important;" +
      "display:inline-block;" +
      "letter-spacing:0!important;" +
      "transform:scaleX(.94);" +
      "transform-origin:50% 60%;" +
      "margin-left:-.015em;" +
      "margin-right:-.01em;" +
    "}";
  document.head.appendChild(style);

  var selector = [
    ".premium-eoi .brand",
    ".premium-eoi h1",
    ".premium-eoi .editorial-title",
    ".premium-eoi #work h2",
    ".premium-eoi #skin h2",
    ".premium-eoi #book h2",
    ".premium-eoi .process-step h3",
    ".premium-eoi .shout .ink",
    ".premium-eoi .shop-info-section h2",
    ".premium-eoi .shop-info-section h3"
  ].join(",");

  function fixTextNode(node) {
    if (!/[Kk]/.test(node.nodeValue || "")) return;

    var frag = document.createDocumentFragment();
    var parts = node.nodeValue.split(/([Kk])/g);
    parts.forEach(function (part) {
      if (!part) return;
      if (part === "K" || part === "k") {
        var span = document.createElement("span");
        span.className = "eoi-legible-k";
        span.textContent = part;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    node.parentNode.replaceChild(frag, node);
  }

  function fixElement(el) {
    if (!el || el.dataset.kGlyphFixed === "1") return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(fixTextNode);
    el.dataset.kGlyphFixed = "1";
  }

  document.querySelectorAll(selector).forEach(fixElement);
})();
