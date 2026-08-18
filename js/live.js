(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  if (reduce) return;

  var mouse = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };

  window.addEventListener("pointermove", function (e) {
    mouse.tx = e.clientX / Math.max(1, window.innerWidth);
    mouse.ty = e.clientY / Math.max(1, window.innerHeight);
  }, { passive: true });

  (function tickMouse() {
    mouse.x += (mouse.tx - mouse.x) * 0.14;
    mouse.y += (mouse.ty - mouse.y) * 0.14;
    requestAnimationFrame(tickMouse);
  })();

  function magnetize(el) {
    if (!el || !fine) return;
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
  if (orb && fine) {
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
    return { x: pct(parts[0], 0.5), y: pct(parts[1], 0.5) };
  }

  function sampleHeights(img, pos, N) {
    var cnv = document.createElement("canvas");
    cnv.width = N;
    cnv.height = N;
    var ctx = cnv.getContext("2d", { willReadFrequently: true });
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
      ink = ink * ink * (3 - 2 * ink);
      h[i] = Math.pow(ink, 1.25);
    }
    return h;
  }

  function bindRelief(wrap, img, canvas) {
    if (!wrap || !img || !canvas) return;
    function start() {
      if (!img.naturalWidth) return;
      if (!liveMesh(wrap, img, canvas)) liveFlat(wrap, img, canvas);
    }
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  function liveMesh(wrap, img, canvas) {
    var gl = canvas.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: false });
    if (!gl) return false;

    var N = 96;
    var pos = parsePos(img);
    var crop = document.createElement("canvas");
    crop.width = 512;
    crop.height = 512;
    var cctx = crop.getContext("2d");
    var cov = coverUV(img.naturalWidth, img.naturalHeight, 512, 512, pos.x, pos.y);
    try {
      cctx.drawImage(
        img,
        cov.u * img.naturalWidth, cov.v * img.naturalHeight,
        cov.sx * img.naturalWidth, cov.sy * img.naturalHeight,
        0, 0, 512, 512
      );
    } catch (err) {
      return false;
    }
    var heights = sampleHeights(img, pos, N);
    if (!heights) return false;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, [
      "attribute vec2 a;",
      "attribute float aH;",
      "uniform vec2 uMouse;",
      "uniform float uTime;",
      "uniform float uAmp;",
      "varying vec2 vUv;",
      "varying float vH;",
      "void main(){",
      "  vUv = a * 0.5 + 0.5;",
      "  float breathe = 0.88 + 0.12 * sin(uTime * 1.6 + aH * 9.0);",
      "  float h = aH * uAmp * breathe;",
      "  vH = h;",
      "  vec2 look = (uMouse - 0.5) * h * 0.22;",
      "  vec2 xy = a + look;",
      "  float pop = 1.0 + h * 0.85;",
      "  gl_Position = vec4(xy * pop, h * 0.45 - 0.12, 1.0);",
      "}"
    ].join("\n"));

    var fs = compile(gl.FRAGMENT_SHADER, [
      "precision mediump float;",
      "uniform sampler2D uTex;",
      "uniform sampler2D uH;",
      "uniform vec2 uMouse;",
      "uniform float uTime;",
      "varying vec2 vUv;",
      "varying float vH;",
      "void main(){",
      "  vec2 uv = vUv;",
      "  float hC = texture2D(uH, uv).r;",
      "  vec2 px = vec2(1.0/96.0, 1.0/96.0);",
      "  float hL = texture2D(uH, uv - vec2(px.x, 0.0)).r;",
      "  float hR = texture2D(uH, uv + vec2(px.x, 0.0)).r;",
      "  float hU = texture2D(uH, uv + vec2(0.0, px.y)).r;",
      "  float hD = texture2D(uH, uv - vec2(0.0, px.y)).r;",
      "  vec3 n = normalize(vec3((hL - hR) * 3.4, (hD - hU) * 3.4, 0.42));",
      "  vec3 light = normalize(vec3((uMouse.x - 0.5) * 2.6, (0.5 - uMouse.y) * 2.6, 0.7));",
      "  float ndl = max(dot(n, light), 0.0);",
      "  float spec = pow(ndl, 22.0);",
      "  vec3 col = texture2D(uTex, uv).rgb;",
      "  float valley = 1.0 - hC;",
      "  col *= 0.52 + 0.62 * ndl;",
      "  col *= 0.78 + 0.22 * hC;",
      "  col += spec * vec3(0.95, 0.78, 0.42) * (0.25 + hC * 0.85);",
      "  col += hC * vec3(0.07, 0.03, 0.02);",
      "  col *= 0.90 + 0.10 * valley;",
      "  float rim = pow(1.0 - max(n.z, 0.0), 2.4) * hC;",
      "  col += rim * vec3(0.55, 0.38, 0.18);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n"));

    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    var verts = new Float32Array(N * N * 2);
    var hs = new Float32Array(N * N);
    var idx = new Uint16Array((N - 1) * (N - 1) * 6);
    var i, j, p = 0;
    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        verts[p * 2] = (i / (N - 1)) * 2 - 1;
        verts[p * 2 + 1] = 1 - (j / (N - 1)) * 2;
        hs[p] = heights[j * N + i];
        p++;
      }
    }
    p = 0;
    for (j = 0; j < N - 1; j++) {
      for (i = 0; i < N - 1; i++) {
        var a = j * N + i;
        idx[p++] = a; idx[p++] = a + 1; idx[p++] = a + N;
        idx[p++] = a + 1; idx[p++] = a + N + 1; idx[p++] = a + N;
      }
    }

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    var locA = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(locA);
    gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0);

    var hbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, hbo);
    gl.bufferData(gl.ARRAY_BUFFER, hs, gl.STATIC_DRAW);
    var locH = gl.getAttribLocation(prog, "aH");
    gl.enableVertexAttribArray(locH);
    gl.vertexAttribPointer(locH, 1, gl.FLOAT, false, 0, 0);

    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, crop);
    } catch (err) {
      return false;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var htex = gl.createTexture();
    var hpix = new Uint8Array(N * N * 4);
    for (i = 0; i < N * N; i++) {
      var v = Math.max(0, Math.min(255, Math.round(heights[i] * 255)));
      hpix[i * 4] = v;
      hpix[i * 4 + 1] = v;
      hpix[i * 4 + 2] = v;
      hpix[i * 4 + 3] = 255;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, htex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, hpix);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "uH"), 1);
    var uMouse = gl.getUniformLocation(prog, "uMouse");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var uAmp = gl.getUniformLocation(prog, "uAmp");
    gl.uniform1f(uAmp, wrap.id === "hero-photo" ? 0.62 : 0.54);

    var t0 = performance.now();
    var local = { x: 0.5, y: 0.4 };

    wrap.addEventListener("pointermove", function (e) {
      var r = wrap.getBoundingClientRect();
      local.x = (e.clientX - r.left) / Math.max(1, r.width);
      local.y = (e.clientY - r.top) / Math.max(1, r.height);
    }, { passive: true });

    function resize() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.floor(w * dpr));
      canvas.height = Math.max(2, Math.floor(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.09, 0.04, 0.06, 1);

    function frame() {
      var t = (performance.now() - t0) / 1000;
      var mx = wrap.id === "hero-photo" ? mouse.x : local.x;
      var my = wrap.id === "hero-photo" ? mouse.y : local.y;
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uTime, t);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, htex);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      requestAnimationFrame(frame);
    }
    wrap.classList.add("is-live");
    frame();
    return true;
  }

  function liveFlat(wrap, img, canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var pos = parsePos(img);
    function resize() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.floor(w * dpr));
      canvas.height = Math.max(2, Math.floor(h * dpr));
    }
    resize();
    window.addEventListener("resize", resize);
    wrap.classList.add("is-live");
    (function draw() {
      var w = canvas.width, h = canvas.height;
      var c = coverUV(img.naturalWidth, img.naturalHeight, w, h, pos.x, pos.y);
      ctx.drawImage(
        img,
        c.u * img.naturalWidth, c.v * img.naturalHeight,
        c.sx * img.naturalWidth, c.sy * img.naturalHeight,
        0, 0, w, h
      );
      requestAnimationFrame(draw);
    })();
  }

  bindRelief(
    document.getElementById("hero-photo"),
    document.getElementById("hero-img"),
    document.getElementById("hero-live")
  );

  document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
    var img = panel.querySelector("img");
    if (!img) return;
    var canvas = document.createElement("canvas");
    canvas.className = "ink-live";
    canvas.setAttribute("aria-hidden", "true");
    panel.appendChild(canvas);
    var armed = false;
    function arm() {
      if (armed) return;
      armed = true;
      bindRelief(panel, img, canvas);
    }
    panel.addEventListener("pointerenter", arm, { once: true });
  });
})();
