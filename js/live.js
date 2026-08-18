(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var debug = /(?:\?|&)inkDebug=1(?:&|$)/.test(location.search);

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

  if (reduce) return;

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

  function loadOptional(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  function makeMask(src, w, h, maskImg) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d", { willReadFrequently: true });
    if (maskImg) {
      ctx.drawImage(maskImg, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    }
    ctx.drawImage(src, 0, 0);
    var data = ctx.getImageData(0, 0, w, h);
    var p = data.data, i;
    for (i = 0; i < p.length; i += 4) {
      var lum = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
      var ink = lum < 0.38 ? 255 : 0;
      p[i] = p[i + 1] = p[i + 2] = ink;
      p[i + 3] = 255;
    }
    return data;
  }

  function makeSkin(src, mask, w, h, plateImg) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    if (plateImg) {
      ctx.drawImage(plateImg, 0, 0, w, h);
      return c;
    }
    ctx.drawImage(src, 0, 0);
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data, m = mask.data;
    var sr = 0, sg = 0, sb = 0, n = 0, i;
    for (i = 0; i < d.length; i += 4) {
      if (m[i] < 40) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n += 1; }
    }
    if (n) {
      sr = Math.round(sr / n); sg = Math.round(sg / n); sb = Math.round(sb / n);
      for (i = 0; i < d.length; i += 4) {
        if (m[i] > 80) { d[i] = sr; d[i + 1] = sg; d[i + 2] = sb; }
      }
      ctx.putImageData(img, 0, 0);
    }
    return c;
  }

  function spawnParticles(src, mask, count) {
    var w = src.width, h = src.height;
    var sctx = src.getContext("2d", { willReadFrequently: true });
    var pix = sctx.getImageData(0, 0, w, h).data;
    var m = mask.data;
    var homes = [];
    var x, y, i;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = (y * w + x) * 4;
        if (m[i] > 90) homes.push(x, y, pix[i], pix[i + 1], pix[i + 2]);
      }
    }
    var avail = homes.length / 5;
    if (!avail) return null;
    var stride = Math.max(1, Math.floor(avail / count));
    var out = [];
    for (i = 0; i < avail && out.length < count; i += stride) {
      var o = i * 5;
      var seed = Math.random();
      out.push({
        hx: homes[o] / w,
        hy: homes[o + 1] / h,
        x: homes[o] / w,
        y: homes[o + 1] / h,
        vx: 0, vy: 0, z: 0, vz: 0,
        r: homes[o + 2], g: homes[o + 3], b: homes[o + 4],
        size: 1.2 + seed * 2.6,
        seed: seed,
        ang: 0
      });
    }
    return out.length ? out : null;
  }

  function createInkInteraction(opts) {
    var wrap = opts.container;
    var img = opts.image;
    var canvas = opts.canvas;
    if (!wrap || !img || !canvas || !img.naturalWidth) return null;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var pos = parsePos(img);
    var work = document.createElement("canvas");
    work.width = 360;
    work.height = Math.round(360 * img.naturalHeight / img.naturalWidth);
    var wctx = work.getContext("2d");
    paintCover(wctx, img, pos, work.width, work.height);

    var mask = makeMask(work, work.width, work.height, opts.mask || null);
    var skin = makeSkin(work, mask, work.width, work.height, opts.cleanPlate || null);
    var particles = spawnParticles(work, mask, opts.count || 9000);
    if (!particles) return null;

    var cursor = { x: -1, y: -1, px: 70 };
    wrap.classList.add("is-live");

    function localPoint(e) {
      var r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      cursor.x = (e.clientX - r.left) / r.width;
      cursor.y = (e.clientY - r.top) / r.height;
      cursor.px = 72;
    }
    function clearPoint() { cursor.x = -1; cursor.y = -1; }

    wrap.addEventListener("pointermove", localPoint, { passive: true });
    wrap.addEventListener("pointerenter", localPoint, { passive: true });
    wrap.addEventListener("pointerleave", clearPoint);

    var hud = null;
    if (debug) {
      hud = document.createElement("div");
      hud.style.cssText = "position:absolute;left:6px;top:6px;z-index:5;font:11px/1.3 monospace;color:#f3c15a;background:rgba(0,0,0,.55);padding:4px 6px;pointer-events:none";
      wrap.appendChild(hud);
    }

    var last = performance.now();
    var frames = 0, fps = 0, acc = 0;

    function tick(now) {
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      frames += 1; acc += dt;
      if (acc >= 0.5) { fps = Math.round(frames / acc); frames = 0; acc = 0; }

      var w = canvas.clientWidth || wrap.clientWidth;
      var h = canvas.clientHeight || wrap.clientHeight;
      if (w > 8 && h > 8) {
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        var radius = 72 / Math.min(w, h);
        var maxPush = 30 / Math.min(w, h);
        var p, dx, dy, dist, infl, nx, ny;
        for (var i = 0; i < particles.length; i++) {
          p = particles[i];
          if (cursor.x >= 0) {
            dx = p.x - cursor.x;
            dy = p.y - cursor.y;
            dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
            infl = 1 - Math.min(dist / radius, 1);
            infl = infl * infl;
            nx = dx / dist; ny = dy / dist;
            p.vx += nx * infl * 2.6;
            p.vy += ny * infl * 2.6;
            p.vz += infl * 0.9;
          }
          p.vx += (p.hx - p.x) * 18 * dt;
          p.vy += (p.hy - p.y) * 18 * dt;
          p.vz += (0 - p.z) * 16 * dt;
          p.vx *= 0.78; p.vy *= 0.78; p.vz *= 0.8;
          p.x += p.vx * dt * 8;
          p.y += p.vy * dt * 8;
          p.z += p.vz * dt;
          if (p.z < 0) p.z = 0;
          var ox = p.x - p.hx, oy = p.y - p.hy;
          var mag = Math.sqrt(ox * ox + oy * oy);
          if (mag > maxPush) {
            p.x = p.hx + ox / mag * maxPush;
            p.y = p.hy + oy / mag * maxPush;
          }
          p.ang = (p.seed - 0.5) * p.z * 1.4;
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(skin, 0, 0, w, h);
        for (i = 0; i < particles.length; i++) {
          p = particles[i];
          var lift = p.z;
          var s = p.size * (1 + lift * 0.55);
          var px = p.x * w;
          var py = p.y * h - lift * 10;
          if (lift > 0.08) {
            ctx.fillStyle = "rgba(20,8,10," + Math.min(0.35, lift * 0.28) + ")";
            ctx.beginPath();
            ctx.ellipse(px, py + 4 + lift * 6, s * 0.7, s * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          var shade = 0.82 + lift * 0.28;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.ang);
          ctx.fillStyle = "rgb(" +
            Math.min(255, p.r * shade) + "," +
            Math.min(255, p.g * shade) + "," +
            Math.min(255, p.b * shade) + ")";
          ctx.fillRect(-s * 0.5, -s * 0.35, s, s * 0.7);
          ctx.restore();
        }

        if (hud) {
          hud.textContent = particles.length + " pigment · " + fps + " fps";
          if (cursor.x >= 0) {
            ctx.strokeStyle = "rgba(243,193,90,.45)";
            ctx.beginPath();
            ctx.arc(cursor.x * w, cursor.y * h, 72, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return { particles: particles };
  }

  function bindPanel(panel, img) {
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);
    function start() {
      var base = img.getAttribute("src") || "";
      var stem = base.replace(/\.[^.]+$/, "");
      Promise.all([
        loadOptional(img.getAttribute("data-ink-mask") || stem + ".mask.png"),
        loadOptional(img.getAttribute("data-ink-skin") || stem + ".skin.jpg")
      ]).then(function (pair) {
        createInkInteraction({
          container: panel,
          image: img,
          canvas: canvas,
          mask: pair[0],
          cleanPlate: pair[1],
          count: fine ? 10000 : 5000
        });
      });
    }
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
    var img = panel.querySelector("img");
    if (!img || img.getAttribute("data-no-ink")) return;
    var armed = false;
    function arm() {
      if (armed) return;
      armed = true;
      bindPanel(panel, img);
    }
    panel.addEventListener("pointerenter", arm, { once: true });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) arm();
      }, { rootMargin: "80px" });
      io.observe(panel);
    }
  });
})();
