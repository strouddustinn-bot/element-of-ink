(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  function magnetize(el) {
    if (!el || !fine || reduce) return;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var x = e.clientX - (r.left + r.width / 2);
      var y = e.clientY - (r.top + r.height / 2);
      el.style.transform = "translate(" + (x * 0.16) + "px," + (y * 0.16) + "px)";
    });
    el.addEventListener("pointerleave", function () {
      el.style.transform = "";
    });
  }
  magnetize(document.querySelector(".nav-cta"));
  magnetize(document.querySelector(".big-book"));
  magnetize(document.querySelector(".easy button"));

  var orb = document.getElementById("orb");
  if (orb && fine && !reduce) {
    document.documentElement.classList.add("has-orb");
    var ox = -80, oy = -80;
    window.addEventListener("pointermove", function (e) {
      ox = e.clientX;
      oy = e.clientY;
      var hot = e.target.closest("a, button, .panel, .pigskin, input, textarea, label");
      orb.classList.toggle("is-hot", !!hot && !e.target.closest(".pigskin"));
      orb.classList.toggle("is-ink", !!e.target.closest(".pigskin"));
    }, { passive: true });
    (function follow() {
      orb.style.transform = "translate3d(" + ox + "px," + oy + "px,0)";
      requestAnimationFrame(follow);
    })();
  }

  function coverUV(iw, ih, vw, vh, ox, oy) {
    var ir = iw / ih, vr = vw / vh;
    var sx = 1, sy = 1, u = 0, v = 0;
    if (ir > vr) { sx = vr / ir; u = (1 - sx) * ox; }
    else { sy = ir / vr; v = (1 - sy) * oy; }
    return { u: u, v: v, sx: sx, sy: sy };
  }

  function parsePos(img) {
    var st = window.getComputedStyle(img).objectPosition || "50% 50%";
    var parts = st.split(" ");
    function pct(s, fb) {
      var n = parseFloat(s);
      return isNaN(n) ? fb : n / 100;
    }
    return { x: pct(parts[0], 0.5), y: pct(parts[1] || parts[0], 0.5) };
  }

  function paintCover(ctx, img, pos, w, h) {
    var c = coverUV(img.naturalWidth, img.naturalHeight, w, h, pos.x, pos.y);
    ctx.drawImage(
      img,
      c.u * img.naturalWidth, c.v * img.naturalHeight,
      c.sx * img.naturalWidth, c.sy * img.naturalHeight,
      0, 0, w, h
    );
  }

  function extractInk(img, pos, size) {
    var src = document.createElement("canvas");
    src.width = size;
    src.height = size;
    var sctx = src.getContext("2d", { willReadFrequently: true });
    if (!sctx) return null;
    try {
      paintCover(sctx, img, pos, size, size);
      var data = sctx.getImageData(0, 0, size, size);
    } catch (err) {
      return null;
    }
    var px = data.data;
    var i;
    for (i = 0; i < px.length; i += 4) {
      var lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
      var ink = 1 - lum;
      if (ink < 0.18) {
        px[i + 3] = 0;
      } else {
        var a = Math.min(255, Math.floor(((ink - 0.18) / 0.82) * 255));
        px[i + 3] = a;
      }
    }
    sctx.putImageData(data, 0, 0);
    return src;
  }

  function bindRelief(wrap, img, canvas) {
    if (!wrap || !img || !canvas) return;
    function start() {
      if (!img.naturalWidth) return;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      var pos = parsePos(img);
      var ink = extractInk(img, pos, 640);
      if (!ink) return;

      var local = { x: 0.52, y: 0.42, tx: 0.52, ty: 0.42, inside: false };
      wrap.classList.add("is-live");

      function onMove(e) {
        var r = wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        local.tx = (e.clientX - r.left) / r.width;
        local.ty = (e.clientY - r.top) / r.height;
        local.inside = true;
      }
      function onLeave() {
        local.inside = false;
        local.tx = 0.5;
        local.ty = 0.42;
      }
      wrap.addEventListener("pointermove", onMove, { passive: true });
      wrap.addEventListener("pointerenter", onMove, { passive: true });
      wrap.addEventListener("pointerleave", onLeave);

      var t0 = performance.now();
      function draw(now) {
        local.x += (local.tx - local.x) * 0.18;
        local.y += (local.ty - local.y) * 0.18;

        var w = canvas.clientWidth || wrap.clientWidth;
        var h = canvas.clientHeight || wrap.clientHeight;
        if (w >= 8 && h >= 8) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          var breath = 0.08 * Math.sin((now - t0) / 420);
          var lift = (local.inside ? 0.16 : 0.07) + breath;
          var ox = (local.x - 0.5) * w * lift * 1.15;
          var oy = (local.y - 0.5) * h * lift * 1.15;
          var cx = local.x * w;
          var cy = local.y * h;
          var scale = 1 + lift;

          ctx.clearRect(0, 0, w, h);
          paintCover(ctx, img, pos, w, h);

          ctx.save();
          ctx.filter = "blur(" + Math.round(10 + lift * 28) + "px)";
          ctx.globalAlpha = 0.38 + lift * 0.35;
          ctx.translate(ox * 1.4, oy * 1.4 + 10 + lift * 18);
          ctx.drawImage(ink, 0, 0, w, h);
          ctx.restore();

          ctx.save();
          ctx.translate(cx + ox, cy + oy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(ink, 0, 0, w, h);
          ctx.restore();
        }
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    }
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  var hero = document.getElementById("hero-photo");
  if (hero) {
    bindRelief(hero, document.getElementById("hero-img"), document.getElementById("hero-live"));
  }

  document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
    var img = panel.querySelector("img");
    if (!img) return;
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);
    var armed = false;
    panel.addEventListener("pointerenter", function () {
      if (armed) return;
      armed = true;
      bindRelief(panel, img, canvas);
    }, { once: true });
  });
})();
