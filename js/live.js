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

  function lumOf(d, i) {
    return (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
  }

  function buildShards(img, pos) {
    var COLS = 24;
    var ROWS = 30;
    var src = document.createElement("canvas");
    src.width = COLS * 10;
    src.height = ROWS * 10;
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
        var w = Math.max(1, Math.ceil(cellW));
        var h = Math.max(1, Math.ceil(cellH));
        var copy;
        try {
          copy = sctx.getImageData(x, y, w, h);
        } catch (err) {
          return null;
        }
        var d = copy.data;
        var p, count = 0, sum = 0, dark = 0;
        var lightR = 0, lightG = 0, lightB = 0, lightN = 0;
        for (p = 0; p < d.length; p += 4) {
          if (d[p + 3] < 40) continue;
          var L = lumOf(d, p);
          count += 1;
          sum += L;
          if (L < 0.34) dark += 1;
          else {
            lightR += d[p];
            lightG += d[p + 1];
            lightB += d[p + 2];
            lightN += 1;
          }
        }
        if (!count || dark / count < 0.22) continue;
        var mean = sum / count;
        var cut = Math.min(0.34, mean * 0.78);
        var ink = document.createElement("canvas");
        var hole = document.createElement("canvas");
        ink.width = hole.width = w;
        ink.height = hole.height = h;
        var inkC = ink.getContext("2d");
        var holeC = hole.getContext("2d");
        var inkData = sctx.getImageData(x, y, w, h);
        var holeData = sctx.getImageData(x, y, w, h);
        var ir = lightN ? Math.round(lightR / lightN) : 160;
        var ig = lightN ? Math.round(lightG / lightN) : 140;
        var ib = lightN ? Math.round(lightB / lightN) : 130;
        var q, inkN = 0;
        for (q = 0; q < inkData.data.length; q += 4) {
          var LL = lumOf(inkData.data, q);
          if (LL <= cut) {
            inkN += 1;
            holeData.data[q] = ir;
            holeData.data[q + 1] = ig;
            holeData.data[q + 2] = ib;
          } else {
            inkData.data[q + 3] = 0;
          }
        }
        if (inkN < 8) continue;
        inkC.putImageData(inkData, 0, 0);
        holeC.putImageData(holeData, 0, 0);
        shards.push({
          ink: ink,
          hole: hole,
          u: i / COLS,
          v: j / ROWS,
          uw: 1 / COLS,
          vh: 1 / ROWS,
          dens: dark / count,
          ox: 0,
          oy: 0
        });
      }
    }
    return shards.length ? { shards: shards, src: src } : null;
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

          var reach = Math.min(w, h) * 0.11;
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
              if (t > 0.02) {
                var push = t * (18 + sh.dens * 14);
                tx = (dx / (d + 8)) * push;
                ty = (dy / (d + 8)) * push;
              }
            }
            sh.ox += (tx - sh.ox) * 0.24;
            sh.oy += (ty - sh.oy) * 0.24;
          }

          ctx.clearRect(0, 0, w, h);
          paintCover(ctx, img, pos, w, h);
          for (s = 0; s < shards.length; s++) {
            sh = shards[s];
            if (Math.abs(sh.ox) + Math.abs(sh.oy) < 0.35) continue;
            var dw = sh.uw * w + 1;
            var dh = sh.vh * h + 1;
            ctx.drawImage(sh.hole, 0, 0, sh.hole.width, sh.hole.height, sh.u * w, sh.v * h, dw, dh);
            ctx.drawImage(sh.ink, 0, 0, sh.ink.width, sh.ink.height, sh.u * w + sh.ox, sh.v * h + sh.oy, dw, dh);
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
  if (hero) bindShards(hero, document.getElementById("hero-img"), document.getElementById("hero-live"));

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
  });
})();
