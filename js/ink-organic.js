(function (ns) {
  var clamp = ns.clamp;
  var deterministicSeed = ns.deterministicSeed;
  var luminance = ns.luminance;

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

  function MinHeap() { this.items = []; }
  MinHeap.prototype.push = function (node) {
    var a = this.items;
    var i = a.length;
    a.push(node);
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (a[parent].cost <= node.cost) break;
      a[i] = a[parent];
      i = parent;
    }
    a[i] = node;
  };
  MinHeap.prototype.pop = function () {
    var a = this.items;
    if (!a.length) return null;
    var root = a[0];
    var last = a.pop();
    if (!a.length) return root;
    var i = 0;
    while (true) {
      var left = i * 2 + 1;
      var right = left + 1;
      if (left >= a.length) break;
      var child = right < a.length && a[right].cost < a[left].cost ? right : left;
      if (a[child].cost >= last.cost) break;
      a[i] = a[child];
      i = child;
    }
    a[i] = last;
    return root;
  };

  function chooseOrganicSeeds(component, w, count, confidence) {
    var pixels = component.pixels;
    if (count <= 1 || pixels.length <= 1) return [pixels[0]];

    var stride = Math.max(1, Math.floor(pixels.length / 1400));
    var candidates = [];
    for (var i = 0; i < pixels.length; i += stride) candidates.push(pixels[i]);
    if (candidates[candidates.length - 1] !== pixels[pixels.length - 1]) candidates.push(pixels[pixels.length - 1]);

    var first = candidates[0];
    var bestFirst = -Infinity;
    var cx = (component.minX + component.maxX) * 0.5;
    var cy = (component.minY + component.maxY) * 0.5;
    for (i = 0; i < candidates.length; i++) {
      var pi = candidates[i];
      var x = pi % w;
      var y = Math.floor(pi / w);
      var radial = Math.hypot(x - cx, y - cy);
      var score = confidence[pi] * 1.6 - radial * 0.75 + deterministicSeed(x, y) * 18;
      if (score > bestFirst) {
        bestFirst = score;
        first = pi;
      }
    }

    var seeds = [first];
    var minDist2 = new Float64Array(candidates.length);
    minDist2.fill(Infinity);

    function absorb(seedPi) {
      var sx = seedPi % w;
      var sy = Math.floor(seedPi / w);
      for (var ci = 0; ci < candidates.length; ci++) {
        var cpi = candidates[ci];
        var dx = (cpi % w) - sx;
        var dy = Math.floor(cpi / w) - sy;
        var d2 = dx * dx + dy * dy;
        if (d2 < minDist2[ci]) minDist2[ci] = d2;
      }
    }

    absorb(first);
    while (seeds.length < count) {
      var best = -1;
      var bestScore = -1;
      for (i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
        var confidenceBias = 0.72 + 0.28 * (confidence[candidate] / 255);
        var noise = 0.90 + deterministicSeed(candidate, seeds.length * 31.17) * 0.20;
        var farScore = minDist2[i] * confidenceBias * noise;
        if (farScore > bestScore) {
          bestScore = farScore;
          best = candidate;
        }
      }
      if (best < 0 || seeds.indexOf(best) !== -1) break;
      seeds.push(best);
      absorb(best);
    }
    return seeds;
  }

  function mergeTinyGroups(groups, owner, member, w, h) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (var label = 0; label < groups.length; label++) {
      if (!groups[label] || groups[label].length >= 18) continue;
      var contacts = Object.create(null);
      var pixels = groups[label];
      for (var i = 0; i < pixels.length; i++) {
        var pi = pixels[i];
        var x = pi % w;
        var y = Math.floor(pi / w);
        for (var d = 0; d < dirs.length; d++) {
          var nx = x + dirs[d][0];
          var ny = y + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var ni = ny * w + nx;
          if (!member[ni]) continue;
          var other = owner[ni];
          if (other < 0 || other === label || !groups[other]) continue;
          contacts[other] = (contacts[other] || 0) + 1;
        }
      }

      var bestLabel = -1;
      var bestContact = 0;
      Object.keys(contacts).forEach(function (key) {
        if (contacts[key] > bestContact) {
          bestContact = contacts[key];
          bestLabel = parseInt(key, 10);
        }
      });
      if (bestLabel < 0) continue;
      for (i = 0; i < pixels.length; i++) {
        owner[pixels[i]] = bestLabel;
        groups[bestLabel].push(pixels[i]);
      }
      groups[label] = null;
    }
    return groups.filter(function (g) { return g && g.length >= 3; });
  }

  function splitLargeComponent(component, w, h, confidence) {
    var bw = component.maxX - component.minX + 1;
    var bh = component.maxY - component.minY + 1;
    var area = component.pixels.length;
    if (area <= 430 && bw <= 58 && bh <= 58) return [component.pixels];

    var confidenceFactor = clamp(component.averageConfidence / 255, 0, 1);
    var targetSize = Math.round(220 + confidenceFactor * 130);
    var pieceCount = clamp(Math.ceil(area / targetSize), 2, 46);
    var seeds = chooseOrganicSeeds(component, w, pieceCount, confidence);
    if (seeds.length <= 1) return [component.pixels];

    var len = w * h;
    var member = new Uint8Array(len);
    var owner = new Int16Array(len);
    owner.fill(-1);
    for (var i = 0; i < component.pixels.length; i++) member[component.pixels[i]] = 1;

    var groups = [];
    var heap = new MinHeap();
    var dirs = [
      [-1, -1, 1.4142], [0, -1, 1], [1, -1, 1.4142],
      [-1, 0, 1],                    [1, 0, 1],
      [-1, 1, 1.4142],  [0, 1, 1],  [1, 1, 1.4142]
    ];

    for (i = 0; i < seeds.length; i++) {
      groups[i] = [];
      heap.push({ pi: seeds[i], label: i, cost: 0 });
    }

    while (heap.items.length) {
      var node = heap.pop();
      var pi = node.pi;
      if (owner[pi] !== -1 || !member[pi]) continue;
      owner[pi] = node.label;
      groups[node.label].push(pi);
      var x = pi % w;
      var y = Math.floor(pi / w);

      for (var d = 0; d < dirs.length; d++) {
        var nx = x + dirs[d][0];
        var ny = y + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var ni = ny * w + nx;
        if (!member[ni] || owner[ni] !== -1) continue;

        var ink = confidence[ni] / 255;
        var weakCost = 1.46 - ink * 0.64;
        var organicNoise = 0.92 + deterministicSeed(nx + node.label * 19.7, ny + node.label * 7.9) * 0.16;
        var turnNoise = 0.96 + deterministicSeed(x + ny, y + nx + node.label) * 0.08;
        heap.push({
          pi: ni,
          label: node.label,
          cost: node.cost + dirs[d][2] * weakCost * organicNoise * turnNoise
        });
      }
    }
    return mergeTinyGroups(groups, owner, member, w, h);
  }

  function median(values) {
    if (!values.length) return 0;
    values.sort(function (a, b) { return a - b; });
    var mid = Math.floor(values.length / 2);
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) * 0.5;
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
          var outside = x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY;
          if (!outside || !(x === left || x === right || y === top || y === bottom)) continue;
          var pi = y * w + x;
          if (confidence[pi] > 34) continue;
          var oi = pi * 4;
          var lum = luminance(src, oi);
          if (lum < 0.20 || lum > 0.94) continue;
          samples.push({ r: src[oi], g: src[oi + 1], b: src[oi + 2] });
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
          samples.push({ r: src[oii], g: src[oii + 1], b: src[oii + 2] });
        }
      }
    }

    if (!samples.length) return { r: 190, g: 150, b: 125 };
    var mr = median(samples.map(function (s) { return s.r; }));
    var mg = median(samples.map(function (s) { return s.g; }));
    var mb = median(samples.map(function (s) { return s.b; }));
    var sr = 0, sg = 0, sb = 0, n = 0;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var dr = s.r - mr;
      var dg = s.g - mg;
      var db = s.b - mb;
      if (dr * dr + dg * dg + db * db > 3200) continue;
      sr += s.r;
      sg += s.g;
      sb += s.b;
      n++;
    }
    if (!n) return { r: Math.round(mr), g: Math.round(mg), b: Math.round(mb) };
    return { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
  }

  function buildAnchors(pixelIndices, w, cx, cy) {
    var desired = clamp(Math.ceil(pixelIndices.length / 75), 1, 9);
    var anchors = [{ x: cx, y: cy }];
    if (desired === 1) return anchors;
    var stride = Math.max(1, Math.floor(pixelIndices.length / 500));
    while (anchors.length < desired) {
      var best = null;
      var bestScore = -1;
      for (var i = 0; i < pixelIndices.length; i += stride) {
        var pi = pixelIndices[i];
        var x = pi % w;
        var y = Math.floor(pi / w);
        var minD2 = Infinity;
        for (var a = 0; a < anchors.length; a++) {
          var dx = x - anchors[a].x;
          var dy = y - anchors[a].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < minD2) minD2 = d2;
        }
        var score = minD2 * (0.94 + deterministicSeed(x, y + anchors.length * 13) * 0.12);
        if (score > bestScore) {
          bestScore = score;
          best = { x: x, y: y };
        }
      }
      if (!best || bestScore < 4) break;
      anchors.push(best);
    }
    return anchors;
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

    var rawBounds = { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    var tone = sampleSurroundingTone(src, conf, w, h, rawBounds);
    var cx = sumX / sumWeight;
    var cy = sumY / sumWeight;
    var anchors = buildAnchors(pixelIndices, w, cx, cy);
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
      var srcI = pi * 4;
      var li = (y - minY) * sw + (x - minX);
      var localI = li * 4;
      exact[li] = 1;
      sImg.data[localI] = src[srcI];
      sImg.data[localI + 1] = src[srcI + 1];
      sImg.data[localI + 2] = src[srcI + 2];
      sImg.data[localI + 3] = Math.round(clamp((conf[pi] - 42) / 150, 0, 1) * 255);
    }

    var expanded = dilate(exact, sw, sh);
    var feather = dilate(expanded, sw, sh);
    for (var ly = 0; ly < sh; ly++) {
      for (var lx = 0; lx < sw; lx++) {
        var lpi = ly * sw + lx;
        var alpha = exact[lpi] ? 255 : expanded[lpi] ? 235 : feather[lpi] ? 92 : 0;
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
    var diag = Math.sqrt(sw * sw + sh * sh);
    var effectiveRadius = Math.sqrt(pixelIndices.length / Math.PI) * 1.45 + 5;

    return {
      cx: cx,
      cy: cy,
      relX: minX - cx,
      relY: minY - cy,
      radius: clamp(effectiveRadius, 5, Math.max(10, diag * 0.5)),
      anchors: anchors,
      sprite: sprite,
      base: base,
      seed: deterministicSeed(cx, cy),
      ox: 0, oy: 0, vx: 0, vy: 0,
      z: 0, vz: 0, angle: 0, va: 0
    };
  }

  function buildGroups(work, maskResult) {
    var w = work.width;
    var h = work.height;
    var components = ns.connectedComponents(maskResult.confidence, w, h);
    var pixelGroups = [];
    for (var i = 0; i < components.length; i++) {
      var split = splitLargeComponent(components[i], w, h, maskResult.confidence);
      for (var j = 0; j < split.length; j++) pixelGroups.push(split[j]);
    }
    pixelGroups.sort(function (a, b) { return b.length - a.length; });
    if (pixelGroups.length > 520) pixelGroups.length = 520;
    var sourceData = work.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    var groups = [];
    for (i = 0; i < pixelGroups.length; i++) {
      var group = makeGroup(pixelGroups[i], work, maskResult, sourceData);
      if (group) groups.push(group);
    }
    return groups;
  }

  ns.splitLargeComponent = splitLargeComponent;
  ns.buildGroups = buildGroups;
})(window.EOIOrganicInk = window.EOIOrganicInk || {});
