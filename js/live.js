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

  if (reduce || !fine) return;

  // Safety override for any stale CSS from earlier particle prototypes.
  var safety = document.createElement("style");
  safety.textContent =
    ".mosaic .panel img{opacity:1!important}" +
    ".mosaic .panel .ink-live{opacity:1!important}";
  document.head.appendChild(safety);

  function coverUV(iw, ih, vw, vh, ox, oy) {
    var ir = iw / ih;
    var vr = vw / vh;
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
      0, 0, w, h
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

  function deterministicSeed(a, b) {
    var n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function buildLocalAverage(src) {
    var w = src.width;
    var h = src.height;
    var tiny = document.createElement("canvas");
    var avg = document.createElement("canvas");
    tiny.width = Math.max(24, Math.round(w / 11));
    tiny.height = Math.max(24, Math.round(h / 11));
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
    var confidence = new Uint8ClampedArray(w * h);

    if (maskImg) {
      var mc = document.createElement("canvas");
      mc.width = w;
      mc.height = h;
      var mctx = mc.getContext("2d", { willReadFrequently: true });
      paintCover(mctx, maskImg, pos, w, h);
      var md = mctx.getImageData(0, 0, w, h).data;
      for (var mi = 0, mp = 0; mi < md.length; mi += 4, mp++) {
        var rgb = Math.max(md[mi], md[mi + 1], md[mi + 2]);
        confidence[mp] = Math.round(rgb * (md[mi + 3] / 255));
      }
      return { confidence: confidence, explicit: true, average: buildLocalAverage(work) };
    }

    var avg = buildLocalAverage(work);
    var sctx = work.getContext("2d", { willReadFrequently: true });
    var actx = avg.getContext("2d", { willReadFrequently: true });
    var src = sctx.getImageData(0, 0, w, h).data;
    var local = actx.getImageData(0, 0, w, h).data;

    for (var i = 0, p = 0; i < src.length; i += 4, p++) {
      var lum = luminance(src, i);
      var baseLum = luminance(local, i);
      var contrast = Math.max(0, baseLum - lum);
      var darkness = clamp((0.60 - lum) / 0.42, 0, 1);
      var usableBase = clamp((baseLum - 0.19) / 0.40, 0, 1);
      var score = contrast * 5.2 + darkness * 0.22 * usableBase;

      if (baseLum < 0.17 || lum > 0.62) score = 0;

      confidence[p] = Math.round(
        clamp((score - 0.13) / 0.49, 0, 1) * 255
      );
    }

    return { confidence: confidence, explicit: false, average: avg };
  }

  function dilate(binary, w, h) {
    var out = new Uint8Array(binary.length);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!binary[i]) continue;
        for (var yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) {
          for (var xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
            out[yy * w + xx] = 1;
          }
        }
      }
    }
    return out;
  }

  function connectedComponents(confidence, w, h) {
    var base = new Uint8Array(confidence.length);
    for (var i = 0; i < confidence.length; i++) {
      if (confidence[i] >= 100) base[i] = 1;
    }

    // A one-pixel bridge reconnects broken outlines but generally keeps
    // neighboring tattoo details (such as separate suction cups) distinct.
    var binary = dilate(base, w, h);
    var seen = new Uint8Array(binary.length);
    var components = [];
    var qx = new Int32Array(binary.length);
    var qy = new Int32Array(binary.length);
    var dirs = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var start = y * w + x;
        if (!binary[start] || seen[start]) continue;

        var head = 0, tail = 0;
        qx[tail] = x;
        qy[tail] = y;
        tail++;
        seen[start] = 1;

        var pixels = [];
        var minX = x, minY = y, maxX = x, maxY = y;

        while (head < tail) {
          var cx = qx[head];
          var cy = qy[head];
          head++;

          var ci = cy * w + cx;
          if (confidence[ci] >= 72) {
            pixels.push(ci);
            if (cx < minX) minX = cx;
            if (cy < minY) minY = cy;
            if (cx > maxX) maxX = cx;
            if (cy > maxY) maxY = cy;
          }

          for (var d = 0; d < dirs.length; d++) {
            var nx = cx + dirs[d][0];
            var ny = cy + dirs[d][1];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var ni = ny * w + nx;
            if (!binary[ni] || seen[ni]) continue;
            seen[ni] = 1;
            qx[tail] = nx;
            qy[tail] = ny;
            tail++;
          }
        }

        if (pixels.length >= 5) {
          components.push({
            pixels: pixels,
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY
          });
        }
      }
    }

    return components;
  }

  function splitLargeComponent(component, w) {
    var bw = component.maxX - component.minX + 1;
    var bh = component.maxY - component.minY + 1;
    var area = component.pixels.length;

    // Small/medium connected features stay rigid as one visual object.
    // This is what lets a suction cup, tooth, eye, symbol, etc. move intact.
    if (area <= 380 && bw <= 54 && bh <= 54) {
      return [component.pixels];
    }

    // Large connected shading/outlines are divided into coherent local groups.
    // The sprite shape is still masked, so these never look like square tiles.
    var cell = 28;
    var buckets = Object.create(null);
    for (var i = 0; i < component.pixels.length; i++) {
      var pi = component.pixels[i];
      var x = pi % w;
      var y = Math.floor(pi / w);
      var bx = Math.floor((x - component.minX) / cell);
      var by = Math.floor((y - component.minY) / cell);
      var key = bx + ":" + by;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(pi);
    }

    var groups = [];
    Object.keys(buckets).forEach(function (key) {
      if (buckets[key].length >= 5) groups.push(buckets[key]);
    });
    return groups;
  }

  function makeGroup(pixelIndices, work, maskResult) {
    var w = work.width;
    var h = work.height;
    var srcCtx = work.getContext("2d", { willReadFrequently: true });
    var src = srcCtx.getImageData(0, 0, w, h).data;
    var avg = maskResult.average || buildLocalAverage(work);
    var avgData = avg.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, w, h).data;
    var conf = maskResult.confidence;

    var minX = w, minY = h, maxX = 0, maxY = 0;
    var sumX = 0, sumY = 0, sumWeight = 0;

    for (var i = 0; i < pixelIndices.length; i++) {
      var pi = pixelIndices[i];
      var x = pi % w;
      var y = Math.floor(pi / w);
      var weight = Math.max(1, conf[pi]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      sumX += x * weight;
      sumY += y * weight;
      sumWeight += weight;
    }

    if (!sumWeight) return null;

    var cx = sumX / sumWeight;
    var cy = sumY / sumWeight;
    var pad = 3;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);

    var sw = maxX - minX + 1;
    var sh = maxY - minY + 1;
    var sprite = document.createElement("canvas");
    var base = document.createElement("canvas");
    sprite.width = base.width = sw;
    sprite.height = base.height = sh;

    var sctx = sprite.getContext("2d");
    var bctx = base.getContext("2d");
    var sImg = sctx.createImageData(sw, sh);
    var bImg = bctx.createImageData(sw, sh);

    for (i = 0; i < pixelIndices.length; i++) {
      pi = pixelIndices[i];
      x = pi % w;
      y = Math.floor(pi / w);
      if (x < minX || y < minY || x > maxX || y > maxY) continue;

      var srcI = pi * 4;
      var localI = ((y - minY) * sw + (x - minX)) * 4;
      var alpha = Math.round(clamp((conf[pi] - 58) / 150, 0, 1) * 255);

      sImg.data[localI] = src[srcI];
      sImg.data[localI + 1] = src[srcI + 1];
      sImg.data[localI + 2] = src[srcI + 2];
      sImg.data[localI + 3] = alpha;

      bImg.data[localI] = avgData[srcI];
      bImg.data[localI + 1] = avgData[srcI + 1];
      bImg.data[localI + 2] = avgData[srcI + 2];
      bImg.data[localI + 3] = Math.round(alpha * 0.92);
    }

    sctx.putImageData(sImg, 0, 0);
    bctx.putImageData(bImg, 0, 0);

    var radius = 0.5 * Math.sqrt(
      (maxX - minX + 1) * (maxX - minX + 1) +
      (maxY - minY + 1) * (maxY - minY + 1)
    );

    return {
      cx: cx,
      cy: cy,
      relX: minX - cx,
      relY: minY - cy,
      width: sw,
      height: sh,
      radius: radius,
      sprite: sprite,
      base: base,
      seed: deterministicSeed(cx, cy),
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      angle: 0,
      va: 0
    };
  }

  function buildGroups(work, maskResult) {
    var w = work.width;
    var h = work.height;
    var components = connectedComponents(maskResult.confidence, w, h);
    var pixelGroups = [];

    for (var i = 0; i < components.length; i++) {
      var split = splitLargeComponent(components[i], w);
      for (var j = 0; j < split.length; j++) {
        pixelGroups.push(split[j]);
      }
    }

    // Prefer stronger, meaningful structures and cap CPU/memory use.
    pixelGroups.sort(function (a, b) { return b.length - a.length; });
    if (pixelGroups.length > 420) pixelGroups.length = 420;

    var groups = [];
    for (i = 0; i < pixelGroups.length; i++) {
      var group = makeGroup(pixelGroups[i], work, maskResult);
      if (group) groups.push(group);
    }

    return groups;
  }

  function createGroupedInteraction(opts) {
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
    var groups = buildGroups(work, maskResult);
    if (!groups.length) return null;

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
      cursor.x = clamp(e.clientX - r.left, 0, r.width);
      cursor.y = clamp(e.clientY - r.top, 0, r.height);
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
      var scaleX = w / work.width;
      var scaleY = h / work.height;
      var minScale = Math.min(scaleX, scaleY);
      var spring = 90;
      var damp = Math.exp(-15 * dt);
      var anyMoving = false;
      var activeCount = 0;

      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var homeX = g.cx * scaleX;
        var homeY = g.cy * scaleY;
        var radiusPx = g.radius * minScale;
        var targetX = 0;
        var targetY = 0;
        var targetZ = 0;
        var targetAngle = 0;
        var influence = 0;

        if (cursor.x >= 0) {
          var dx = homeX - cursor.x;
          var dy = homeY - cursor.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var edgeDist = Math.max(0, dist - radiusPx * 0.48);
          var field = 68 + Math.min(22, radiusPx * 0.18);

          if (edgeDist < field) {
            influence = 1 - edgeDist / field;
            influence = influence * influence * (3 - 2 * influence);

            if (dist < 0.001) {
              dx = g.seed - 0.5;
              dy = 0.5 - deterministicSeed(g.cy, g.cx);
              dist = Math.sqrt(dx * dx + dy * dy) || 1;
            }

            var nx = dx / dist;
            var ny = dy / dist;
            var push = (18 + Math.min(14, radiusPx * 0.16)) * influence;
            targetX = nx * push;
            targetY = ny * push;
            targetZ = influence;
            targetAngle = (g.seed - 0.5) * 0.13 * influence;
          }
        }

        g.vx += (targetX - g.ox) * spring * dt;
        g.vy += (targetY - g.oy) * spring * dt;
        g.vz += (targetZ - g.z) * 74 * dt;
        g.va += (targetAngle - g.angle) * 64 * dt;

        g.vx *= damp;
        g.vy *= damp;
        g.vz *= Math.exp(-13 * dt);
        g.va *= Math.exp(-14 * dt);

        g.ox += g.vx * dt;
        g.oy += g.vy * dt;
        g.z += g.vz * dt;
        g.angle += g.va * dt;

        var motion = Math.sqrt(g.ox * g.ox + g.oy * g.oy);
        var active = influence > 0.01 || motion > 0.16 || Math.abs(g.z) > 0.01 || Math.abs(g.angle) > 0.002;

        if (!active) {
          if (cursor.x < 0) {
            g.ox = g.oy = g.vx = g.vy = 0;
            g.z = g.vz = 0;
            g.angle = g.va = 0;
          }
          continue;
        }

        anyMoving = true;
        activeCount++;

        var holeAlpha = clamp(motion / 5 + g.z * 0.72, 0, 0.96);

        // Reveal only the exact masked structure that moved away.
        ctx.save();
        ctx.globalAlpha = holeAlpha;
        ctx.translate(homeX, homeY);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(g.base, g.relX, g.relY);
        ctx.restore();

        // Draw the feature as one rigid masked sprite.
        ctx.save();
        ctx.translate(homeX + g.ox, homeY + g.oy - g.z * 5);
        ctx.rotate(g.angle);
        var liftScale = 1 + g.z * 0.045;
        ctx.scale(scaleX * liftScale, scaleY * liftScale);
        ctx.shadowColor = "rgba(10,4,7," + clamp(g.z * 0.30, 0, 0.24) + ")";
        ctx.shadowBlur = g.z * 6;
        ctx.shadowOffsetY = g.z * 3;
        ctx.drawImage(g.sprite, g.relX, g.relY);
        ctx.restore();

        if (debug) {
          ctx.strokeStyle = "rgba(243,193,90,.28)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(homeX, homeY, Math.max(2, radiusPx * 0.35), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (debug && cursor.x >= 0) {
        ctx.strokeStyle = "rgba(243,193,90,.65)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 68, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (hud) {
        hud.textContent =
          groups.length + " rigid groups · " +
          activeCount + " active · " +
          fps + " fps · " +
          (maskResult.explicit ? "explicit mask" : "auto segmentation");
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
      groups: groups,
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
      loadOptional(img.getAttribute("data-ink-mask")).then(function (mask) {
        createGroupedInteraction({
          container: panel,
          image: img,
          canvas: canvas,
          mask: mask
        });
      });
    }

    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
    var img = panel.querySelector("img");

    // Amanda's seated artist portrait is intentionally excluded.
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
