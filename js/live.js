(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;
  if (reduce) return;

  var mouse = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };

  window.addEventListener("pointermove", function (e) {
    mouse.tx = e.clientX / Math.max(1, window.innerWidth);
    mouse.ty = e.clientY / Math.max(1, window.innerHeight);
  }, { passive: true });

  function tickMouse() {
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    requestAnimationFrame(tickMouse);
  }
  tickMouse();

  function magnetize(el) {
    if (!el || !fine) return;
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var x = e.clientX - (r.left + r.width / 2);
      var y = e.clientY - (r.top + r.height / 2);
      el.style.transform = "translate(" + (x * 0.22) + "px," + (y * 0.22) + "px)";
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

  document.querySelectorAll(".mosaic .panel").forEach(function (panel) {
    var rx = 0, ry = 0, trx = 0, try_ = 0;
    panel.addEventListener("pointerenter", function () { panel.classList.add("is-up"); });
    panel.addEventListener("pointerleave", function () {
      panel.classList.remove("is-up");
      trx = 0; try_ = 0;
      panel.style.setProperty("--lx", "50%");
      panel.style.setProperty("--ly", "32%");
    });
    panel.addEventListener("pointermove", function (e) {
      var r = panel.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      trx = (0.5 - py) * 11;
      try_ = (px - 0.5) * 14;
      panel.style.setProperty("--lx", (px * 100) + "%");
      panel.style.setProperty("--ly", (py * 100) + "%");
    });
    (function spin() {
      rx += (trx - rx) * 0.14;
      ry += (try_ - ry) * 0.14;
      if (!panel.classList.contains("is-up") && Math.abs(rx) + Math.abs(ry) < 0.04) {
        panel.style.transform = "";
      } else {
        panel.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateZ(10px)";
      }
      requestAnimationFrame(spin);
    })();
  });

  bootHero();

  function bootHero() {
    var wrap = document.getElementById("hero-photo");
    var img = document.getElementById("hero-img");
    var canvas = document.getElementById("hero-live");
    if (!wrap || !img || !canvas) return;

    function start() {
      if (liveWebGL(wrap, img, canvas)) return;
      liveCanvas(wrap, img, canvas);
    }
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });
  }

  function coverUV(iw, ih, vw, vh, ox, oy) {
    var ir = iw / ih, vr = vw / vh;
    var sx = 1, sy = 1, u = 0, v = 0;
    if (ir > vr) { sx = vr / ir; u = (1 - sx) * ox; }
    else { sy = ir / vr; v = (1 - sy) * oy; }
    return { u: u, v: v, sx: sx, sy: sy };
  }

  function liveWebGL(wrap, img, canvas) {
    var gl = canvas.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: false });
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, [
      "attribute vec2 a;",
      "uniform sampler2D uTex;",
      "uniform vec4 uCover;",
      "uniform vec2 uMouse;",
      "uniform float uTime;",
      "varying vec2 vUv;",
      "varying float vH;",
      "void main(){",
      "  vUv = uCover.xy + (a*0.5+0.5)*uCover.zw;",
      "  vec3 c = texture2D(uTex, vUv).rgb;",
      "  float lum = dot(c, vec3(0.299,0.587,0.114));",
      "  float ink = pow(1.0-lum, 1.35);",
      "  vH = ink * 0.28 * (0.86 + 0.14*sin(uTime*1.7 + ink*6.0));",
      "  vec3 p = vec3(a, vH);",
      "  p.x += (uMouse.x-0.5)*0.10;",
      "  p.y -= (uMouse.y-0.5)*0.08;",
      "  float persp = 1.0 / (1.2 - p.z*0.85);",
      "  gl_Position = vec4(p.xy*persp, p.z*0.2, 1.0);",
      "}"
    ].join("\n"));
    var fs = sh(gl.FRAGMENT_SHADER, [
      "precision mediump float;",
      "uniform sampler2D uTex;",
      "uniform vec2 uMouse;",
      "uniform float uTime;",
      "varying vec2 vUv;",
      "varying float vH;",
      "void main(){",
      "  vec2 uv = vUv;",
      "  uv += (uMouse-0.5)*vH*0.12;",
      "  vec3 col = texture2D(uTex, uv).rgb;",
      "  vec2 px = vec2(0.004, 0.003);",
      "  float lL = dot(texture2D(uTex, uv-vec2(px.x,0.0)).rgb, vec3(0.299,0.587,0.114));",
      "  float lR = dot(texture2D(uTex, uv+vec2(px.x,0.0)).rgb, vec3(0.299,0.587,0.114));",
      "  float lU = dot(texture2D(uTex, uv-vec2(0.0,px.y)).rgb, vec3(0.299,0.587,0.114));",
      "  float lD = dot(texture2D(uTex, uv+vec2(0.0,px.y)).rgb, vec3(0.299,0.587,0.114));",
      "  vec3 n = normalize(vec3(lL-lR, lU-lD, 0.35));",
      "  vec3 light = normalize(vec3((uMouse.x-0.5)*2.2, (0.5-uMouse.y)*2.2, 0.85));",
      "  float diff = 0.62 + 0.55*max(dot(n, light), 0.0);",
      "  float spec = pow(max(dot(n, light), 0.0), 28.0);",
      "  float pulse = 0.97 + 0.03*sin(uTime*2.1);",
      "  col *= diff * pulse;",
      "  col += spec * vec3(0.88, 0.70, 0.38) * (0.35 + vH);",
      "  col += vH * vec3(0.08, 0.03, 0.02);",
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

    var N = 56;
    var verts = new Float32Array(N * N * 2);
    var idx = new Uint16Array((N - 1) * (N - 1) * 6);
    var i, j, p = 0;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      verts[p++] = (i / (N - 1)) * 2 - 1;
      verts[p++] = 1 - (j / (N - 1)) * 2;
    }
    p = 0;
    for (j = 0; j < N - 1; j++) for (i = 0; i < N - 1; i++) {
      var a = j * N + i;
      idx[p++] = a; idx[p++] = a + 1; idx[p++] = a + N;
      idx[p++] = a + 1; idx[p++] = a + N + 1; idx[p++] = a + N;
    }
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } catch (err) {
      return false;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var uCover = gl.getUniformLocation(prog, "uCover");
    var uMouse = gl.getUniformLocation(prog, "uMouse");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var t0 = performance.now();

    function resize() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.floor(w * dpr));
      canvas.height = Math.max(2, Math.floor(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
      var c = coverUV(img.naturalWidth, img.naturalHeight, w, h, 0.5, 0.46);
      gl.uniform4f(uCover, c.u, c.v, c.sx, c.sy);
    }
    resize();
    window.addEventListener("resize", resize);

    function frame() {
      var t = (performance.now() - t0) / 1000;
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uTime, t);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      requestAnimationFrame(frame);
    }
    wrap.classList.add("is-live");
    frame();
    return true;
  }

  function liveCanvas(wrap, img, canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
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
      var c = coverUV(img.naturalWidth, img.naturalHeight, w, h, 0.5, 0.46);
      var breath = 1 + 0.018 * Math.sin(performance.now() / 700);
      var ox = (mouse.x - 0.5) * 36;
      var oy = (mouse.y - 0.5) * 28;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + ox, h / 2 + oy);
      ctx.scale(breath, breath);
      ctx.drawImage(
        img,
        c.u * img.naturalWidth, c.v * img.naturalHeight,
        c.sx * img.naturalWidth, c.sy * img.naturalHeight,
        -w / 2, -h / 2, w, h
      );
      ctx.restore();
      var g = ctx.createRadialGradient(mouse.x * w, mouse.y * h, 20, mouse.x * w, mouse.y * h, w * 0.55);
      g.addColorStop(0, "rgba(255,220,160,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      requestAnimationFrame(draw);
    })();
  }
})();
