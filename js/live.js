(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  var debug = /(?:\?|&)inkDebug=1(?:&|$)/.test(location.search);

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function deterministicSeed(a, b) {
    var n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function luminance(data, i) {
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
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

  function installTattooCursor() {
    var oldOrb = document.getElementById("orb");
    if (oldOrb) oldOrb.style.display = "none";
    if (!fine || reduce) return;

    document.documentElement.classList.add("has-orb");

    var style = document.createElement("style");
    style.textContent =
      "#tattoo-machine-cursor{" +
      "position:fixed;left:0;top:0;width:58px;height:58px;z-index:140;" +
      "pointer-events:none;opacity:0;transform:translate3d(-100px,-100px,0);" +
      "transition:opacity .16s ease,filter .16s ease;" +
      "filter:drop-shadow(0 3px 4px rgba(0,0,0,.58));will-change:transform}" +
      "#tattoo-machine-cursor svg{display:block;width:100%;height:100%;overflow:visible}" +
      "#tattoo-machine-cursor.is-hot{filter:drop-shadow(0 3px 5px rgba(0,0,0,.65)) drop-shadow(0 0 5px rgba(224,180,90,.28))}" +
      "#tattoo-machine-cursor.is-ink .needle{animation:eoi-needle .11s linear infinite alternate}" +
      "@keyframes eoi-needle{from{transform:translate(0,0)}to{transform:translate(-.7px,1.2px)}}" +
      ".mosaic .panel img{opacity:1!important}" +
      ".mosaic .panel .ink-live{opacity:1!important}" +
      "#orb{display:none!important}";
    document.head.appendChild(style);

    var cursor = document.createElement("div");
    cursor.id = "tattoo-machine-cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML =
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="rotate(-8 30 31)">' +
      '<path d="M22 39 L13 54" fill="none" stroke="#d7d7d2" stroke-width="4.8" stroke-linecap="round"/>' +
      '<path d="M13 54 L8 62" class="needle" fill="none" stroke="#f3e6d2" stroke-width="1.35" stroke-linecap="round"/>' +
      '<path d="M21 39 L30 41 L34 34 L25 31 Z" fill="#2a1218" stroke="#e0b45a" stroke-width="1.7" stroke-linejoin="round"/>' +
      '<path d="M25 31 L24 16 L32 9 L46 12 L50 22 L42 28 L34 27" fill="none" stroke="#e0b45a" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="31" y="15" width="9" height="12" rx="2.2" fill="#160b10" stroke="#c4a48a" stroke-width="1.4"/>' +
      '<rect x="42" y="17" width="8" height="11" rx="2.2" fill="#160b10" stroke="#c4a48a" stroke-width="1.4"/>' +
      '<path d="M28 12 L49 15" stroke="#f3e6d2" stroke-width="2.1" stroke-linecap="round"/>' +
      '<circle cx="27" cy="12" r="3.2" fill="#8b1e2d" stroke="#e0b45a" stroke-width="1.4"/>' +
      '<path d="M30 39 L38 45" stroke="#8b1e2d" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M38 45 C47 48 49 54 55 56" fill="none" stroke="#8b1e2d" stroke-width="2.3" stroke-linecap="round"/>' +
      '</g></svg>';
    document.body.appendChild(cursor);

    var x = -100;
    var y = -100;

    window.addEventListener("pointermove", function (e) {
      x = e.clientX;
      y = e.clientY;
      cursor.style.opacity = "1";
      var hot = e.target.closest("a, button, .panel, .pigskin, input, textarea, label");
      cursor.classList.toggle("is-hot", !!hot);
      cursor.classList.toggle("is-ink", !!e.target.closest(".panel, .pigskin"));
    }, { passive: true });

    document.documentElement.addEventListener("mouseleave", function () {
      cursor.style.opacity = "0";
    });

    (function follow() {
      cursor.style.transform = "translate3d(" + (x - 8) + "px," + (y - 62) + "px,0)";
      requestAnimationFrame(follow);
    })();
  }

  installTattooCursor();

  if (reduce || !fine) return;

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

    return {
      x: pct(parts[0], 0.5),
      y: pct(parts[1] || parts[0], 0.5)
    };
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

      return {
        confidence: confidence,
        explicit: true,
        average: buildLocalAverage(work)
      };
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

    return {
      confidence: confidence,
      explicit: false,
      average: avg
    };
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
    var STRONG = 88;
    var WEAK = 46;
    var SUBTLE_SEED = 66;
    var SUBTLE_WEAK = 54;
    var len = confidence.length;
    var claimed = new Uint8Array(len);
    var visited = new Uint8Array(len);
    var components = [];
    var queue = new Int32Array(len);
    var dirs = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    function flood(start, threshold, maxPixels) {
      var head = 0;
      var tail = 0;
      var pixels = [];
      var minX = w, minY = h, maxX = 0, maxY = 0;
      var totalConfidence = 0;

      queue[tail++] = start;
      visited[start] = 1;

      while (head < tail) {
        var ci = queue[head++];
        if (confidence[ci] < threshold) continue;

        var cx = ci % w;
        var cy = Math.floor(ci / w);

        pixels.push(ci);
        totalConfidence += confidence[ci];
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        if (maxPixels && pixels.length > maxPixels) {
          return null;
        }

        for (var d = 0; d < dirs.length; d++) {
          var nx = cx + dirs[d][0];
          var ny = cy + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

          var ni = ny * w + nx;
          if (visited[ni] || claimed[ni]) continue;
          if (confidence[ni] < threshold) continue;

          visited[ni] = 1;
          queue[tail++] = ni;
        }
      }

      if (!pixels.length) return null;

      return {
        pixels: pixels,
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        averageConfidence: totalConfidence / pixels.length
      };
    }

    // Primary pass: confident ink starts each feature, while connected softer
    // shading and fine linework are allowed to stay attached to that feature.
    for (var i = 0; i < len; i++) {
      if (claimed[i] || visited[i] || confidence[i] < STRONG) continue;

      var primary = flood(i, WEAK, 0);
      if (!primary || primary.pixels.length < 3) continue;

      for (var p = 0; p < primary.pixels.length; p++) {
        claimed[primary.pixels[p]] = 1;
      }
      components.push(primary);
    }

    // Secondary pass: rescue small isolated grey details that never contain a
    // very dark seed. Size and average-confidence limits keep shadows/background
    // from becoming large moving regions.
    visited.fill(0);

    for (i = 0; i < len; i++) {
      if (claimed[i] || visited[i] || confidence[i] < SUBTLE_SEED) continue;

      var subtle = flood(i, SUBTLE_WEAK, 150);
      if (!subtle) continue;

      var bw = subtle.maxX - subtle.minX + 1;
      var bh = subtle.maxY - subtle.minY + 1;
      var compact = bw <= 42 && bh <= 42;
      var credible = subtle.averageConfidence >= 64;

      if (subtle.pixels.length < 3 || !compact || !credible) continue;

      for (p = 0; p < subtle.pixels.length; p++) {
        claimed[subtle.pixels[p]] = 1;
      }
      components.push(subtle);
    }

    return components;
  }

  function splitLargeComponent(component, w) {
    var bw = component.maxX - component.minX + 1;
    var bh = component.maxY - component.minY + 1;
    var area = component.pixels.length;

    if (area <= 380 && bw <= 54 && bh <= 54) {
      return [component.pixels];
    }

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
      if (buckets[key].length >= 3) groups.push(buckets[key]);
    });

    return groups;
  }

  function median(values) {
    if (!values.length) return 0;
    values.sort(function (a, b) { return a - b; });
    var mid = Math.floor(values.length / 2);
    return values.length % 2
      ? values[mid]
      : (values[mid - 1] + values[mid]) * 0.5;
  }

  function sampleSurroundingTone(src, confidence, w, h, bounds) {
    var samples = [];
    var radii = [3, 5, 8, 12, 18, 26];

    for (var ri = 0; ri < radii.length && samples.length < 80; ri++) {
      var r = radii[ri];
      var left = Math.max(0, bounds.minX - r);
      var right = Math.min(w - 1, bounds.maxX + r);
      var top = Math.max(0, bounds.minY - r);
      var bottom = Math.min(h - 1, bounds.maxY + r);

      for (var y = top; y <= bottom; y++) {
        for (var x = left; x <= right; x++) {
          var outside =
            x < bounds.minX ||
            x > bounds.maxX ||
            y < bounds.minY ||
            y > bounds.maxY;

          if (!outside) continue;

          var onRing =
            x === left || x === right ||
            y === top || y === bottom;

          if (!onRing) continue;

          var pi = y * w + x;
          if (confidence[pi] > 34) continue;

          var oi = pi * 4;
          var lum = luminance(src, oi);
          if (lum < 0.20 || lum > 0.94) continue;

          samples.push({
            r: src[oi],
            g: src[oi + 1],
            b: src[oi + 2]
          });
        }
      }
    }

    if (samples.length < 12) {
      var left2 = Math.max(0, bounds.minX - 32);
      var right2 = Math.min(w - 1, bounds.maxX + 32);
      var top2 = Math.max(0, bounds.minY - 32);
      var bottom2 = Math.min(h - 1, bounds.maxY + 32);

      for (var yy = top2; yy <= bottom2 && samples.length < 180; yy += 2) {
        for (var xx = left2; xx <= right2 && samples.length < 180; xx += 2) {
          var pii = yy * w + xx;
          if (confidence[pii] > 48) continue;

          var oii = pii * 4;
          var l = luminance(src, oii);
          if (l < 0.18 || l > 0.95) continue;

          samples.push({
            r: src[oii],
            g: src[oii + 1],
            b: src[oii + 2]
          });
        }
      }
    }

    if (!samples.length) {
      return { r: 190, g: 150, b: 125 };
    }

    var rs = samples.map(function (s) { return s.r; });
    var gs = samples.map(function (s) { return s.g; });
    var bs = samples.map(function (s) { return s.b; });

    var mr = median(rs);
    var mg = median(gs);
    var mb = median(bs);

    var sr = 0, sg = 0, sb = 0, n = 0;

    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var dr = s.r - mr;
      var dg = s.g - mg;
      var db = s.b - mb;
      var dist2 = dr * dr + dg * dg + db * db;

      if (dist2 > 3200) continue;

      sr += s.r;
      sg += s.g;
      sb += s.b;
      n++;
    }

    if (!n) {
      return {
        r: Math.round(mr),
        g: Math.round(mg),
        b: Math.round(mb)
      };
    }

    return {
      r: Math.round(sr / n),
      g: Math.round(sg / n),
      b: Math.round(sb / n)
    };
  }

  function makeGroup(pixelIndices, work, maskResult, sourceData) {
    var w = work.width;
    var h = work.height;
    var src = sourceData;
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

    var rawBounds = {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY
    };

    var tone = sampleSurroundingTone(src, conf, w, h, rawBounds);
    var cx = sumX / sumWeight;
    var cy = sumY / sumWeight;

    var pad = 5;
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
    var exact = new Uint8Array(sw * sh);

    for (i = 0; i < pixelIndices.length; i++) {
      pi = pixelIndices[i];
      x = pi % w;
      y = Math.floor(pi / w);

      if (x < minX || y < minY || x > maxX || y > maxY) continue;

      var srcI = pi * 4;
      var li = (y - minY) * sw + (x - minX);
      var localI = li * 4;
      var spriteAlpha = Math.round(
        clamp((conf[pi] - 42) / 150, 0, 1) * 255
      );

      exact[li] = 1;

      sImg.data[localI] = src[srcI];
      sImg.data[localI + 1] = src[srcI + 1];
      sImg.data[localI + 2] = src[srcI + 2];
      sImg.data[localI + 3] = spriteAlpha;
    }

    var expanded = dilate(exact, sw, sh);
    var feather = dilate(expanded, sw, sh);

    for (var ly = 0; ly < sh; ly++) {
      for (var lx = 0; lx < sw; lx++) {
        var lpi = ly * sw + lx;
        var alpha = 0;

        if (exact[lpi]) alpha = 255;
        else if (expanded[lpi]) alpha = 235;
        else if (feather[lpi]) alpha = 92;

        if (!alpha) continue;

        var bi = lpi * 4;
        bImg.data[bi] = tone.r;
        bImg.data[bi + 1] = tone.g;
        bImg.data[bi + 2] = tone.b;
        bImg.data[bi + 3] = alpha;
      }
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
      radius: radius,
      sprite: sprite,
      base: base,
      skinTone: tone,
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

    pixelGroups.sort(function (a, b) {
      return b.length - a.length;
    });

    if (pixelGroups.length > 520) {
      pixelGroups.length = 520;
    }

    var sourceData = work
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, w, h).data;

    var groups = [];

    for (i = 0; i < pixelGroups.length; i++) {
      var group = makeGroup(
        pixelGroups[i],
        work,
        maskResult,
        sourceData
      );

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
        var active =
          influence > 0.01 ||
          motion > 0.16 ||
          Math.abs(g.z) > 0.01 ||
          Math.abs(g.angle) > 0.002;

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

        var holeAlpha = clamp(motion / 2.6 + g.z * 1.08, 0, 1);

        ctx.save();
        ctx.globalAlpha = holeAlpha;
        ctx.translate(homeX, homeY);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(g.base, g.relX, g.relY);
        ctx.restore();

        ctx.save();
        ctx.translate(homeX + g.ox, homeY + g.oy - g.z * 6);
        ctx.rotate(g.angle);

        var liftScale = 1 + g.z * 0.055;
        ctx.scale(scaleX * liftScale, scaleY * liftScale);

        ctx.shadowColor =
          "rgba(10,4,7," + clamp(g.z * 0.30, 0, 0.25) + ")";
        ctx.shadowBlur = g.z * 7;
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
          (maskResult.explicit ? "explicit mask" : "auto segmentation refined");
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

    if (img.complete && img.naturalWidth) {
      start();
    } else {
      img.addEventListener("load", start, { once: true });
    }
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