(function (ns) {
  var clamp = ns.clamp;
  var deterministicSeed = ns.deterministicSeed;

  function createGroupedInteraction(opts) {
    var wrap = opts.container;
    var img = opts.image;
    var canvas = opts.canvas;
    var debug = !!opts.debug;

    if (!wrap || !img || !canvas || !img.naturalWidth) return null;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var pos = ns.parsePos(img);
    var displayW = Math.max(1, wrap.clientWidth);
    var displayH = Math.max(1, wrap.clientHeight);
    var work = document.createElement("canvas");
    work.width = 360;
    work.height = Math.max(1, Math.round(360 * displayH / displayW));

    var wctx = work.getContext("2d");
    ns.paintCover(wctx, img, pos, work.width, work.height);
    var maskResult = ns.buildMask(work, opts.mask || null, pos);
    var groups = ns.buildGroups(work, maskResult);
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

    function nearestAnchorVector(g, scaleX, scaleY, homeX, homeY) {
      var bestDist2 = Infinity;
      var bestDx = homeX - cursor.x;
      var bestDy = homeY - cursor.y;

      for (var a = 0; a < g.anchors.length; a++) {
        var anchorX = g.anchors[a].x * scaleX;
        var anchorY = g.anchors[a].y * scaleY;
        var dx = anchorX - cursor.x;
        var dy = anchorY - cursor.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < bestDist2) {
          bestDist2 = d2;
          bestDx = dx;
          bestDy = dy;
        }
      }
      return { dx: bestDx, dy: bestDy, dist: Math.sqrt(bestDist2) };
    }

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
      var spring = 92;
      var damp = Math.exp(-15 * dt);
      var anyMoving = false;
      var activeCount = 0;

      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var homeX = g.cx * scaleX;
        var homeY = g.cy * scaleY;
        var radiusPx = g.radius * minScale;
        var targetX = 0, targetY = 0, targetZ = 0, targetAngle = 0, influence = 0;

        if (cursor.x >= 0) {
          var nearest = nearestAnchorVector(g, scaleX, scaleY, homeX, homeY);
          var dx = nearest.dx;
          var dy = nearest.dy;
          var dist = nearest.dist;
          var field = 58 + Math.min(18, radiusPx * 0.22);

          if (dist < field) {
            influence = 1 - dist / field;
            influence = influence * influence * (3 - 2 * influence);

            if (dist < 0.001) {
              dx = g.seed - 0.5;
              dy = 0.5 - deterministicSeed(g.cy, g.cx);
              dist = Math.sqrt(dx * dx + dy * dy) || 1;
            }

            var nx = dx / dist;
            var ny = dy / dist;
            var push = (18 + Math.min(15, radiusPx * 0.18)) * influence;
            targetX = nx * push;
            targetY = ny * push;
            targetZ = influence;
            targetAngle = (g.seed - 0.5) * 0.12 * influence;
          }
        }

        g.vx += (targetX - g.ox) * spring * dt;
        g.vy += (targetY - g.oy) * spring * dt;
        g.vz += (targetZ - g.z) * 76 * dt;
        g.va += (targetAngle - g.angle) * 66 * dt;
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
        var liftScale = 1 + g.z * 0.052;
        ctx.scale(scaleX * liftScale, scaleY * liftScale);
        ctx.shadowColor = "rgba(10,4,7," + clamp(g.z * 0.32, 0, 0.26) + ")";
        ctx.shadowBlur = g.z * 7.5;
        ctx.shadowOffsetY = g.z * 3.2;
        ctx.drawImage(g.sprite, g.relX, g.relY);
        ctx.restore();

        if (debug) {
          ctx.strokeStyle = "rgba(243,193,90,.28)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (var aa = 0; aa < g.anchors.length; aa++) {
            var ax = g.anchors[aa].x * scaleX;
            var ay = g.anchors[aa].y * scaleY;
            ctx.moveTo(ax + 2, ay);
            ctx.arc(ax, ay, 2, 0, Math.PI * 2);
          }
          ctx.stroke();
        }
      }

      if (debug && cursor.x >= 0) {
        ctx.strokeStyle = "rgba(243,193,90,.65)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 58, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (hud) {
        hud.textContent = groups.length + " organic rigid groups · " + activeCount + " active · " + fps + " fps · " +
          (maskResult.explicit ? "explicit mask" : "auto segmentation");
      }

      if (cursor.x >= 0 || anyMoving) raf = requestAnimationFrame(tick);
      else {
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

  function bindPanel(panel, img, debug) {
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);

    function start() {
      ns.loadOptional(img.getAttribute("data-ink-mask")).then(function (mask) {
        createGroupedInteraction({
          container: panel,
          image: img,
          canvas: canvas,
          mask: mask,
          debug: debug
        });
      });
    }

    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  ns.start = function (options) {
    var debug = !!(options && options.debug);
    document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
      var img = panel.querySelector("img");
      if (!img || img.getAttribute("data-no-ink")) return;

      var armed = false;
      function arm() {
        if (armed) return;
        armed = true;
        bindPanel(panel, img, debug);
      }
      panel.addEventListener("pointerenter", arm, { once: true });
    });
  };
})(window.EOIOrganicInk = window.EOIOrganicInk || {});
