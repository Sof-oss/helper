/* Заставка при первом заходе: «Сердце Зоны». Объёмное анатомическое сердце-артефакт бьётся («тук-тук» ×2),
   каждый удар выпускает волну, волны складываются в знак радиации вокруг сердца. Знак вспыхивает и втягивается
   в сердце, а оно улетает в левый верхний угол и остаётся там логотипом (картинка логотипа - рендер той же модели).
   Показывается один раз (метка zoneIntroSeen в браузере) прозрачным слоем поверх уже открытой страницы: содержимое видно
   и доступно сразу, слой не перехватывает клики. Пропустить - кнопка, любая клавиша, клик, касание или прокрутка */
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  PMREMGenerator,
  DirectionalLight,
  PointLight,
  PlaneGeometry,
  ShaderMaterial,
  Box3,
  Vector3,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  Mesh,
  AdditiveBlending,
  SRGBColorSpace,
  ACESFilmicToneMapping
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createHeart } from "./zone-heart.js";
import { lowPower } from "./zone-theme.js";

const SEEN = "zoneIntroSeen";
const clamp = x => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = x => 1 - (1 - x) ** 3;
const easeIn = x => x * x * x;
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOutBack = x => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const pulse = (t, at, w = 0.075) => Math.exp(-(((t - at) / w) ** 2));

/* хронология, с */
const BEATS = [0.85, 1.07, 1.75, 1.97]; // два «тук-тук»; каждый удар - волна
const LOCK = 2.6; // третий, сильный удар: знак радиации вспыхивает целиком
const COLLAPSE = [3.0, 3.35]; // знак втягивается в сердце
const FLY = [3.3, 4.15]; // полёт в логотип
export const DURATION = 4.2;

/* радиусы знака (в единицах сцены): сердце - центр знака, лопасти - из дуг-волн */
const R0 = 1.18,
  R1 = 2.3;
const RINGS = BEATS.map((_, i) => R0 + ((R1 - R0) * i) / (BEATS.length - 1));

