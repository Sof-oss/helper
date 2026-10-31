/* Живой фон Зоны на главной: фото группировки с объёмом по карте глубины - ближнее сдвигается сильнее дальнего,
   плывут облака, мерцают фонари и окна, в глубине и у земли ползёт туман, летят пыль и пепел, иногда - аномалия.
   Всё рисует один шейдер на весь экран (WebGL 1); карта глубины - assets/depth-<тема>.webp (build-depth.py). */
import { readTheme, isMobile, lowPower } from "./zone-theme.js";

const OCT = lowPower ? 3 : 5, // октавы шума тумана и облаков
  GLOW = lowPower ? 6 : 12, // точек на свечение фонарей
  SPARKS = lowPower ? 24 : 40; // искр у аномалии

const VERT = "attribute vec2 a;varying vec2 vUv;void main(){vUv=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
const FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uPhoto,uPhoto2,uDepth,uDepth2;
uniform vec2 uRes,uMouse;
uniform float uT,uAspect,uDim,uMix,uFlash;
uniform vec3 uAcc,uAcc2,uAnom; // аномалия: x, y - место на экране (0..1, y вверх), z - ход 0..1 (<0 - нет)
varying vec2 vUv;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<${OCT};i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}
/* фото закрывает экран целиком (как background-size: cover) */
vec2 cover(vec2 s,float zoom){float sa=uRes.x/uRes.y;vec2 u=s-.5;if(sa>uAspect)u.y*=uAspect/sa;else u.x*=sa/uAspect;return u/zoom+.5;}
float depthAt(vec2 p){float a=texture2D(uDepth,p).r;return uMix>0.?mix(a,texture2D(uDepth2,p).r,uMix):a;}
vec3 photo(vec2 p){vec3 a=texture2D(uPhoto,p).rgb;return uMix>0.?mix(a,texture2D(uPhoto2,p).rgb,uMix):a;}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
/* пыль и пепел: сетка ячеек, в редких - пылинка; оседает и летит по ветру. x - пепел, y - светящаяся искра */
vec2 motes(vec2 s,float sc,float fall,float wind,float sd,float sz){
  vec2 q=s*vec2(uRes.x/uRes.y,1.)*sc+vec2(-uT*wind,uT*fall)+sd;
  vec2 id=floor(q),f=fract(q)-.5;float h=hash(id+sd);
  vec2 o=(vec2(hash(id+3.1),hash(id+7.7))-.5)*.6+.12*vec2(sin(uT*.7+h*30.),cos(uT*.6+h*20.));
  float k=smoothstep(sz,0.,length(f-o))*(.45+.55*sin(uT*1.3+h*40.));
  return vec2(k*step(.72,h)*step(h,.975),k*step(.975,h));}
