/* Заставка при первом заходе: «Сердце Зоны». Гранёное сердце-артефакт бьётся («тук-тук» ×2), каждый удар
   выпускает волну, волны складываются в дуги знака радиации вокруг сердца. Знак вспыхивает и становится логотипом,
   и сердце вместе со знаком улетает в левый верхний угол - точно на место логотипа в шапке (там тот же SVG-знак
   из zone-sign.js и рендер той же модели сердца, поэтому подмена незаметна).
   Показывается один раз (метка zoneIntroSeen в браузере) прозрачным слоем поверх уже открытой страницы: содержимое видно
   и доступно сразу, слой не перехватывает клики. Пропустить - кнопка, любая клавиша, клик, касание или прокрутка */
import {
  Scene,
  PerspectiveCamera,
  PMREMGenerator,
  PlaneGeometry,
  ShaderMaterial,
  MeshBasicMaterial,
  Vector3,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  Mesh,
  AdditiveBlending,
  SRGBColorSpace,
  WebGLRenderer,
  ACESFilmicToneMapping
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createHeart, createHeartLights, LOGO_HEART, LOGO_BEAT } from "./zone-heart.js";
import { SIGN, signSVG } from "./zone-sign.js";
import { lowPower } from "./zone-theme.js";

const SEEN = "zoneIntroSeen";
const clamp = x => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = x => 1 - (1 - x) ** 3;
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOutBack = x => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const pulse = (t, at, w = 0.075) => Math.exp(-(((t - at) / w) ** 2));

/* хронология, с */
const BEATS = [0.85, 1.07, 1.75, 1.97]; // два «тук-тук»; каждый удар - волна, первые три встают дугами знака
const LOCK = 2.45; // знак вспыхивает целиком и становится логотипом
const FLY = [3.0, 3.9]; // сердце вместе со знаком улетает в шапку
export const DURATION = 3.95;

/* знак - те же размеры, что у логотипа (src/zone-sign.js): радиусы и толщина в долях стороны знака */
const RINGS = SIGN.logo.radii.map(r => r / 100);
const BAND = SIGN.logo.width / 100;
const SIDE = 4.2; // сторона знака в заставке, единицы сцены
const EXT = 2.4; // плоскость волн шире знака: свободные волны уходят дальше
const DEPTH = 1.2; // знак - за сердцем
const N = 8;

