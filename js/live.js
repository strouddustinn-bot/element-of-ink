(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  var mouse = { x: 0.5, y: 0.42, tx: 0.5, ty: 0.42 };
  window.addEventListener("pointermove", function (e) {
    mouse.tx = e.clientX / Math.max(1, window.innerWidth);
    mouse.ty = e.clientY / Math.max(1, window.innerHeight);
  }, { passive: true });
  (function tickMouse() {
    mouse.x += (mouse.tx - mouse.x) * 0.16;
    mouse.y += (mouse.ty - mouse.y) * 0.16;
    requestAnimationFrame(tickMouse);
  })();

  function magnetize(el) {
    if (!el || !fine || reduce) return;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var x = e.clientX - (r.left + r.width / 2);
      var y = e.clientY - (r.top + r.height / 2);
      el.style.transform = "translate(" + (x * 0.18) + "px," + (y * 0.18) + "px)";
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

  function sampleHeights(img, pos, N) {
    var cnv = document.createElement("canvas");
    cnv.width = N;
    cnv.height = N;
    var ctx = cnv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    var c = coverUV(img.naturalWidth, img.naturalHeight, N, N, pos.x, pos.y);
    try {
      ctx.drawImage(
        img,
        c.u * img.naturalWidth, c.v * img.naturalHeight,
        c.sx * img.naturalWidth, c.sy * img.naturalHeight,
        0, 0, N, N
      );
      var data = ctx.getImageData(0, 0, N, N).data;
    } catch (err) {
      return null;
    }
    var h = new Float32Array(N * N);
    var i;
    for (i = 0; i < N * N; i++) {
      var o = i * 4;
      var lum = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
      var ink = 1 - lum;
      if (ink < 0.12) ink = 0;
      else ink = (ink - 0.12) / 0.88;
      h[i] = ink * ink * (3 - 2 * ink);
    }
    return h;
  }

  function liveWarp(wrap, img, canvas) {
    if (!wrap || !img || !canvas || !img.naturalWidth) return false;
    var ctx = canvas.getContext("2d");
    if (!ctx) return false;
    var pos = parsePos(img);
    var N = 32;
    var heights = sampleHeights(img, pos, N);
    if (!heights) return false;

    var cells = [];
    var i, j;
    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        var ht = heights[j * N + i];
        if (ht > 0.05) cells.push({ i: i, j: j, ht: ht });
      }
    }
    cells.sort(function (a, b) { return a.ht - b.ht; });
    if (!cells.length) return false;

    wrap.classList.add("is-live");

    function draw() {
      var w = canvas.clientWidth || wrap.clientWidth;
      var h = canvas.clientHeight || wrap.clientHeight;
      if (w < 8 || h < 8) {
        requestAnimationFrame(draw);
        return;
      }
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      var cov = coverUV(img.naturalWidth, img.naturalHeight, w, h, pos.x, pos.y);
      var sx0 = cov.u * img.naturalWidth;
      var sy0 = cov.v * img.naturalHeight;
      var sw = cov.sx * img.naturalWidth;
      var sh = cov.sy * img.naturalHeight;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, sx0, sy0, sw, sh, 0, 0, w, h);

      var cw = w / N;
      var ch = h / N;
      var mx = mouse.x;
      var my = mouse.y;
      var k;
      for (k = 0; k < cells.length; k++) {
        var c = cells[k];
        var lift = c.ht;
        var dx = (mx - (c.i + 0.5) / N) * lift * w * 0.22;
        var dy = (my - (c.j + 0.5) / N) * lift * h * 0.22;
        var dw = cw * (1 + lift * 1.35);
        var dh = ch * (1 + lift * 1.35);
        var x = c.i * cw - (dw - cw) / 2 + dx;
        var y = c.j * ch - (dh - ch) / 2 + dy;
        ctx.drawImage(
          img,
          sx0 + (c.i / N) * sw,
          sy0 + (c.j / N) * sh,
          sw / N + 0.5,
          sh / N + 0.5,
          x, y, dw, dh
        );
      }
      requestAnimationFrame(draw);
    }
    draw();
    return true;
  }

  function bindRelief(wrap, img, canvas) {
    if (!wrap || !img || !canvas) return;
    function start() {
      liveWarp(wrap, img, canvas);
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
