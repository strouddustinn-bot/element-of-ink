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

  function splitPlates(img, pos, size) {
    var plate = document.createElement("canvas");
    plate.width = size;
    plate.height = size;
    var pctx = plate.getContext("2d", { willReadFrequently: true });
    if (!pctx) return null;
    try {
      paintCover(pctx, img, pos, size, size);
    } catch (err) {
      return null;
    }
    var data;
    try {
      data = pctx.getImageData(0, 0, size, size);
    } catch (err) {
      return null;
    }
    var px = data.data;
    var n = size * size;
    var isInk = new Uint8Array(n);
    var i, x, y, o, lum, ink;
    for (i = 0; i < n; i++) {
      o = i * 4;
      lum = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
      ink = 1 - lum;
      isInk[i] = ink > 0.2 ? 1 : 0;
    }

    var skin = document.createElement("canvas");
    skin.width = size;
    skin.height = size;
    var sctx = skin.getContext("2d");
    var skinData = pctx.getImageData(0, 0, size, size);
    var sp = skinData.data;
    var pass, j, k, cx, cy, r, g, b, c, ii, oo;
    for (pass = 0; pass < 2; pass++) {
      var next = new Uint8ClampedArray(sp);
      for (y = 0; y < size; y++) {
        for (x = 0; x < size; x++) {
          i = y * size + x;
          if (!isInk[i]) continue;
          r = 0; g = 0; b = 0; c = 0;
          for (j = -2; j <= 2; j++) {
            cy = y + j;
            if (cy < 0 || cy >= size) continue;
            for (k = -2; k <= 2; k++) {
              cx = x + k;
              if (cx < 0 || cx >= size) continue;
              ii = cy * size + cx;
              if (isInk[ii] && pass === 0) continue;
              if (isInk[ii] && next[ii * 4 + 3] === 0) continue;
              oo = ii * 4;
              if (sp[oo + 3] < 8) continue;
              r += sp[oo];
              g += sp[oo + 1];
              b += sp[oo + 2];
              c++;
            }
          }
          o = i * 4;
          if (c) {
            next[o] = r / c;
            next[o + 1] = g / c;
            next[o + 2] = b / c;
            next[o + 3] = 255;
          }
        }
      }
      sp.set(next);
    }
    sctx.putImageData(skinData, 0, 0);

    var inkPlate = document.createElement("canvas");
    inkPlate.width = size;
    inkPlate.height = size;
    var ictx = inkPlate.getContext("2d");
    var inkData = pctx.getImageData(0, 0, size, size);
    var ip = inkData.data;
    for (i = 0; i < n; i++) {
      if (!isInk[i]) ip[i * 4 + 3] = 0;
    }
    ictx.putImageData(inkData, 0, 0);

    var COLS = 16;
    var ROWS = 16;
    var cw = size / COLS;
    var ch = size / ROWS;
    var shards = [];
    var row, col, count, pxCount, sy, sx, fy, fx, idx;
    for (row = 0; row < ROWS; row++) {
      for (col = 0; col < COLS; col++) {
        count = 0;
        pxCount = 0;
        for (sy = 0; sy < ch; sy++) {
          fy = Math.floor(row * ch + sy);
          for (sx = 0; sx < cw; sx++) {
            fx = Math.floor(col * cw + sx);
            idx = fy * size + fx;
            pxCount++;
            if (isInk[idx]) count++;
          }
        }
        if (count < pxCount * 0.08) continue;
        shards.push({
          sx: col * cw,
          sy: row * ch,
          sw: cw,
          sh: ch,
          x: 0,
          y: 0,
          tx: 0,
          ty: 0
        });
      }
    }
    if (!shards.length) return null;
    return { skin: skin, ink: inkPlate, shards: shards, size: size };
  }

  function bindRelief(wrap, img, canvas) {
    if (!wrap || !img || !canvas) return;
    function start() {
      if (!img.naturalWidth) return;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      var pos = parsePos(img);
      var pack = splitPlates(img, pos, 256);
      if (!pack) return;

      var local = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, on: false };
      wrap.classList.add("is-live");

      function track(e) {
        var r = wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        local.tx = (e.clientX - r.left) / r.width;
        local.ty = (e.clientY - r.top) / r.height;
        local.on = true;
      }
      wrap.addEventListener("pointermove", track, { passive: true });
      wrap.addEventListener("pointerenter", track, { passive: true });
      wrap.addEventListener("pointerleave", function () {
        local.on = false;
      });

      function draw() {
        local.x += (local.tx - local.x) * 0.2;
        local.y += (local.ty - local.y) * 0.2;

        var w = canvas.clientWidth || wrap.clientWidth;
        var h = canvas.clientHeight || wrap.clientHeight;
        if (w >= 8 && h >= 8) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          var scale = w / pack.size;
          var mx = local.x * w;
          var my = local.y * h;
          var radius = Math.min(w, h) * 0.38;
          var spread = Math.min(w, h) * 0.16;

          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(pack.skin, 0, 0, w, h);

          var s, cx, cy, dx, dy, dist, push, nx, ny;
          for (var i = 0; i < pack.shards.length; i++) {
            s = pack.shards[i];
            cx = (s.sx + s.sw / 2) * scale;
            cy = (s.sy + s.sh / 2) * scale;
            if (local.on) {
              dx = cx - mx;
              dy = cy - my;
              dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
              push = Math.max(0, 1 - dist / radius);
              push = push * push;
              nx = dx / dist;
              ny = dy / dist;
              s.tx = nx * push * spread;
              s.ty = ny * push * spread - push * 10;
            } else {
              s.tx = 0;
              s.ty = 0;
            }
            s.x += (s.tx - s.x) * (local.on ? 0.28 : 0.16);
            s.y += (s.ty - s.y) * (local.on ? 0.28 : 0.16);
            if (!local.on && Math.abs(s.x) < 0.2 && Math.abs(s.y) < 0.2) {
              s.x = 0;
              s.y = 0;
            }
            ctx.drawImage(
              pack.ink,
              s.sx, s.sy, s.sw, s.sh,
              s.sx * scale + s.x,
              s.sy * scale + s.y,
              s.sw * scale,
              s.sh * scale
            );
          }
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

  document.querySelectorAll(".mosaic .panel").forEach(function (panel, index) {
    var img = panel.querySelector("img");
    if (!img) return;
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);
    window.setTimeout(function () {
      bindRelief(panel, img, canvas);
    }, 80 + index * 60);
  });
})();