/* волны, складывающиеся в знак радиации, - шейдер на плоскости за сердцем (координаты - в сторонах знака) */
function waveMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uR: { value: new Array(N).fill(0) },
      uA: { value: new Array(N).fill(0) },
      uM: { value: new Array(N).fill(0) },
      uW: { value: new Array(N).fill(0.05) },
      uFill: { value: 0 }
    },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy * ${EXT.toFixed(2)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vP;
      uniform float uR[${N}], uA[${N}], uM[${N}], uW[${N}], uFill;
      const float PI = 3.14159265;
      void main(){
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        /* лопасти по 60° с центрами на 30°, 150° и 270° - как у знака радиации */
        float d = abs(mod(a - PI / 6. + PI / 3., 2. * PI / 3.) - PI / 3.);
        float blade = 1. - smoothstep(PI / 6. - .012, PI / 6. + .012, d);
        float I = 0.;
        for (int i = 0; i < ${N}; i++) {
          float band = exp(-pow((r - uR[i]) / uW[i], 2.));
          I += uA[i] * band * mix(1., blade, uM[i]);
        }
        float r0 = ${(RINGS[0] - BAND).toFixed(4)}, r1 = ${(RINGS[RINGS.length - 1] + BAND).toFixed(4)};
        I += uFill * blade * smoothstep(r0 - .01, r0, r) * (1. - smoothstep(r1, r1 + .01, r));
        vec3 col = mix(vec3(1., .4, .08), vec3(1., .9, .7), smoothstep(.45, 1., I));
        I = min(I, 1.2);
        gl_FragColor = vec4(col * I, I);
      }`
  });
}
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,120,80,1)");
  gr.addColorStop(0.3, "rgba(220,40,30,.45)");
  gr.addColorStop(1, "rgba(120,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
/* готовый знак - тот же SVG, что в шапке: в конце заставки волны превращаются ровно в логотип */
export function loadSign(px) {
  return new Promise((ok, bad) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = px;
      c.getContext("2d").drawImage(im, 0, 0, px, px);
      const t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      ok(t);
    };
    im.onerror = bad;
    im.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(signSVG().replace("<svg", `<svg width="${px}" height="${px}"`));
  });
}

/* Сцена заставки. render(t, target) рисует кадр в момент t (с); target - куда прилететь: {x, y, k}
   (центр знака на плоскости z=0 и масштаб знака). Детерминирована по t - удобно проверять по кадрам */
export function createIntroScene(renderer, signTex) {
  const scene = new Scene(),
    camera = new PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 8.6);
  const pm = new PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6; // как в картинке логотипа
  const lights = createHeartLights(scene);

  const heart = createHeart();
  const H = (LOGO_HEART.h * SIDE) / heart.height; // масштаб сердца при знаке стороной SIDE
  scene.add(heart.group);

  const glowTex = glowTexture();
  const glow = new Sprite(
    new SpriteMaterial({ map: glowTex, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 })
  );
  scene.add(glow);
  const wMat = waveMaterial();
  const waves = new Mesh(new PlaneGeometry(1, 1), wMat);
  scene.add(waves);
  const sMat = new MeshBasicMaterial({
    map: signTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0
  });
  const sign = new Mesh(new PlaneGeometry(1, 1), sMat);
  scene.add(sign);
  const FREE = BEATS.length;
  const C = new Vector3(),
    A = new Vector3();

  /* слой на глубине d за сердцем: так он на экране совпадает с плоским логотипом при любом месте и размере */
  const behind = (o, d, size) => {
    const m = (camera.position.z + d) / camera.position.z;
    o.position.set(C.x * m, C.y * m, -d);
    o.scale.set(size * m, size * m, 1);
  };

  function render(t, target) {
    const appear = seg(t, 0, 0.7);
    let b = 0;
    BEATS.forEach((s, i) => (b = Math.max(b, pulse(t, s) * (i % 2 ? 0.75 : 1))));
    b = Math.max(b, pulse(t, LOCK, 0.09) * 1.15);
    const fly = easeInOut(seg(t, FLY[0], FLY[1]));
    const tgt = target || { x: 0, y: 0.05, k: 1 };

    /* центр и масштаб знака: полёт - с плавным уменьшением (по логарифму) */
    C.set(0.05 * (1 - fly) + tgt.x * fly, 0.05 * (1 - fly) + tgt.y * fly, 0);
    const k = Math.exp(Math.log(tgt.k) * fly);

    /* сердце: смотрит в камеру (как на картинке логотипа), пока не улетело - чуть покачивается */
    const sway = 1 - fly;
    const hk = H * k * (0.2 + 0.8 * easeOutBack(appear)) * (1 + 0.1 * b * sway);
    const g = heart.group;
    g.position.copy(C);
    g.lookAt(camera.position);
    g.rotateY((-1.3 * (1 - easeInOut(appear)) + 0.3 * Math.sin(t * 1.25)) * sway);
    g.rotateX(0.1 * Math.sin(t * 0.9) * sway);
    g.scale.set(hk * (1 - 0.04 * b * sway), hk * (1 + 0.05 * b * sway), hk);
    g.updateMatrixWorld();
    A.copy(heart.anchor).multiplyScalar(hk).applyQuaternion(g.quaternion);
    g.position.sub(A);
    lights.place(C, g.rotation, hk);
    heart.beat(clamp(LOGO_BEAT * 0.7 + b * 0.7) * sway + LOGO_BEAT * fly);

    behind(glow, 0.6, SIDE * k * (0.62 + 0.3 * b));
    glow.material.opacity = clamp(appear * 1.4) * (0.3 + 0.5 * b) * sway;

    /* волны: каждая выходит из сердца кругом, по пути сужается до трёх лопастей и встаёт дугой знака */
    const u = wMat.uniforms;
    const settle = seg(t, LOCK - 0.1, LOCK + 0.3);
    BEATS.forEach((te, i) => {
      const kk = seg(t, te, te + 0.55);
      if (i < RINGS.length) {
        u.uR.value[i] = 0.12 + (RINGS[i] - 0.12) * easeOut(kk);
        u.uM.value[i] = easeInOut(seg(kk, 0.25, 1));
        u.uW.value[i] = BAND * 0.95 + 0.035 * (1 - kk);
        u.uA.value[i] =
          t < te ? 0 : (0.6 + 0.35 * (1 - kk) + 0.3 * pulse(t, LOCK, 0.12)) * (1 - settle) * (1 - 0.1 * i);
      }
      const f = seg(t, te, te + 1.1);
      u.uR.value[FREE + i] = 0.12 + 0.95 * easeOut(f);
      u.uM.value[FREE + i] = 0;
      u.uW.value[FREE + i] = 0.025;
      u.uA.value[FREE + i] = t < te || f >= 1 ? 0 : 0.3 * (1 - f) * (i % 2 ? 0.7 : 1);
    });
    u.uFill.value = 0.35 * pulse(t, LOCK + 0.05, 0.14);
    behind(waves, DEPTH, SIDE * k * EXT);
    waves.visible = settle < 1 || u.uFill.value > 0.01;
    /* готовый знак-логотип проявляется на месте волн */
    sMat.opacity = settle;
    sign.visible = settle > 0;
    behind(sign, DEPTH, SIDE * k);
    renderer.render(scene, camera);
  }
  function resize(W, Hh) {
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh;
    camera.position.z = W < Hh ? 14 : 8.6; // на узком экране дальше, чтобы знак поместился по ширине
    camera.updateProjectionMatrix();
  }
  /* прямоугольник логотипа на экране → центр знака на плоскости z=0 и масштаб под его размер */
  function targetFor(rect, W, Hh) {
    const vh = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360),
      vw = vh * camera.aspect;
    return {
      x: ((rect.left + rect.width / 2) / W - 0.5) * vw,
      y: (0.5 - (rect.top + rect.height / 2) / Hh) * vh,
      k: ((rect.height / Hh) * vh) / SIDE
    };
  }
  function dispose() {
    heart.dispose();
    lights.dispose();
    wMat.dispose();
    sMat.dispose();
    signTex.dispose();
    waves.geometry.dispose();
    sign.geometry.dispose();
    glow.material.dispose();
    glowTex.dispose();
    pm.dispose();
  }
  return { render, resize, targetFor, dispose, camera };
}

export async function runIntro() {
  let signTex;
  try {
    signTex = await loadSign(lowPower ? 1024 : 2048);
  } catch (e) {
    console.warn("Заставка: знак не загрузился", e);
    return;
  }
  return new Promise(done => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch (e) {}
    /* прозрачный слой поверх страницы (zone3d.css: pointer-events:none, кликается только «Пропустить») */
    const box = document.createElement("div");
    box.className = "zone-intro";
    box.innerHTML =
      '<canvas aria-hidden="true"></canvas><button type="button" class="zone-intro-skip">Пропустить</button>';
    document.body.appendChild(box);
    const canvas = box.querySelector("canvas");
    let renderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      console.warn("Заставка: нет WebGL", e);
      signTex.dispose();
      box.remove();
      return done();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    const intro = createIntroScene(renderer, signTex);
    const resize = () => intro.resize(window.innerWidth, window.innerHeight);
    resize();
    window.addEventListener("resize", resize);
    /* прилетаем ровно в логотип шапки: центр знака - в центр логотипа, сторона знака - его размер */
    const logoTarget = () => {
      const el = document.querySelector(".site-header .rad-logo");
      const r = el ? el.getBoundingClientRect() : { left: 20, top: 20, width: 52, height: 52 };
      return intro.targetFor(r, window.innerWidth, window.innerHeight);
    };

    let t0 = 0,
      skipped = false,
      raf = 0,
      target = null,
      logoHidden = false;
    const logo = document.querySelector(".site-header .rad-logo");
    const skip = () => {
      if (skipped) return;
      skipped = true;
      box.classList.add("out");
      setTimeout(finish, 350);
    };
    /* посетитель начал пользоваться страницей - не мешаем ему, заставка тихо исчезает */
    const onUse = () => skip();
    const USE = ["keydown", "pointerdown", "wheel", "touchstart"];
    box.querySelector(".zone-intro-skip").addEventListener("click", skip);
    USE.forEach(ev => window.addEventListener(ev, onUse, { passive: true }));

    function finish() {
      cancelAnimationFrame(raf);
      USE.forEach(ev => window.removeEventListener(ev, onUse));
      window.removeEventListener("resize", resize);
      intro.dispose();
      renderer.dispose();
      box.remove();
      if (logo) {
        logo.classList.remove("intro-wait");
        if (logoHidden) {
          logo.classList.add("intro-land");
          setTimeout(() => logo.classList.remove("intro-land"), 900);
        }
      }
      done();
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      /* отсчёт - с первого кадра: подготовка сцены на слабом телефоне может занять секунду, иначе заставка «проскочит» */
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      if (t > FLY[0] && !target) {
        target = logoTarget();
        box.classList.add("flying");
        /* пока сердце летит, логотип в шапке прячем - прилетевшее сердце встанет на его место */
        if (logo) {
          logo.classList.add("intro-wait");
          logoHidden = true;
        }
      }
      intro.render(Math.min(t, DURATION), target);
      if (t >= DURATION && !skipped) {
        skipped = true;
        finish();
      }
    }
    raf = requestAnimationFrame(frame);
  });
}