/* волны и знак радиации - один шейдер на плоскости за сердцем */
function waveMaterial() {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uR: { value: new Array(8).fill(0) },
      uA: { value: new Array(8).fill(0) },
      uM: { value: new Array(8).fill(0) },
      uFill: { value: 0 },
      uScale: { value: 1 },
      uRot: { value: 0 }
    },
    vertexShader:
      "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `
      varying vec2 vP;
      uniform float uR[8], uA[8], uM[8], uFill, uScale, uRot;
      const float PI = 3.14159265;
      void main(){
        vec2 p = vP / max(uScale, 1e-3);
        float r = length(p);
        float a = atan(p.y, p.x) - uRot;
        /* лопасти по 60° с центрами на 30°, 150° и 270° - как у знака радиации */
        float d = abs(mod(a - PI / 6. + PI / 3., 2. * PI / 3.) - PI / 3.);
        float blade = 1. - smoothstep(PI / 6. - .025, PI / 6. + .025, d);
        float I = 0.;
        for (int i = 0; i < 8; i++) {
          float w = .07 + .05 * (1. - uM[i]);
          float band = exp(-pow((r - uR[i]) / w, 2.));
          I += uA[i] * band * mix(1., blade, uM[i]);
        }
        float inside = smoothstep(${(R0 - 0.12).toFixed(3)}, ${(R0 - 0.06).toFixed(3)}, r) * (1. - smoothstep(${(R1 + 0.06).toFixed(3)}, ${(R1 + 0.12).toFixed(3)}, r));
        I += uFill * blade * inside * (.55 + .45 * smoothstep(${R0.toFixed(3)}, ${R1.toFixed(3)}, r));
        vec3 col = mix(vec3(1., .42, .12), vec3(1., .82, .45), clamp(I - .4, 0., 1.));
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

/* Сцена заставки. render(t, target) рисует кадр в момент t (с); target - куда и каким размером прилететь
   {x, y, s} в единицах сцены. Детерминирована по t - удобно проверять по кадрам */
export function createIntroScene(renderer) {
  const scene = new Scene(),
    camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 8.6);
  const pm = new PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const key = new DirectionalLight(0xffffff, 1.3);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new PointLight(0xff6040, 16, 12);
  rim.position.set(-1.6, 1, -2.4);
  scene.add(rim);
  const core = new PointLight(0xff5030, 0, 6);
  core.position.set(0.4, 0, 2);
  scene.add(core);

  const heart = createHeart({ detail: lowPower ? 3 : 4, tube: lowPower ? 8 : 10 });
  const H = 0.72; // масштаб сердца в заставке
  /* рамка сердца при масштабе 1 - по ней картинка логотипа кадрируется так же (высота с сосудами + 4 %) */
  const frame = new Box3().setFromObject(heart.group);
  const fc = frame.getCenter(new Vector3()),
    fh = (frame.max.y - frame.min.y) * 1.04;
  scene.add(heart.group);

  const glowTex = glowTexture();
  const glow = new Sprite(
    new SpriteMaterial({ map: glowTex, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 })
  );
  glow.position.z = -0.8;
  scene.add(glow);

  const wMat = waveMaterial();
  const waves = new Mesh(new PlaneGeometry(7.2, 7.2), wMat);
  waves.position.z = -0.6;
  scene.add(waves);
  /* свободные волны-«ударные» от каждого удара уходят дальше и гаснут */
  const FREE = BEATS.length;

  function render(t, target) {
    const appear = seg(t, 0, 0.7);
    let b = 0;
    BEATS.forEach((s, i) => (b = Math.max(b, pulse(t, s) * (i % 2 ? 0.75 : 1))));
    b = Math.max(b, pulse(t, LOCK, 0.09) * 1.15);
    const col = easeIn(seg(t, COLLAPSE[0], COLLAPSE[1]));
    const fly = easeInOut(seg(t, FLY[0], FLY[1]));

    /* сердце */
    const sway = 1 - fly;
    heart.group.rotation.set(
      0.1 * Math.sin(t * 0.9) * sway,
      (-1.3 * (1 - easeInOut(appear)) + 0.32 * Math.sin(t * 1.25)) * sway,
      0.04 * Math.sin(t * 1.6) * sway
    );
    const tgt = target || { x: 0, y: 0, s: H };
    let s = H * (0.2 + 0.8 * easeOutBack(appear)) * (1 + 0.13 * b + 0.12 * col * (1 - fly));
    s = s * (1 - fly) + tgt.s * fly;
    heart.group.scale.set(s * (1 - 0.04 * b), s * (1 + 0.05 * b), s);
    heart.group.position.set(tgt.x * fly, 0.1 * (1 - fly) + tgt.y * fly, 0);
    heart.beat(Math.min(1, b + col * 0.8 * (1 - fly)) * (1 - fly) + 0.25 * fly);
    scene.environmentIntensity = 0.45 + 0.3 * fly;
    key.intensity = 1.3 + 0.9 * fly;
    core.intensity = (b * 9 + col * 6) * (1 - fly);
    rim.intensity = 12 + 14 * b;

    glow.position.x = heart.group.position.x;
    glow.position.y = heart.group.position.y;
    glow.scale.setScalar((2.6 + 1.4 * b) * (s / H));
    glow.material.opacity = clamp(appear * 1.4) * (0.35 + 0.5 * b) * (1 - fly * 0.85);

    /* волны: каждая выходит из сердца кругом, по пути сужается до трёх лопастей и встаёт на своё место в знаке */
    const u = wMat.uniforms;
    BEATS.forEach((te, i) => {
      const k = seg(t, te, te + 0.55);
      u.uR.value[i] = 0.45 + (RINGS[i] - 0.45) * easeOut(k);
      u.uM.value[i] = easeInOut(seg(k, 0.25, 1));
      u.uA.value[i] = t < te ? 0 : 0.62 + 0.6 * (1 - k) + 0.35 * pulse(t, LOCK, 0.12);
      const f = seg(t, te, te + 1.1);
      u.uR.value[FREE + i] = 0.5 + 3.4 * easeOut(f);
      u.uM.value[FREE + i] = 0;
      u.uA.value[FREE + i] = t < te || f >= 1 ? 0 : 0.32 * (1 - f) * (i % 2 ? 0.7 : 1);
    });
    u.uFill.value = 0.55 * pulse(t, LOCK + 0.05, 0.16) + 0.12 * seg(t, LOCK, LOCK + 0.2);
    u.uScale.value = 1 - col;
    u.uRot.value = -0.6 * col;
    waves.visible = col < 1;
    renderer.render(scene, camera);
  }
  function resize(W, Hh) {
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh;
    camera.position.z = W < Hh ? 13 : 8.6; // на узком экране дальше, чтобы знак поместился по ширине
    camera.updateProjectionMatrix();
  }
  /* центр элемента на экране → точка сцены на плоскости z=0 и масштаб сердца под его высоту */
  function targetFor(rect, W, Hh) {
    const vh = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360),
      vw = vh * camera.aspect;
    const s = ((rect.height / Hh) * vh) / fh;
    return {
      x: ((rect.left + rect.width / 2) / W - 0.5) * vw - fc.x * s,
      y: (0.5 - (rect.top + rect.height / 2) / Hh) * vh - fc.y * s,
      s
    };
  }
  function dispose() {
    heart.dispose();
    wMat.dispose();
    waves.geometry.dispose();
    glow.material.dispose();
    glowTex.dispose();
    pm.dispose();
  }
  return { render, resize, targetFor, dispose, camera };
}

export function runIntro() {
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
      box.remove();
      return done();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    const intro = createIntroScene(renderer);
    const resize = () => intro.resize(window.innerWidth, window.innerHeight);
    resize();
    window.addEventListener("resize", resize);
    const logoTarget = () => {
      const el = document.querySelector(".site-header .rad-logo");
      const r = el ? el.getBoundingClientRect() : { left: 20, top: 20, width: 40, height: 40 };
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