void main(){
  vec2 s=vUv;float ar=uRes.x/uRes.y;
  /* объём: камера чуть смещается за мышью/наклоном, ближние точки (белые на карте) уходят сильнее */
  vec2 cam=uMouse*vec2(.026,.016);
  vec2 uv=cover(s,1.1+.012*sin(uT*.12));
  vec2 p=uv;for(int i=0;i<4;i++)p=uv+cam*(depthAt(p)-.22);
  float d=depthAt(p);
  p+=vec2(sin(p.y*38.+uT*.7),cos(p.x*29.+uT*.55))*.00045; // марево
  p.x+=sin(p.y*620.+uT*2.4)*.0007*smoothstep(.36,.12,p.y); // рябь в лужах внизу
  /* аномалия: кольцо-линза преломляет фото, в центре - сгусток цвета группировки */
  float ring=0.,core=0.;vec2 adir=vec2(0.);
  if(uAnom.z>=0.){
    vec2 ad=(s-uAnom.xy)*vec2(ar,1.);float r=length(ad);
    float R=.02+uAnom.z*.26;
    ring=exp(-pow((r-R)/.035,2.))*(1.-uAnom.z);
    core=exp(-r*r/.0016)*sin(min(uAnom.z*2.,1.)*3.14159);
    adir=r>1e-4?ad/r:vec2(0.);adir.x/=ar;
    p-=adir*(ring*.03+core*.025);
  }
  vec3 c=photo(p);
  /* облака: два сдвинутых слоя по очереди (flow map) - небо плывёт без шва */
  float sky=(1.-smoothstep(.03,.12,d))*smoothstep(.45,.62,p.y);
  if(sky>.001){
    float a=fract(uT/14.),b=fract(uT/14.+.5),wa=1.-abs(1.-2.*a);
    vec2 w=vec2(fbm(p*vec2(3.,5.)+uT*.02)-.5,fbm(p*vec2(4.,7.)-uT*.015)-.5)*.012;
    vec2 pa=p+vec2(-.03*a,0.)+w,pb=p+vec2(-.03*b,0.)+w;
    float va=1.-smoothstep(.03,.12,depthAt(pa)),vb=1.-smoothstep(.03,.12,depthAt(pb));
    vec3 sc=photo(pa)*wa*va+photo(pb)*(1.-wa)*vb+c*(wa*(1.-va)+(1.-wa)*(1.-vb));
    c=mix(c,sc,sky);
  }
  if(ring>.01){float ca=ring*.006;c.r=photo(p+adir*ca).r;c.b=photo(p-adir*ca).b;} // радужный край кольца
  /* свет: мягкое свечение ярких точек и мерцание (фонари, окна, костёр) */
  vec3 g=vec3(0.);
  for(int i=0;i<${GLOW};i++){float an=float(i)*2.39996,r=.003+.0032*float(i)*${(12 / GLOW).toFixed(1)};
    vec3 q=photo(p+vec2(cos(an)/uAspect,sin(an))*r);g+=q*smoothstep(.5,.92,lum(q));}
  c+=g/${GLOW}.*(.7+.3*noise(vec2(uT*7.,p.x*30.+p.y*17.)))*1.5*vec3(1.,.82,.6);
  c=mix(c,c*.75+uAcc*.5,core*.6);
  c+=uAcc*(ring*.35+core*.45);
  /* туман цвета группировки; на аномалии вспыхивает */
  vec3 fogc=mix(vec3(.56,.6,.66),uAcc,.22+uFlash*.5)*(1.+uFlash);
  float fn=fbm(vec2(s.x*2.4+uT*.035,s.y*5.-uT*.012)+cam*4.);
  float band=smoothstep(.1,.55,1.-d)*smoothstep(.12,.32,p.y)*(1.-smoothstep(.55,.72,p.y));
  c=mix(c,fogc*(.55+.45*fn),band*fn*.42); // в глубине, между домами
  vec2 fq=vec2(s.x*3.2+uT*.05,s.y*7.)+cam*7.;
  float gn=fbm(fq+noise(fq*.5+uT*.03)*1.5);
  c=mix(c,fogc*.8,smoothstep(.42,.05,s.y)*smoothstep(.42,.9,gn)*.3); // низовой, стелется у земли
  /* затемнение и виньетка - как у CSS-фона (body::before) */
  float t=1.-s.y,dm=t<.3?mix(uDim+.1,uDim,t/.3):t<.7?mix(uDim,uDim+.15,(t-.3)/.4):mix(uDim+.15,1.,(t-.7)/.3);
  c=mix(c,vec3(.016,.024,.031),clamp(dm,0.,1.));
  c*=1.-clamp((length(vec2((s.x-.5)/1.2,(t-.4)/.9))-.55)/.45,0.,1.)*.55;
  /* пыль и пепел в три слоя: ближние крупнее и сильнее сдвигаются, дальние прячутся за ближними предметами */
  vec2 m1=motes(s+cam*.6,9.,.03,.05,1.,.05),m2=motes(s+cam*.35,16.,.025,.04,5.,.06),m3=motes(s+cam*.15,28.,.02,.03,9.,.08);
  float far=smoothstep(.5,.3,d);
  float fl=1.+uFlash*1.5;
  c+=vec3(.95,.88,.75)*(m1.x*.32+m2.x*.22+m3.x*.14*far)*fl;
  c+=(uAcc*1.3+.15)*(m1.y*.5+m2.y*.4+m3.y*.3*far)*fl;
  /* искры аномалии: разлетаются из центра и чуть падают */
  if(uAnom.z>=0.){
    float st=(uAnom.z-.06)/.55;
    if(st>0.&&st<1.){
      float e=1.-pow(1.-st,3.),sp=0.;vec2 o=uAnom.xy*vec2(ar,1.),q=s*vec2(ar,1.);
      for(int i=0;i<${SPARKS};i++){
        float fi=float(i),an=hash(vec2(fi,uAnom.x*91.))*6.2832,v=.4+hash(vec2(fi+7.,uAnom.y*53.));
        vec2 dv=q-o-vec2(cos(an),sin(an)*.8)*v*e*.2-vec2(0.,-st*st*.06);
        float sz=(.0025+v*.002)*(1.-st*.6);
        sp+=exp(-dot(dv,dv)/(sz*sz))*(.6+.4*sin(st*40.+v*30.));
      }
      c+=(uAcc2*1.4+.2)*sp*(1.-st);
    }
  }
  c+=(hash(s*uRes+fract(uT)*91.)-.5)*.018; // зерно - без полос на градиентах
  gl_FragColor=vec4(c,1.);
}`;

export function startBackground() {
  const canvas = document.createElement("canvas");
  canvas.className = "zone-bg";
  canvas.setAttribute("aria-hidden", "true");
  let gl;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });
  } catch (e) {
    gl = null;
  }
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  } catch (e) {
    console.warn("Фон главной: шейдер не собрался", e);
    return null;
  }
  gl.useProgram(prog);
  /* один треугольник на весь экран */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  [
    "uPhoto",
    "uPhoto2",
    "uDepth",
    "uDepth2",
    "uRes",
    "uMouse",
    "uT",
    "uAspect",
    "uDim",
    "uMix",
    "uFlash",
    "uAcc",
    "uAcc2",
    "uAnom"
  ].forEach(n => (U[n] = gl.getUniformLocation(prog, n)));
  /* блоки текстур: 0 - фото, 1 - следующее фото (смена темы), 2 - глубина, 3 - следующая глубина */
  gl.uniform1i(U.uPhoto, 0);
  gl.uniform1i(U.uPhoto2, 1);
  gl.uniform1i(U.uDepth, 2);
  gl.uniform1i(U.uDepth2, 3);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const makeTex = (unit, px) => {
    const t = gl.createTexture();
    bindTex(unit, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(px));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  function bindTex(unit, t) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }
  const upload = (unit, t, img) => {
    bindTex(unit, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  };
  /* пока нет карты глубины (не загрузилась) - сцена плоская, остальное работает */
  const FLAT = [70, 70, 70];
  let cur = { photo: makeTex(0, [4, 6, 8]), depth: makeTex(2, FLAT) },
    next = { photo: makeTex(1, [4, 6, 8]), depth: makeTex(3, FLAT) };
  const bindSet = () => {
    bindTex(0, cur.photo);
    bindTex(2, cur.depth);
    bindTex(1, next.photo);
    bindTex(3, next.depth);
  };
  document.body.prepend(canvas);

  let theme = readTheme();
  const setTheme = t => {
    gl.uniform3fv(U.uAcc, t.accent);
    gl.uniform3fv(U.uAcc2, t.accent2);
    gl.uniform1f(U.uDim, t.dim);
  };
  setTheme(theme);
  const loadImg = url =>
    new Promise(ok => {
      if (!url) return ok(null);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = url;
    });
  let aspect = 16 / 9;
  /* фото и карта глубины темы; при смене группировки новое фото проявляется поверх старого */
  let fade = null,
    loading = 0;
  function loadBg(t, first) {
    const id = ++loading;
    Promise.all([loadImg(t.bg), loadImg(t.depth)]).then(([img, dimg]) => {
      if (id !== loading || dead || !img) return;
      wake(); // новое фото надо отрисовать, даже если фон на паузе
      const set = first ? cur : next;
      upload(first ? 0 : 1, set.photo, img);
      if (dimg) upload(first ? 2 : 3, set.depth, dimg);
      else {
        bindTex(first ? 2 : 3, set.depth);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(FLAT));
      }
      aspect = img.width / img.height;
      if (first) requestAnimationFrame(() => canvas.classList.add("on"));
      else fade = { t0: performance.now() };
    });
  }
  loadBg(theme, true);
  new MutationObserver(() =>
    requestAnimationFrame(() => {
      const t = readTheme();
      if (t.key === theme.key) return;
      theme = t;
      setTheme(t);
      loadBg(t, false);
    })
  ).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  let W = 1,
    H = 1;
  const px = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
  function resize() {
    W = window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * px));
    canvas.height = Math.max(1, Math.round(H * px));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener("resize", resize);

  /* мышь и наклон телефона */
  const target = { x: 0, y: 0 },
    view = { x: 0, y: 0 };
  const setTarget = (x, y) => {
    target.x = x;
    target.y = y;
  };
  let lastInput = 0;
  window.addEventListener(
    "pointermove",
    e => {
      if (e.pointerType !== "mouse") return;
      setTarget((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1);
      lastInput = performance.now();
    },
    { passive: true }
  );
  /* наклон планшета/телефона. */
  let base = null;
  const cl = v => Math.max(-1, Math.min(1, v));
  const angle = () => (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    const a = ((angle() % 360) + 360) % 360;
    const x = a === 90 ? e.beta : a === 270 ? -e.beta : a === 180 ? -e.gamma : e.gamma;
    const y = a === 90 ? -e.gamma : a === 270 ? e.gamma : a === 180 ? -e.beta : e.beta;
    if (!base) base = { x, y };
    setTarget(cl((x - base.x) / 20), cl((y - base.y) / 20));
    lastInput = performance.now();
  }
  const resetBase = () => {
    base = null;
  };
  window.addEventListener("orientationchange", resetBase);
  if (screen.orientation) screen.orientation.addEventListener("change", resetBase);
  /* iOS/iPadOS (Safari 13+) не присылает наклон без разрешения, а спросить его можно только по нажатию. */
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    let busy = false;
    const stop = () => {
      window.removeEventListener("touchend", ask, true);
      window.removeEventListener("click", ask, true);
    };
    const ask = () => {
      if (busy) return;
      busy = true;
      DOE.requestPermission()
        .then(r => {
          stop(); // ответ получен - больше не спрашиваем
          if (r === "granted") window.addEventListener("deviceorientation", onTilt, { passive: true });
        })
        .catch(() => {
          busy = false;
        }); // касание не засчиталось (например, прокрутка) - спросим при следующем
    };
    window.addEventListener("touchend", ask, true);
    window.addEventListener("click", ask, true);
  } else window.addEventListener("deviceorientation", onTilt, { passive: true });
  /* пока наклона нет (не разрешили или нет датчика) - фон чуть следует за пальцем при прокрутке */
  let touch0 = null;
  window.addEventListener(
    "touchstart",
    e => {
      const t = e.touches[0];
      touch0 = { x: t.clientX, y: t.clientY, tx: target.x, ty: target.y };
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    e => {
      if (!touch0 || base) return;
      const t = e.touches[0];
      setTarget(cl(touch0.tx + ((t.clientX - touch0.x) / W) * 1.5), cl(touch0.ty + ((t.clientY - touch0.y) / H) * 1.5));
      lastInput = performance.now();
    },
    { passive: true }
  );

  /* аномалия: раз в 7–14 секунд в случайном месте */
  let anom = null,
    nextAnom = performance.now() + 3500 + Math.random() * 3000;
  function spawnAnomaly(now) {
    /* доля экрана: x слева, y сверху - в шейдер идёт снизу */
    anom = { t0: now, dur: 2200, x: 0.15 + Math.random() * 0.7, y: 1 - (0.18 + Math.random() * 0.45) };
    nextAnom = now + 7000 + Math.random() * 7000;
  }

  const FPS = 30,
    FRAME_MS = 1000 / FPS,
    IDLE_STOP_MS = 20000,
    LOOP_S = 1800; // время в шейдере идёт по кругу: на телефонах точность float падает на больших числах
  let t0 = performance.now();
  let raf = 0,
    lastFrame = 0,
    lastActive = t0,
    pausedAt = 0,
    dead = false;
  function wake() {
    lastActive = performance.now();
    if (raf || dead) return;
    const d = lastActive - pausedAt; // время на паузе - сдвигаем часы, чтобы сцена не прыгнула
    t0 += d;
    nextAnom += d;
    raf = requestAnimationFrame(frame);
  }
  ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"].forEach(ev =>
    window.addEventListener(ev, wake, { passive: true })
  );
  function frame() {
    const now = performance.now();
    /* пауза: только когда нет аномалии и смены фона, иначе они застынут на середине */
    if (now - lastActive > IDLE_STOP_MS && !anom && !fade) {
      raf = 0;
      pausedAt = now;
      return;
    }
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < FRAME_MS - 2) return; // −2 мс: запас на неровный шаг кадров у монитора
    lastFrame = now;
    const time = ((now - t0) / 1000) % LOOP_S;
    /* без движения мыши сцена сама еле заметно «дышит» */
    const idle = now - lastInput > 4000;
    const amp = isMobile ? 1.8 : 1; // без мыши фон «дышит» заметнее
    const tx = idle ? Math.sin(time * 0.13) * 0.35 * amp : target.x,
      ty = idle ? Math.sin(time * 0.09) * 0.25 * amp : target.y;
    view.x += (tx - view.x) * 0.05;
    view.y += (ty - view.y) * 0.05;

    if (now > nextAnom && !anom) spawnAnomaly(now);
    let ak = -1,
      flash = 0;
    if (anom) {
      ak = (now - anom.t0) / anom.dur;
      if (ak >= 1) {
        anom = null;
        ak = -1;
      } else flash = Math.max(0, Math.sin(ak * Math.PI)) * 0.35 * (1 + 0.5 * Math.sin(now * 0.05));
    }
    let mix = 0;
    if (fade) {
      mix = Math.min(1, (now - fade.t0) / 900);
      if (mix >= 1) {
        /* новое фото стало основным, старые текстуры пойдут под следующую смену */
        [cur, next] = [next, cur];
        bindSet();
        mix = 0;
        fade = null;
      }
    }
    gl.uniform1f(U.uT, time);
    gl.uniform2f(U.uMouse, view.x, -view.y);
    gl.uniform1f(U.uAspect, aspect);
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uFlash, flash);
    gl.uniform3f(U.uAnom, anom ? anom.x : 0, anom ? anom.y : 0, ak);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  raf = requestAnimationFrame(frame);
  /* смена темы, размера окна и загрузка фото тоже будят фон: иначе изменение не отрисуется */
  window.addEventListener("resize", wake);
  new MutationObserver(wake).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* потеря контекста (бывает на телефонах): прячем холст, остаётся CSS-фон */
  canvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    dead = true;
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.classList.remove("on");
  });
  return { canvas, spawnAnomaly: () => spawnAnomaly(performance.now()) };
}
