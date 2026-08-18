(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var debug = /(?:\?|&)inkDebug=1(?:&|$)/.test(location.search);

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

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

  // Progressive enhancement: preserve original photos for touch and reduced motion.
  if (reduce || !fine) return;

  function coverUV(iw, ih, vw, vh, ox, oy) {
    var ir = iw / ih, vr = vw / vh;
    var sx = 1, sy = 1, u = 0, v = 0;
    if (ir > vr) {
      sx = vr / ir;
      u = (1 - sx) * ox;
    } else {
      sy = ir / vr;
      v = (1 - sy) * oy;
    }
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
      c.u * img.naturalWidth,
      c.v * img.naturalHeight,
      c.sx * img.naturalWidth,
      c.sy * img.naturalHeight,
      0,
      0,
      w,
      h
    );
  }

  function loadOptional(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  function luminance(data, i) {
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  }

  function deterministicSeed(x, y) {
    var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function buildLocalAverage(src) {
    var w = src.width;
    var h = src.height;
    var tiny = document.createElement("canvas");
    var avg = document.createElement("canvas");
    tiny.width = Math.max(24, Math.round(w / 10));
    tiny.height = Math.max(24, Math.round(h / 10));
    avg.width = w;
    avg.height = h;

    var tctx = tiny.getContext("2d");
    var actx = avg.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(src, 0, 0, tiny.width, tiny.height);
    actx.imageSmoothingEnabled = true;
    actx.imageSmoothingQuality = "high";
    actx.drawImage(tiny, 0, 0, w, h);
    return avg;
  }

  function buildMask(work, maskImg, pos) {
    var w = work.width;
    var h = work.height;
    var result = {
      confidence: new Uint8ClampedArray(w * h),
      explicit: !!maskImg,
      average: null
    };

    if (maskImg) {
      var mc = document.createElement("canvas");
      mc.width = w;
      mc.height = h;
      var mctx = mc.getContext("2d", { willReadFrequently: true });
      paintCover(mctx, maskImg, pos, w, h);
      var md = mctx.getImageData(0, 0, w, h).data;
      for (var mi = 0, mp = 0; mi < md.length; mi += 4, mp++) {
        var rgb = Math.max(md[mi], md[mi + 1], md[mi + 2]);
        result.confidence[mp] = Math.round(rgb * (md[mi + 3] / 255));
      }
      return result;
    }

    // Conservative fallback: locally dark detail, not every dark pixel.
    var avg = buildLocalAverage(work);
    result.average = avg;
    var sctx = work.getContext("2d", { willReadFrequently: true });
    var actx = avg.getContext("2d", { willReadFrequently: true });
    var src = sctx.getImageData(0, 0, w, h).data;
    var local = actx.getImageData(0, 0, w, h).data;

    for (var i = 0, p = 0; i < src.length; i += 4, p++) {
      var lum = luminance(src, i);
      var baseLum = luminance(local, i);
      var contrast = Math.max(0, baseLum - lum);
      var darkness = clamp((0.62 - lum) / 0.44, 0, 1);
      var lightContext = clamp((baseLum - 0.20) / 0.38, 0, 1);
      var score = contrast * 4.6 + darkness * 0.28 * lightContext;
      if (baseLum < 0.18 || lum > 0.64) score = 0;
      var confidence = clamp((score - 0.10) / 0.52, 0, 1);
      result.confidence[p] = Math.round(confidence * 255);
    }

    return result;
  }

  function nearestBaseColor(pix, avgPix, mask, w, h, x, y) {
    var radii = [3, 6, 10, 15];
    var dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [0.707, 0.707], [-0.707, 0.707],
      [0.707, -0.707], [-0.707, -0.707]
    ];

    for (var ri = 0; ri < radii.length; ri++) {
      var r = radii[ri];
      var sr = 0, sg = 0, sb = 0, n = 0;
      for (var di = 0; di < dirs.length; di++) {
        var sx = Math.round(x + dirs[di][0] * r);
        var sy = Math.round(y + dirs[di][1] * r);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        var pi = sy * w + sx;
        if (mask[pi] > 42) continue;
        var oi = pi * 4;
        sr += pix[oi];
        sg += pix[oi + 1];
        sb += pix[oi + 2];
        n++;
      }
      if (n >= 2) {
        return {
          r: Math.round(sr / n),
          g: Math.round(sg / n),
          b: Math.round(sb / n)
        };
      }
    }

    var index = (y * w + x) * 4;
    var fallback = avgPix || pix;
    return {
      r: fallback[index],
      g: fallback[index + 1],
      b: fallback[index + 2]
    };
  }

  function spawnParticles(work, maskResult, count) {
    var w = work.width;
    var h = work.height;
    var ctx = work.getContext("2d", { willReadFrequently: true });
    var pix = ctx.getImageData(0, 0, w, h).data;
    var confidence = maskResult.confidence;
    var average = maskResult.average || buildLocalAverage(work);
    var avgPix = average.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, w, h).data;

    var eligible = 0;
    for (var i = 0; i < confidence.length; i++) {
      if (confidence[i] >= 78) eligible++;
    }
    if (!eligible) return null;

    var probability = Math.min(1, count / eligible);
    var particles = [];

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var pi = y * w + x;
        var conf = confidence[pi] / 255;
        if (conf < 0.30) continue;

        var seed = deterministicSeed(x, y);
        if (seed > probability * (0.55 + conf * 0.65)) continue;

        var oi = pi * 4;
        var base = nearestBaseColor(pix, avgPix, confidence, w, h, x, y);
        particles.push({
          hx: x / w,
          hy: y / h,
          x: x / w,
          y: y / h,
          vx: 0,
          vy: 0,
          z: 0,
          vz: 0,
          r: pix[oi],
          g: pix[oi + 1],
          b: pix[oi + 2],
          br: base.r,
          bg: base.g,
          bb: base.b,
          size: 0.75 + seed * 1.8,
          aspect: 0.55 + deterministicSeed(y, x) * 0.75,
          seed: seed,
          confidence: conf,
          ang: (seed - 0.5) * 0.9
        });

        if (particles.length >= count) return particles;
      }
    }

    return particles.length ? particles : null;
  }

  function createInkInteraction(opts) {
    var wrap = opts.container;
    var img = opts.image;
    var canvas = opts.canvas;
    if (!wrap || !img || !canvas || !img.naturalWidth) return null;

    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var pos = parsePos(img);
    var displayW = Math.max(1, wrap.clientWidth);
    var displayH = Math.max(1, wrap.clientHeight);
    var work = document.createElement("canvas");
    work.width = 360;
    work.height = Math.max(1, Math.round(360 * displayH / displayW));
    var wctx = work.getContext("2d");
    paintCover(wctx, img, pos, work.width, work.height);

    var maskResult = buildMask(work, opts.mask || null, pos);
    var particles = spawnParticles(work, maskResult, opts.count || 5200);
    if (!particles) return null;

    // Overlay only. Never replace or hide the real photograph.
    img.style.opacity = "1";
    canvas.style.opacity = "1";
    canvas.style.zIndex = "1";

    var cursor = { x: -1, y: -1 };
    var running = false;
    var raf = 0;
    var last = 0;
    var fpsFrames = 0;
    var fpsTime = 0;
    var fps = 0;

    var hud = null;
    if (debug) {
      hud = document.createElement("div");
      hud.style.cssText =
        "position:absolute;left:6px;top:6px;z-index:5;" +
        "font:11px/1.3 monospace;color:#f3c15a;" +
        "background:rgba(0,0,0,.62);padding:4px 6px;pointer-events:none";
      wrap.appendChild(hud);
    }

    function sizeCanvas() {
      var w = Math.max(1, canvas.clientWidth || wrap.clientWidth);
      var h = Math.max(1, canvas.clientHeight || wrap.clientHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var dw = Math.round(w * dpr);
      var dh = Math.round(h * dpr);
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: w, h: h };
    }

    function kick() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function localPoint(e) {
      var r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      cursor.x = clamp((e.clientX - r.left) / r.width, 0, 1);
      cursor.y = clamp((e.clientY - r.top) / r.height, 0, 1);
      kick();
    }

    function clearPoint() {
      cursor.x = -1;
      cursor.y = -1;
      kick();
    }

    wrap.addEventListener("pointermove", localPoint, { passive: true });
    wrap.addEventListener("pointerenter", localPoint, { passive: true });
    wrap.addEventListener("pointerleave", clearPoint);

    function tick(now) {
      var dt = clamp((now - last) / 1000, 0.001, 0.033);
      last = now;
      fpsFrames++;
      fpsTime += dt;
      if (fpsTime >= 0.5) {
        fps = Math.round(fpsFrames / fpsTime);
        fpsFrames = 0;
        fpsTime = 0;
      }

      var sz = sizeCanvas();
      var w = sz.w;
      var h = sz.h;
      var minDim = Math.min(w, h);
      var radius = 72 / minDim;
      var maxPush = 28 / minDim;
      var spring = 105;
      var damping = 17;
      var damp = Math.exp(-damping * dt);
      var anyMoving = false;
      var activeCount = 0;

      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var tx = p.hx;
        var ty = p.hy;
        var tz = 0;
        var influence = 0;

        if (cursor.x >= 0) {
          var dx = p.hx - cursor.x;
          var dy = p.hy - cursor.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius) {
            influence = 1 - dist / radius;
            influence = influence * influence * (3 - 2 * influence);
            var inv = 1 / Math.max(dist, 0.0001);
            var nx = dx * inv;
            var ny = dy * inv;
            var travel = maxPush * influence * (0.78 + p.seed * 0.44);
            tx = p.hx + nx * travel;
            ty = p.hy + ny * travel;
            tz = influence * (0.55 + p.seed * 0.45);
          }
        }

        p.vx += (tx - p.x) * spring * dt;
        p.vy += (ty - p.y) * spring * dt;
        p.vz += (tz - p.z) * 92 * dt;
        p.vx *= damp;
        p.vy *= damp;
        p.vz *= Math.exp(-15 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        var offX = p.x - p.hx;
        var offY = p.y - p.hy;
        var displacement = Math.sqrt(offX * offX + offY * offY);
        var visuallyActive = influence > 0.012 || displacement > 0.00045 || p.z > 0.012;

        if (!visuallyActive) {
          if (cursor.x < 0) {
            p.x = p.hx;
            p.y = p.hy;
            p.z = 0;
            p.vx = p.vy = p.vz = 0;
          }
          continue;
        }

        anyMoving = true;
        activeCount++;

        var homeX = p.hx * w;
        var homeY = p.hy * h;
        var liftPx = p.z * (7 + p.seed * 9);
        var px = p.x * w;
        var py = p.y * h - liftPx;
        var scale = 1 + p.z * 0.36;
        var s = p.size * scale;
        var hole = Math.max(1.15, p.size * 0.82);

        // Hide only the tiny home spot that actually lost pigment.
        var holeAlpha = clamp((displacement * minDim) / 4.5 + p.z * 0.65, 0, 0.92);
        if (holeAlpha > 0.03) {
          ctx.fillStyle = "rgba(" + p.br + "," + p.bg + "," + p.bb + "," + holeAlpha + ")";
          ctx.beginPath();
          ctx.ellipse(homeX, homeY, hole * 0.72, hole * 0.52, p.ang, 0, Math.PI * 2);
          ctx.fill();
        }

        if (p.z > 0.035) {
          ctx.fillStyle = "rgba(12,6,8," + clamp(p.z * 0.20, 0, 0.20) + ")";
          ctx.beginPath();
          ctx.ellipse(
            px + 1.2,
            py + 2.5 + liftPx * 0.26,
            s * 0.62,
            s * 0.28,
            p.ang,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        var shade = 0.92 + p.z * 0.12;
        var rr = Math.round(clamp(p.r * shade, 0, 255));
        var gg = Math.round(clamp(p.g * shade, 0, 255));
        var bb = Math.round(clamp(p.b * shade, 0, 255));

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.ang + (p.seed - 0.5) * p.z * 0.8);
        ctx.fillStyle = "rgb(" + rr + "," + gg + "," + bb + ")";
        ctx.beginPath();
        ctx.moveTo(-s * 0.58, -s * 0.10);
        ctx.lineTo(-s * 0.12, -s * 0.48 * p.aspect);
        ctx.lineTo(s * 0.56, -s * 0.08);
        ctx.lineTo(s * 0.20, s * 0.42 * p.aspect);
        ctx.lineTo(-s * 0.42, s * 0.30 * p.aspect);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (debug && cursor.x >= 0) {
        ctx.strokeStyle = "rgba(243,193,90,.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursor.x * w, cursor.y * h, 72, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (hud) {
        hud.textContent =
          particles.length + " candidates · " +
          activeCount + " active · " +
          fps + " fps · " +
          (maskResult.explicit ? "explicit mask" : "auto mask");
      }

      if (cursor.x >= 0 || anyMoving) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        running = false;
        raf = 0;
      }
    }

    return {
      particles: particles,
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        running = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }

  function bindPanel(panel, img) {
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);

    function start() {
      Promise.all([
        loadOptional(img.getAttribute("data-ink-mask")),
        loadOptional(img.getAttribute("data-ink-skin"))
      ]).then(function (pair) {
        createInkInteraction({
          container: panel,
          image: img,
          canvas: canvas,
          mask: pair[0],
          cleanPlate: pair[1],
          count: 5200
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
  });
})();
