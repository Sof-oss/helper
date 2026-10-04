/* Живой фон Зоны на главной: фото группировки с глубиной, туман, пыль и пепел, иногда — аномалия.
   Камера чуть поворачивается за мышью (на телефоне — за наклоном, если браузер даёт эти данные).
   Затемнение и виньетка повторяют CSS-фон (body::before в visual.css), так что сайт выглядит как раньше,
   только оживает. Если что-то пошло не так, остаётся обычный CSS-фон. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Mesh, TextureLoader,
  BufferGeometry, Float32BufferAttribute, Points, AdditiveBlending, NormalBlending, LinearFilter,
  LinearSRGBColorSpace, NoColorSpace, Vector2, Vector3
} from "three";
import { readTheme, isMobile, lowPower } from "./zone-theme.js";

const FOV = 45, PHOTO_Z = -20;
const NOISE = /* glsl */`
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<OCT;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}
`;

export function startBackground() {
  const canvas = document.createElement("canvas");
  canvas.className = "zone-bg";
  canvas.setAttribute("aria-hidden", "true");
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  } catch (e) { return null; }
  renderer.outputColorSpace = LinearSRGBColorSpace; // цвета как в CSS, без пересчёта
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  document.body.prepend(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  let theme = readTheme();
  const U = { time: { value: 0 } };
  const accent = { value: new Vector3(...theme.accent) };
  const accent2 = { value: new Vector3(...theme.accent2) };

  /* ---------- фото с аномалией ---------- */
  const loader = new TextureLoader();
  const prepTex = t => { t.colorSpace = NoColorSpace; t.minFilter = LinearFilter; t.generateMipmaps = false; return t; };
  const photoMat = new ShaderMaterial({
    uniforms: {
      time: U.time, map: { value: null }, map2: { value: null }, mixT: { value: 0 },
      dim: { value: theme.dim }, res: { value: new Vector2(1, 1) }, aspect: { value: 1 },
      anomPos: { value: new Vector2(0.5, 0.5) }, anomT: { value: -1 }, accent
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: /* glsl */`
      uniform sampler2D map,map2;uniform float time,mixT,dim,aspect,anomT;uniform vec2 res,anomPos;uniform vec3 accent;
      varying vec2 vUv;
      vec3 photo(vec2 uv){vec3 a=texture2D(map,uv).rgb;return mixT>0.?mix(a,texture2D(map2,uv).rgb,mixT):a;}
      void main(){
        vec2 uv=vUv;
        uv+=vec2(sin(uv.y*38.+time*.7),cos(uv.x*29.+time*.55))*.00045;   // марево
        vec3 c;float ring=0.,core=0.;
        if(anomT>=0.){
          vec2 d=uv-anomPos;d.x*=aspect;float r=length(d);
          float R=.02+anomT*.22,fade=1.-anomT;
          ring=exp(-pow((r-R)/.035,2.))*fade;
          core=exp(-r*r/.0016)*sin(min(anomT*2.,1.)*3.14159);
          vec2 dir=r>1e-4?d/r:vec2(0.);dir.x/=aspect;
          vec2 off=dir*(ring*.03+core*.025);
          float ca=ring*.006;                                             // радужный край
          c=vec3(photo(uv-off+dir*ca).r,photo(uv-off).g,photo(uv-off-dir*ca).b);
          c=mix(c,c*vec3(.75)+accent*.5,core*.6);
          c+=accent*(ring*.35+core*.45);
        } else c=photo(uv);
        /* затемнение и виньетка — как в CSS (body::before) */
        vec2 s=gl_FragCoord.xy/res;float t=1.-s.y;
        float a=t<.3?mix(dim+.1,dim,t/.3):t<.7?mix(dim,dim+.15,(t-.3)/.4):mix(dim+.15,1.,(t-.7)/.3);
        c=mix(c,vec3(.016,.024,.031),clamp(a,0.,1.));
        float v=length(vec2((s.x-.5)/1.2,(t-.4)/.9));
        c*=1.-clamp((v-.55)/.45,0.,1.)*.55;
        gl_FragColor=vec4(c,1.);
      }`,
    depthWrite: false, depthTest: false
  });
  const photo = new Mesh(new PlaneGeometry(1, 1), photoMat);
  photo.position.z = PHOTO_Z; photo.renderOrder = 0;
  scene.add(photo);
  let imgAspect = 16 / 9;

  /* ---------- туман: три слоя на разной глубине ---------- */
  const fogs = [[-15, 0.012, 2.2, 0.42], [-10, 0.02, 3.0, 0.34], [-6, 0.03, 4.2, 0.22]].map(([z, speed, scale, op], i) => {
    const m = new ShaderMaterial({
      defines: { OCT: lowPower ? 3 : 5 },
      uniforms: { time: U.time, speed: { value: speed }, scale: { value: scale }, op: { value: op }, seed: { value: i * 7.3 }, accent, flash: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: NOISE + /* glsl */`
        uniform float time,speed,scale,op,seed,flash;uniform vec3 accent;varying vec2 vUv;
        void main(){
          vec2 p=vUv*vec2(scale*1.8,scale)+vec2(time*speed+seed,time*speed*.35);
          float n=fbm(p+fbm(p*.6+time*speed*.5));
          float a=smoothstep(.42,.9,n)*op;
          a*=mix(.35,1.,smoothstep(.85,.15,vUv.y));                        // гуще внизу
          a*=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x)*smoothstep(0.,.1,vUv.y)*smoothstep(1.,.85,vUv.y);
          vec3 col=mix(vec3(.6,.64,.68),accent,.28+flash*.5);
          gl_FragColor=vec4(col*(1.+flash),a);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: NormalBlending
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), m);
    mesh.position.z = z; mesh.renderOrder = 1 + i;
    scene.add(mesh);
    return mesh;
  });

  /* ---------- пыль и пепел: движение считает видеокарта ---------- */
  const N = lowPower ? 320 : 900, BOX = new Vector3(34, 20, 16);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - .5) * BOX.x, (Math.random() - .5) * BOX.y, -3 - Math.random() * BOX.z], i * 3);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  dustGeo.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
  const dustMat = new ShaderMaterial({
    uniforms: { time: U.time, px: { value: renderer.getPixelRatio() }, box: { value: BOX }, accent, flash: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float time,px;uniform vec3 box;attribute vec4 aSeed;varying float vA;varying float vGlow;
      void main(){
        vec3 p=position;
        p.y=mod(p.y-time*(.08+aSeed.x*.22)+box.y*.5,box.y)-box.y*.5;          // медленно оседает
        p.x=mod(p.x+time*(.12+aSeed.y*.25)+box.x*.5,box.x)-box.x*.5;           // ветер
        p.x+=sin(time*(.3+aSeed.z*.5)+aSeed.w*6.28)*.5;
        p.y+=cos(time*(.25+aSeed.w*.4)+aSeed.z*6.28)*.3;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vGlow=step(.93,aSeed.x);                                               // редкие светящиеся искры
        gl_PointSize=(1.4+aSeed.w*2.6+vGlow*2.)*px*(9./-mv.z);
        vA=(.35+.65*abs(sin(time*(.4+aSeed.y)+aSeed.z*20.)))*smoothstep(-19.,-14.,mv.z)*smoothstep(-2.,-4.,mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 accent;uniform float flash;varying float vA;varying float vGlow;
      void main(){
        float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*vA;
        vec3 ash=vec3(.82,.8,.76);
        vec3 col=mix(ash*.55,accent*1.3+.15,vGlow);
        gl_FragColor=vec4(col*(1.+flash*1.5),a*(.55+vGlow*.45));
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending
  });
  const dust = new Points(dustGeo, dustMat);
  dust.renderOrder = 5; dust.frustumCulled = false;
  scene.add(dust);

  /* ---------- искры аномалии ---------- */
  const SN = 70, sdir = new Float32Array(SN * 3), sspd = new Float32Array(SN);
  for (let i = 0; i < SN; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
    sdir.set([Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b) * .4], i * 3);
    sspd[i] = .4 + Math.random();
  }
  const sparkGeo = new BufferGeometry();
  sparkGeo.setAttribute("position", new Float32BufferAttribute(sdir, 3));
  sparkGeo.setAttribute("aSpd", new Float32BufferAttribute(sspd, 1));
  const sparkMat = new ShaderMaterial({
    uniforms: { origin: { value: new Vector3() }, t: { value: -1 }, px: { value: renderer.getPixelRatio() }, accent2 },
    vertexShader: /* glsl */`
      uniform vec3 origin;uniform float t,px;attribute float aSpd;varying float vA;
      void main(){
        float e=1.-pow(1.-t,3.);
        vec3 p=origin+position*aSpd*e*2.2+vec3(0.,-t*t*.8,0.);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vA=t<0.?0.:(1.-t)*(.6+.4*sin(t*40.+aSpd*30.));
        gl_PointSize=(3.+aSpd*3.)*(1.-t*.6)*px*(9./-mv.z);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform vec3 accent2;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(accent2*1.4+.2,smoothstep(.5,0.,d)*vA);}`,
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending
  });
  const sparks = new Points(sparkGeo, sparkMat);
  sparks.renderOrder = 6; sparks.frustumCulled = false;
  scene.add(sparks);

  /* ---------- размеры: фото и туман всегда закрывают экран с запасом под наклон ---------- */
  let W = 1, H = 1;
  const viewAt = z => { const h = 2 * Math.abs(z) * Math.tan(FOV * Math.PI / 360); return [h * camera.aspect, h]; };
  function fitPhoto() {
    const [vw, vh] = viewAt(PHOTO_Z), m = 1.14;
    let w = vw * m, h = w / imgAspect;
    if (h < vh * m) { h = vh * m; w = h * imgAspect; }
    photo.scale.set(w, h, 1);
    photoMat.uniforms.aspect.value = imgAspect;
  }
  function resize() {
    W = window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    photoMat.uniforms.res.value.set(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    fitPhoto();
    fogs.forEach(f => { const [vw, vh] = viewAt(f.position.z); f.scale.set(vw * 1.35, vh * 1.3, 1); });
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- фон темы и смена группировки (плавно) ---------- */
  let fade = null;
  function loadBg(url, first) {
    if (!url) return;
    loader.load(url, tex => {
      prepTex(tex);
      imgAspect = tex.image.width / tex.image.height;
      if (first || !photoMat.uniforms.map.value) {
        photoMat.uniforms.map.value = tex; fitPhoto();
        requestAnimationFrame(() => canvas.classList.add("on"));
      } else {
        photoMat.uniforms.map2.value = tex; fitPhoto();
        fade = { t0: performance.now(), tex };
      }
    });
  }
  loadBg(theme.bg, true);
  new MutationObserver(() => requestAnimationFrame(() => {
    const t = readTheme();
    if (t.key === theme.key) return;
    theme = t;
    accent.value.set(...t.accent); accent2.value.set(...t.accent2);
    photoMat.uniforms.dim.value = t.dim;
    loadBg(t.bg, false);
  })).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- мышь и наклон телефона ---------- */
  const target = new Vector2(), cur = new Vector2();
  let lastInput = 0;
  window.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    target.set(e.clientX / W * 2 - 1, e.clientY / H * 2 - 1); lastInput = performance.now();
  }, { passive: true });
  let base = null;
  window.addEventListener("deviceorientation", e => {
    if (e.gamma == null || e.beta == null) return;
    if (!base) base = { b: e.beta, g: e.gamma };
    const cl = v => Math.max(-1, Math.min(1, v));
    target.set(cl((e.gamma - base.g) / 20), cl((e.beta - base.b) / 20)); lastInput = performance.now();
  }, { passive: true });

  /* ---------- аномалия: раз в 7–14 секунд в случайном месте ---------- */
  let anom = null, nextAnom = performance.now() + 3500 + Math.random() * 3000;
  function spawnAnomaly(now) {
    const sx = .15 + Math.random() * .7, sy = .18 + Math.random() * .45;   // доля экрана (сверху)
    const [vw, vh] = viewAt(PHOTO_Z);
    const wx = (sx - .5) * vw, wy = (.5 - sy) * vh;
    photoMat.uniforms.anomPos.value.set(wx / photo.scale.x + .5, wy / photo.scale.y + .5);
    sparkMat.uniforms.origin.value.set(wx, wy, PHOTO_Z).multiplyScalar(12 / 20);
    anom = { t0: now, dur: 2200 };
    nextAnom = now + 7000 + Math.random() * 7000;
  }

  /* ---------- цикл ---------- */
  const t0 = performance.now();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const time = (now - t0) / 1000;
    U.time.value = time;
    /* без движения мыши сцена сама еле заметно «дышит» */
    const idle = now - lastInput > 4000;
    const tx = idle ? Math.sin(time * .13) * .35 : target.x, ty = idle ? Math.sin(time * .09) * .25 : target.y;
    cur.x += (tx - cur.x) * .04; cur.y += (ty - cur.y) * .04;
    camera.rotation.set(-cur.y * .028, -cur.x * .04, 0);
    camera.position.set(cur.x * .45, -cur.y * .28, 0);

    if (now > nextAnom && !anom) spawnAnomaly(now);
    if (anom) {
      const k = (now - anom.t0) / anom.dur;
      if (k >= 1) { anom = null; photoMat.uniforms.anomT.value = -1; sparkMat.uniforms.t.value = -1; }
      else {
        photoMat.uniforms.anomT.value = k;
        const st = (k - .06) / .55;                     // искры разлетаются в начале аномалии
        sparkMat.uniforms.t.value = st < 0 || st >= 1 ? -1 : st;
        const fl = Math.max(0, Math.sin(k * Math.PI)) * .35 * (1 + .5 * Math.sin(now * .05));
        fogs.forEach(f => { f.material.uniforms.flash.value = fl; });
        dustMat.uniforms.flash.value = fl * .6;
      }
    } else {
      fogs.forEach(f => { f.material.uniforms.flash.value = 0; });
      dustMat.uniforms.flash.value = 0;
    }
    if (fade) {
      const k = Math.min(1, (now - fade.t0) / 900);
      photoMat.uniforms.mixT.value = k;
      if (k >= 1) {
        const old = photoMat.uniforms.map.value;
        photoMat.uniforms.map.value = fade.tex; photoMat.uniforms.map2.value = null; photoMat.uniforms.mixT.value = 0;
        if (old && old !== fade.tex) old.dispose();
        fade = null;
      }
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  /* потеря контекста (бывает на телефонах): прячем холст, остаётся CSS-фон */
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); canvas.classList.remove("on"); });
  return { canvas, spawnAnomaly: () => spawnAnomaly(performance.now()) };
}
