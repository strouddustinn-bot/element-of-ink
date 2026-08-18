(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  function magnetize(el) {
    if (!el || !fine || reduce) return;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.transform = "translate(" +
        ((e.clientX - (r.left + r.width / 2)) * 0.16) + "px," +
        ((e.clientY - (r.top + r.height / 2)) * 0.16) + "px)";
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

  function buildShards(img, pos) {
    var COLS = 22;
    var ROWS = 28;
    var src = document.createElement("canvas");
    src.width = COLS * 12;
    src.height = ROWS * 12;
    var sctx = src.getContext("2d", { willReadFrequently: true });
    if (!sctx) return null;
    try {
      paintCover(sctx, img, pos, src.width, src.height);
    } catch (err) {
      return null;
    }
    var cellW = src.width / COLS;
    var cellH = src.height / ROWS;
    var shards = [];
    var j, i;
    for (j = 0; j < ROWS; j++) {
      for (i = 0; i < COLS; i++) {
        var x = Math.floor(i * cellW);
        var y = Math.floor(j * cellH);
        var w = Math.ceil(cellW);
        var h = Math.ceil(cellH);
        var data;
        try {
          data = sctx.getImageData(x, y, w, h).data;
        } catch (err) {
          return null;
        }
        var p, ink = 0, count = 0;
        for (p = 0; p < data.length; p += 4) {
          var lum = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) / 255;
          var a = data[p + 3] / 255;
          if (a < 0.2) continue;
          count += 1;
          if (lum < 0.46) ink += 1;
        }
        if (!count || ink / count < 0.18) continue;
        var tile = document.createElement("canvas");
        tile.width = w;
        tile.height = h;
        var tctx = tile.getContext("2d");
        var copy = sctx.getImageData(x, y, w, h);
        var q;
        for (q = 0; q < copy.data.length; q += 4) {
          var L = (copy.data[q] * 0.299 + copy.data[q + 1] * 0.587 + copy.data[q + 2] * 0.114) / 255;
          if (L >= 0.46) copy.data[q + 3] = 0;
        }
        tctx.putImageData(copy, 0, 0);
        shards.push({
          tile: tile,
          u: i / COLS,
          v: j / ROWS,
          uw: 1 / COLS,
          vh: 1 / ROWS,
          dens: ink / count,
          ox: 0,
          oy: 0
        });
      }
    }
    var skin = document.createElement("canvas");
    skin.width = src.width;
    skin.height = src.height;
    var kctx = skin.getContext("2d");
    kctx.drawImage(src, 0, 0);
    var plate = kctx.getImageData(0, 0, skin.width, skin.height);
    var pd = plate.data;
    var n, skinR = 0, skinG = 0, skinB = 0, skinN = 0;
    for (n = 0; n < pd.length; n += 4) {
      var sl = (pd[n] * 0.299 + pd[n + 1] * 0.587 + pd[n + 2] * 0.114) / 255;
      if (sl >= 0.46 && pd[n + 3] > 40) {
        skinR += pd[n];
        skinG += pd[n + 1];
        skinB += pd[n + 2];
        skinN += 1;
      }
    }
    if (skinN) {
      skinR = Math.round(skinR / skinN);
      skinG = Math.round(skinG / skinN);
      skinB = Math.round(skinB / skinN);
      for (n = 0; n < pd.length; n += 4) {
        var il = (pd[n] * 0.299 + pd[n + 1] * 0.587 + pd[n + 2] * 0.114) / 255;
        if (il < 0.46) {
          pd[n] = skinR;
          pd[n + 1] = skinG;
          pd[n + 2] = skinB;
        }
      }
      kctx.putImageData(plate, 0, 0);
    }
    return shards.length ? { shards: shards, skin: skin } : null;
  }

  function bindShards(wrap, img, canvas) {
    if (!wrap || !img || !canvas) return;
    function start() {
      if (!img.naturalWidth) return;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      var pos = parsePos(img);
      var pack = buildShards(img, pos);
      if (!pack) return;
      var shards = pack.shards;
      var skin = pack.skin;

      var cursor = { x: -1, y: -1 };
      wrap.classList.add("is-live");

      function localPoint(e) {
        var r = wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        cursor.x = (e.clientX - r.left) / r.width;
        cursor.y = (e.clientY - r.top) / r.height;
      }
      function clearPoint() {
        cursor.x = -1;
        cursor.y = -1;
      }

      wrap.addEventListener("pointermove", localPoint, { passive: true });
      wrap.addEventListener("pointerenter", localPoint, { passive: true });
      wrap.addEventListener("pointerleave", clearPoint);
      if (wrap.parentElement && wrap.parentElement.classList.contains("hero")) {
        wrap.parentElement.addEventListener("pointermove", localPoint, { passive: true });
        wrap.parentElement.addEventListener("pointerleave", clearPoint);
      }

      function draw() {
        var w = canvas.clientWidth || wrap.clientWidth;
        var h = canvas.clientHeight || wrap.clientHeight;
        if (w >= 8 && h >= 8) {
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          var reach = Math.min(w, h) * 0.12;
          var s;
          for (s = 0; s < shards.length; s++) {
            var sh = shards[s];
            var cx = (sh.u + sh.uw * 0.5) * w;
            var cy = (sh.v + sh.vh * 0.5) * h;
            var tx = 0;
            var ty = 0;
            if (cursor.x >= 0) {
              var dx = cx - cursor.x * w;
              var dy = cy - cursor.y * h;
              var d = Math.sqrt(dx * dx + dy * dy);
              var t = 1 - Math.min(d / reach, 1);
              t = t * t * (3 - 2 * t);
              if (t > 0.001) {
                var push = t * (22 + sh.dens * 18);
                tx = (dx / (d + 6)) * push;
                ty = (dy / (d + 6)) * push;
              }
            }
            sh.ox += (tx - sh.ox) * 0.22;
            sh.oy += (ty - sh.oy) * 0.22;
          }

          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(skin, 0, 0, w, h);
          for (s = 0; s < shards.length; s++) {
            sh = shards[s];
            var dw = sh.uw * w + 1;
            var dh = sh.vh * h + 1;
            ctx.drawImage(
              sh.tile,
              0, 0, sh.tile.width, sh.tile.height,
              sh.u * w + sh.ox,
              sh.v * h + sh.oy,
              dw,
              dh
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
    bindShards(hero, document.getElementById("hero-img"), document.getElementById("hero-live"));
  }

  document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
    var img = panel.querySelector("img");
    if (!img) return;
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);
    var armed = false;
    function arm() {
      if (armed) return;
      armed = true;
      bindShards(panel, img, canvas);
    }
    panel.addEventListener("pointerenter", arm);
    if (img.complete && img.naturalWidth) arm();
    else img.addEventListener("load", arm, { once: true });
  });
})();
