(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var jobs = [];

  function magnetize(el) {
    if (!el || !fine || reduce) return;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      el.style.transform = "translate(" +
        ((e.clientX - (r.left + r.width / 2)) * 0.16) + "px," +
        ((e.clientY - (r.top + r.height / 2)) * 0.16) + "px)";
    });
    el.addEventListener("pointerleave", function () { el.style.transform = ""; });
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

  function coverUV(iw, ih, vw, vh, px, py) {
    var ir = iw / ih, vr = vw / vh;
    var sx = 1, sy = 1, u = 0, v = 0;
    if (ir > vr) { sx = vr / ir; u = (1 - sx) * px; }
    else { sy = ir / vr; v = (1 - sy) * py; }
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

  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function makeShards(cols, rows, seed) {
    var pts = [];
    var j, i;
    for (j = 0; j <= rows; j++) {
      pts[j] = [];
      for (i = 0; i <= cols; i++) {
        var jx = (i === 0 || i === cols) ? 0 : (hash(seed + i * 13 + j * 41) - 0.5) * 0.72;
        var jy = (j === 0 || j === rows) ? 0 : (hash(seed + i * 29 + j * 17 + 9) - 0.5) * 0.72;
        pts[j][i] = {
          x: (i + jx) / cols,
          y: (j + jy) / rows
        };
      }
    }
    var shards = [];
    for (j = 0; j < rows; j++) {
      for (i = 0; i < cols; i++) {
        var poly = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        var cx = (poly[0].x + poly[1].x + poly[2].x + poly[3].x) / 4;
        var cy = (poly[0].y + poly[1].y + poly[2].y + poly[3].y) / 4;
        shards.push({
          poly: poly,
          cx: cx,
          cy: cy,
          ox: 0,
          oy: 0,
          tox: 0,
          toy: 0
        });
      }
    }
    return shards;
  }

  function bindShards(eventRoot, wrap, img, canvas, seed) {
    if (!eventRoot || !wrap || !img || !canvas) return;
    function start() {
      if (!img.naturalWidth) return;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      var pos = parsePos(img);
      var shards = makeShards(7, 9, seed);
      wrap.classList.add("is-live");

      var local = { x: 0.5, y: 0.45, inside: false };

      function setPointer(e) {
        var r = wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        local.x = (e.clientX - r.left) / r.width;
        local.y = (e.clientY - r.top) / r.height;
        local.inside = true;
      }
      function clearPointer() {
        local.inside = false;
      }
      eventRoot.addEventListener("pointermove", setPointer, { passive: true });
      eventRoot.addEventListener("pointerenter", setPointer, { passive: true });
      eventRoot.addEventListener("pointerleave", clearPointer);

      jobs.push({
        draw: function () {
          var w = canvas.clientWidth || wrap.clientWidth;
          var h = canvas.clientHeight || wrap.clientHeight;
          if (w < 8 || h < 8) return;
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          var s, k, fall, d, dx, dy, push;
          var radius = 0.4;
          var maxPush = Math.min(w, h) * 0.13;
          for (k = 0; k < shards.length; k++) {
            s = shards[k];
            if (local.inside) {
              dx = s.cx - local.x;
              dy = s.cy - local.y;
              d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
              fall = 1 - d / radius;
              if (fall < 0) fall = 0;
              fall = fall * fall;
              push = fall * maxPush;
              s.tox = (dx / d) * push;
              s.toy = (dy / d) * push;
            } else {
              s.tox = 0;
              s.toy = 0;
            }
            s.ox += (s.tox - s.ox) * 0.22;
            s.oy += (s.toy - s.oy) * 0.22;
            if (Math.abs(s.ox) < 0.15) s.ox = 0;
            if (Math.abs(s.oy) < 0.15) s.oy = 0;
          }

          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = "#160b10";
          ctx.fillRect(0, 0, w, h);
          for (k = 0; k < shards.length; k++) {
            s = shards[k];
            ctx.save();
            ctx.translate(s.ox, s.oy);
            ctx.beginPath();
            ctx.moveTo(s.poly[0].x * w, s.poly[0].y * h);
            ctx.lineTo(s.poly[1].x * w, s.poly[1].y * h);
            ctx.lineTo(s.poly[2].x * w, s.poly[2].y * h);
            ctx.lineTo(s.poly[3].x * w, s.poly[3].y * h);
            ctx.closePath();
            ctx.clip();
            paintCover(ctx, img, pos, w, h);
            ctx.restore();
          }
        }
      });
    }
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  (function tick() {
    var i;
    for (i = 0; i < jobs.length; i++) jobs[i].draw();
    requestAnimationFrame(tick);
  })();

  var hero = document.getElementById("hero-photo");
  var heroImg = document.getElementById("hero-img");
  var heroCanvas = document.getElementById("hero-live");
  if (hero && heroImg && heroCanvas) {
    bindShards(hero.parentElement || hero, hero, heroImg, heroCanvas, 11);
  }

  document.querySelectorAll(".mosaic .panel").forEach(function (panel, index) {
    var img = panel.querySelector("img");
    if (!img) return;
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);
    bindShards(panel, panel, img, canvas, 21 + index * 17);
  });
})();
