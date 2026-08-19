(function () {
  "use strict";

  var items = Array.prototype.slice.call(document.querySelectorAll("[data-mask-item]"));
  var stage = document.getElementById("mask-stage");
  var stageImg = document.getElementById("mask-photo");
  var overlay = document.getElementById("mask-overlay");
  var overlayCtx = overlay.getContext("2d", { willReadFrequently: true });
  var status = document.getElementById("mask-status");
  var selectedLabel = document.getElementById("mask-selected");
  var coverageLabel = document.getElementById("mask-coverage");
  var brushInput = document.getElementById("mask-brush");
  var opacityInput = document.getElementById("mask-opacity");
  var includeBtn = document.getElementById("mode-include");
  var excludeBtn = document.getElementById("mode-exclude");
  var undoBtn = document.getElementById("mask-undo");
  var clearBtn = document.getElementById("mask-clear");
  var exportBtn = document.getElementById("mask-export");
  var toggleBtn = document.getElementById("mask-toggle");

  var W = 360;
  var H = 640;
  var mode = "include";
  var current = null;
  var painting = false;
  var lastPoint = null;
  var overlayVisible = true;
  var states = Object.create(null);
  var undoStack = [];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
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

  function paintCover(ctx, img, pos, w, h) {
    var c = coverUV(img.naturalWidth, img.naturalHeight, w, h, pos.x, pos.y);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(
      img,
      c.u * img.naturalWidth,
      c.v * img.naturalHeight,
      c.sx * img.naturalWidth,
      c.sy * img.naturalHeight,
      0, 0, w, h
    );
  }

  function buildLocalAverage(src) {
    var tiny = document.createElement("canvas");
    var avg = document.createElement("canvas");
    tiny.width = Math.max(24, Math.round(src.width / 11));
    tiny.height = Math.max(24, Math.round(src.height / 11));
    avg.width = src.width;
    avg.height = src.height;

    var tctx = tiny.getContext("2d");
    var actx = avg.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(src, 0, 0, tiny.width, tiny.height);
    actx.imageSmoothingEnabled = true;
    actx.imageSmoothingQuality = "high";
    actx.drawImage(tiny, 0, 0, avg.width, avg.height);
    return avg;
  }

  function buildAutoMask(work) {
    var avg = buildLocalAverage(work);
    var sctx = work.getContext("2d", { willReadFrequently: true });
    var actx = avg.getContext("2d", { willReadFrequently: true });
    var src = sctx.getImageData(0, 0, W, H).data;
    var local = actx.getImageData(0, 0, W, H).data;
    var mask = new Uint8ClampedArray(W * H);

    for (var i = 0, p = 0; i < src.length; i += 4, p++) {
      var lum = luminance(src, i);
      var baseLum = luminance(local, i);
      var contrast = Math.max(0, baseLum - lum);
      var darkness = clamp((0.60 - lum) / 0.42, 0, 1);
      var usableBase = clamp((baseLum - 0.19) / 0.40, 0, 1);
      var score = contrast * 5.2 + darkness * 0.22 * usableBase;
      if (baseLum < 0.17 || lum > 0.62) score = 0;
      mask[p] = Math.round(clamp((score - 0.13) / 0.49, 0, 1) * 255);
    }
    return mask;
  }

  function blankLayer() {
    var c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }

  function itemKey(item) {
    return item.getAttribute("data-src");
  }

  function getPosition(item) {
    return {
      x: parseFloat(item.getAttribute("data-pos-x") || "50") / 100,
      y: parseFloat(item.getAttribute("data-pos-y") || "50") / 100
    };
  }

  function loadItem(item) {
    current = item;
    items.forEach(function (el) { el.classList.toggle("is-selected", el === item); });
    selectedLabel.textContent = item.getAttribute("data-label") || itemKey(item);
    status.textContent = "Loading image…";
    exportBtn.disabled = true;

    stageImg.onload = function () {
      var key = itemKey(item);
      if (!states[key]) {
        var work = document.createElement("canvas");
        work.width = W;
        work.height = H;
        paintCover(work.getContext("2d"), stageImg, getPosition(item), W, H);
        states[key] = {
          auto: buildAutoMask(work),
          include: blankLayer(),
          exclude: blankLayer()
        };
      }
      undoStack.length = 0;
      status.textContent = "Paint missed tattoo with Include. Paint false detections with Exclude.";
      exportBtn.disabled = false;
      renderOverlay();
    };

    stageImg.src = itemKey(item);
    stageImg.style.objectPosition =
      (parseFloat(item.getAttribute("data-pos-x") || "50")) + "% " +
      (parseFloat(item.getAttribute("data-pos-y") || "50")) + "%";
  }

  function effectiveMask(state) {
    var include = state.include.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, W, H).data;
    var exclude = state.exclude.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, W, H).data;
    var out = new Uint8ClampedArray(W * H);
    for (var p = 0; p < out.length; p++) {
      var a = state.auto[p];
      var inc = include[p * 4 + 3];
      var exc = exclude[p * 4 + 3];
      out[p] = exc > 0 ? 0 : Math.max(a, inc);
    }
    return out;
  }

  function renderOverlay() {
    if (!current) return;
    var state = states[itemKey(current)];
    if (!state) return;

    var include = state.include.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, W, H).data;
    var exclude = state.exclude.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, W, H).data;
    var img = overlayCtx.createImageData(W, H);
    var opacity = parseFloat(opacityInput.value || "0.58");
    var covered = 0;

    for (var p = 0; p < state.auto.length; p++) {
      var auto = state.auto[p];
      var inc = include[p * 4 + 3];
      var exc = exclude[p * 4 + 3];
      var i = p * 4;

      if (exc > 0) {
        img.data[i] = 230;
        img.data[i + 1] = 76;
        img.data[i + 2] = 76;
        img.data[i + 3] = Math.round(210 * opacity);
        continue;
      }

      if (inc > 0) {
        img.data[i] = 224;
        img.data[i + 1] = 180;
        img.data[i + 2] = 90;
        img.data[i + 3] = Math.round(230 * opacity);
        covered++;
        continue;
      }

      if (auto > 8) {
        img.data[i] = 65;
        img.data[i + 1] = 210;
        img.data[i + 2] = 126;
        img.data[i + 3] = Math.round((55 + auto * 0.62) * opacity);
        if (auto >= 46) covered++;
      }
    }

    overlayCtx.putImageData(img, 0, 0);
    overlay.style.opacity = overlayVisible ? "1" : "0";
    coverageLabel.textContent = ((covered / state.auto.length) * 100).toFixed(1) + "% mask coverage";
  }

  function setMode(next) {
    mode = next;
    includeBtn.classList.toggle("is-active", mode === "include");
    excludeBtn.classList.toggle("is-active", mode === "exclude");
    stage.classList.toggle("is-excluding", mode === "exclude");
  }

  function pointerToMask(e) {
    var r = overlay.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width * W, 0, W),
      y: clamp((e.clientY - r.top) / r.height * H, 0, H)
    };
  }

  function snapshot() {
    if (!current) return;
    var state = states[itemKey(current)];
    undoStack.push({
      include: state.include.getContext("2d").getImageData(0, 0, W, H),
      exclude: state.exclude.getContext("2d").getImageData(0, 0, W, H)
    });
    if (undoStack.length > 20) undoStack.shift();
  }

  function stroke(from, to) {
    if (!current) return;
    var state = states[itemKey(current)];
    var target = mode === "include" ? state.include : state.exclude;
    var opposite = mode === "include" ? state.exclude : state.include;
    var tctx = target.getContext("2d");
    var octx = opposite.getContext("2d");
    var size = parseFloat(brushInput.value || "22");

    [tctx, octx].forEach(function (ctx) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    });

    tctx.globalCompositeOperation = "source-over";
    tctx.strokeStyle = "rgba(255,255,255,1)";
    tctx.stroke();

    octx.globalCompositeOperation = "destination-out";
    octx.strokeStyle = "rgba(0,0,0,1)";
    octx.stroke();
    octx.globalCompositeOperation = "source-over";

    renderOverlay();
  }

  overlay.addEventListener("pointerdown", function (e) {
    if (!current) return;
    painting = true;
    snapshot();
    overlay.setPointerCapture(e.pointerId);
    lastPoint = pointerToMask(e);
    stroke(lastPoint, lastPoint);
    e.preventDefault();
  });

  overlay.addEventListener("pointermove", function (e) {
    if (!painting || !lastPoint) return;
    var p = pointerToMask(e);
    stroke(lastPoint, p);
    lastPoint = p;
    e.preventDefault();
  });

  function endPaint(e) {
    if (!painting) return;
    painting = false;
    lastPoint = null;
    if (e && overlay.hasPointerCapture && overlay.hasPointerCapture(e.pointerId)) {
      overlay.releasePointerCapture(e.pointerId);
    }
  }

  overlay.addEventListener("pointerup", endPaint);
  overlay.addEventListener("pointercancel", endPaint);

  includeBtn.addEventListener("click", function () { setMode("include"); });
  excludeBtn.addEventListener("click", function () { setMode("exclude"); });
  opacityInput.addEventListener("input", renderOverlay);

  toggleBtn.addEventListener("click", function () {
    overlayVisible = !overlayVisible;
    toggleBtn.textContent = overlayVisible ? "Hide overlay" : "Show overlay";
    renderOverlay();
  });

  undoBtn.addEventListener("click", function () {
    if (!current || !undoStack.length) return;
    var state = states[itemKey(current)];
    var snap = undoStack.pop();
    state.include.getContext("2d").putImageData(snap.include, 0, 0);
    state.exclude.getContext("2d").putImageData(snap.exclude, 0, 0);
    renderOverlay();
  });

  clearBtn.addEventListener("click", function () {
    if (!current) return;
    snapshot();
    var state = states[itemKey(current)];
    state.include.getContext("2d").clearRect(0, 0, W, H);
    state.exclude.getContext("2d").clearRect(0, 0, W, H);
    renderOverlay();
  });

  exportBtn.addEventListener("click", function () {
    if (!current) return;
    var state = states[itemKey(current)];
    var mask = effectiveMask(state);
    var small = document.createElement("canvas");
    small.width = W;
    small.height = H;
    var sctx = small.getContext("2d");
    var img = sctx.createImageData(W, H);

    for (var p = 0; p < mask.length; p++) {
      var i = p * 4;
      var v = mask[p];
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);

    var out = document.createElement("canvas");
    out.width = 720;
    out.height = 1280;
    var outCtx = out.getContext("2d");
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(small, 0, 0, out.width, out.height);

    var filename = itemKey(current).split("/").pop().replace(/\.[^.]+$/, ".mask.png");
    out.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      status.textContent = "Exported " + filename + ". Upload that file back to ChatGPT when you are done with this photo.";
    }, "image/png");
  });

  items.forEach(function (item) {
    item.addEventListener("click", function () { loadItem(item); });
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "i" || e.key === "I") setMode("include");
    if (e.key === "e" || e.key === "E") setMode("exclude");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undoBtn.click();
    }
  });

  overlay.width = W;
  overlay.height = H;
  setMode("include");
  if (items.length) loadItem(items[0]);
})();
