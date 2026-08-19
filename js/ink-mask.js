(function (ns) {
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

      return { confidence: confidence, explicit: true };
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
      confidence[p] = Math.round(clamp((score - 0.13) / 0.49, 0, 1) * 255);
    }

    return { confidence: confidence, explicit: false };
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

        if (maxPixels && pixels.length > maxPixels) return null;

        for (var d = 0; d < dirs.length; d++) {
          var nx = cx + dirs[d][0];
          var ny = cy + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

          var ni = ny * w + nx;
          if (visited[ni] || claimed[ni] || confidence[ni] < threshold) continue;
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

    for (var i = 0; i < len; i++) {
      if (claimed[i] || visited[i] || confidence[i] < STRONG) continue;
      var primary = flood(i, WEAK, 0);
      if (!primary || primary.pixels.length < 3) continue;
      for (var p = 0; p < primary.pixels.length; p++) claimed[primary.pixels[p]] = 1;
      components.push(primary);
    }

    visited.fill(0);

    for (i = 0; i < len; i++) {
      if (claimed[i] || visited[i] || confidence[i] < SUBTLE_SEED) continue;
      var subtle = flood(i, SUBTLE_WEAK, 150);
      if (!subtle) continue;

      var bw = subtle.maxX - subtle.minX + 1;
      var bh = subtle.maxY - subtle.minY + 1;
      if (subtle.pixels.length < 3 || bw > 42 || bh > 42 || subtle.averageConfidence < 64) continue;

      for (p = 0; p < subtle.pixels.length; p++) claimed[subtle.pixels[p]] = 1;
      components.push(subtle);
    }

    return components;
  }

  ns.clamp = clamp;
  ns.deterministicSeed = deterministicSeed;
  ns.luminance = luminance;
  ns.parsePos = parsePos;
  ns.paintCover = paintCover;
  ns.loadOptional = loadOptional;
  ns.buildMask = buildMask;
  ns.connectedComponents = connectedComponents;
})(window.EOIOrganicInk = window.EOIOrganicInk || {});
