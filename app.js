// Live release data from GitHub and the moving background.
(function () {
  "use strict";

  const REPO = "SamoVR/Launcher";
  const SETUP_PREFIX = "SamoLauncher-Setup";
  const CACHE_MINUTES = 10;

  async function latestRelease() {
    const key = "launcher:latest";
    try {
      const hit = JSON.parse(sessionStorage.getItem(key) || "null");
      if (hit && Date.now() - hit.time < CACHE_MINUTES * 60000) return hit.data;
    } catch (e) { /* storage unavailable */ }
    const response = await fetch("https://api.github.com/repos/" + REPO + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("GitHub answered " + response.status);
    const data = await response.json();
    try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data: data })); } catch (e) { /* ignore */ }
    return data;
  }

  function showRelease(release) {
    const button = document.getElementById("download");
    const meta = document.getElementById("download-meta");
    const notes = document.getElementById("release-notes");
    const setup = (release.assets || []).find((a) => a.name.startsWith(SETUP_PREFIX) && a.name.endsWith(".exe"));

    if (setup && setup.browser_download_url.startsWith("https://github.com/" + REPO + "/releases/download/")) {
      button.href = setup.browser_download_url;
      meta.textContent = "";
      const version = document.createElement("b");
      version.textContent = release.tag_name;
      meta.append(version, ", " + Math.round(setup.size / 1048576) + " MB. Windows 10 and 11. No administrator rights needed.");
    }

    notes.textContent = "";
    const title = document.createElement("p");
    title.className = "release-title";
    title.textContent = release.name || release.tag_name;
    const date = document.createElement("p");
    date.className = "release-date";
    date.textContent = new Date(release.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const body = document.createElement("p");
    body.className = "release-body";
    body.textContent = release.body || "No notes for this version.";
    notes.append(title, date, body);
  }

  latestRelease().then((release) => { if (release) showRelease(release); }).catch(() => { /* the static page still works */ });

  // ---- the same violet and cyan field as the launcher and samovr.github.io
  const canvas = document.getElementById("field");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });
  if (!gl) return;

  const FRAG = `precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
    float fbm(vec2 p){ float v=0.0,a=0.5; mat2 r=mat2(0.8,0.6,-0.6,0.8); for(int i=0;i<4;i++){ v+=a*noise(p); p=r*p*2.02; a*=0.45; } return v; }
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes; vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
      vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0); float t=uTime*0.035;
      vec2 q=vec2(fbm(p*1.5+t+m*0.15),fbm(p*1.5-t+vec2(3.1,1.7)));
      vec2 r=vec2(fbm(p*1.3+2.0*q+vec2(1.7,9.2)+t*1.4),fbm(p*1.3+2.0*q+vec2(8.3,2.8)-t));
      float f=fbm(p*1.1+2.3*r);
      vec3 base=vec3(0.031,0.031,0.043), violet=vec3(0.545,0.518,1.0), cyan=vec3(0.22,0.741,0.973);
      vec3 col=mix(base,violet*0.66,smoothstep(0.24,0.72,f)*0.88);
      col=mix(col,cyan*0.46,smoothstep(0.42,0.76,r.x)*0.42);
      float d=length(p-m); col+=violet*0.1*exp(-d*d*4.0);
      col=mix(base,col,smoothstep(0.0,0.4,uv.y));
      col+=(hash(gl_FragCoord.xy+fract(uTime*7.0))-0.5)*0.008;
      gl_FragColor=vec4(col,1.0);
    }`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  }
  const vs = compile(gl.VERTEX_SHADER, "attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }");
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, "uRes"), uTime = gl.getUniformLocation(program, "uTime"), uMouse = gl.getUniformLocation(program, "uMouse");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now();
  const mouse = { x: 0.62, y: 0.6, tx: 0.62, ty: 0.6 };
  let raf = 0, last = 0, visible = true;

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    if (now - last < 32) { kick(); return; }
    last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) kick();
  }
  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 0.6;
    const w = Math.max(1, Math.floor(canvas.clientWidth * scale)), h = Math.max(1, Math.floor(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uRes, w, h);
    kick();
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; kick(); }).observe(canvas);
  document.addEventListener("visibilitychange", kick);
  addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; }, { passive: true });
  resize();
})();
