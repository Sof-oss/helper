/* 3D-логотип при первом заходе: объёмный противогаз с фильтром-«радиацией» дважды делает вдох —
   очки вспыхивают, из фильтра выходит пар, вокруг трещат разряды аномалии. Через ~3,5 с маска улетает на место логотипа в шапке.
   Показывается один раз (метка zoneIntroSeen в браузере) прозрачным слоем поверх уже открытой страницы: содержимое видно
   и доступно сразу, слой не перехватывает клики. Пропустить — кнопка, любая клавиша, клик, касание или прокрутка */
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Shape,
  Path,
  ExtrudeGeometry,
  CylinderGeometry,
  TorusGeometry,
  MeshStandardMaterial,
  Mesh,
  Group,
  PMREMGenerator,
  DirectionalLight,
  PointLight,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  Color,
  Vector3,
  SRGBColorSpace,
  ACESFilmicToneMapping
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { readTheme, lowPower } from "./zone-theme.js";

const SEEN = "zoneIntroSeen";
const S = 1 / 26; // масштаб SVG-координат логотипа (64×64) в 3D
const P = (x, y) => [(x - 32) * S, (32.5 - y) * S]; // точка из SVG: центр в 0, ось Y вверх

/* контур маски противогаза — тот же путь, что в SVG-логотипе; глазницы вырезаны под очки */
const EYES = [
  [22.3, 24],
  [41.7, 24]
];
function maskShape() {
  const s = new Shape(),
    c = (a, b, d, e, f, g) => s.bezierCurveTo(...P(a, b), ...P(d, e), ...P(f, g));
  s.moveTo(...P(32, 3));
  c(19.8, 3, 11, 11.3, 11, 23.5);
  c(11, 30.9, 13.4, 35.9, 17.6, 39.8);
  s.lineTo(...P(22, 44));
  s.lineTo(...P(42, 44));
  s.lineTo(...P(46.4, 39.8));
  c(50.6, 35.9, 53, 30.9, 53, 23.5);
  c(53, 11.3, 44.2, 3, 32, 3);
  for (const [x, y] of EYES) {
    const h = new Path();
    h.absarc(...P(x, y), 7.6 * S, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}
const poly = pts => {
  const s = new Shape();
  s.moveTo(...P(...pts[0]));
  pts.slice(1).forEach(q => s.lineTo(...P(...q)));
  s.closePath();
  return s;
};
/* «рыло» под фильтр и ремни крепления (повёрнутые прямоугольники, как в SVG) */
const snoutShape = () =>
  poly([
    [22, 41.5],
    [42, 41.5],
    [39.4, 48],
    [24.6, 48]
  ]);
function strapShape(x, y, w, h, deg) {
  const cx = x + w / 2,
    cy = y + h / 2,
    a = (deg * Math.PI) / 180;
  return poly(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ].map(([px, py]) => {
      const dx = px - cx,
        dy = py - cy;
      return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
    })
  );
}
/* оправа очков — кольцо */
function rimShape(x, y) {
  const s = new Shape();
  s.absarc(...P(x, y), 7.6 * S, 0, Math.PI * 2, false);
  const h = new Path();
  h.absarc(...P(x, y), 4.9 * S, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}
/* знак радиации на крышке фильтра: три лопасти (кольцевые сектора) и центр */
function trefoilShapes() {
  const [cx, cy] = P(32, 52),
    r1 = 3.4 * S,
    r2 = 7.6 * S,
    out = [];
  for (const mid of [90, -30, 210]) {
    // верхняя, правая нижняя, левая нижняя
    const a1 = ((mid - 30) * Math.PI) / 180,
      a2 = ((mid + 30) * Math.PI) / 180;
    const s = new Shape();
    s.moveTo(cx + Math.cos(a1) * r2, cy + Math.sin(a1) * r2);
    s.absarc(cx, cy, r2, a1, a2, false);
    s.lineTo(cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1);
    s.absarc(cx, cy, r1, a2, a1, true);
    out.push(s);
  }
  const dot = new Shape();
  dot.absarc(cx, cy, 1.9 * S, 0, Math.PI * 2, false);
  out.push(dot);
  return out;
}
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"),
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.25, "rgba(255,255,255,.45)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
const easeOutBack = x => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const beat = t => {
  // двойной «вдох» маски, t — секунды от начала
  if (t < 0 || t > 0.7) return 0;
  return Math.exp(-Math.pow((t - 0.08) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow((t - 0.3) / 0.07, 2));
};

export function runIntro() {
  return new Promise(done => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch (e) {}
    const theme = readTheme();
    const ac = new Color().setRGB(...theme.accent, SRGBColorSpace),
      ac2 = new Color().setRGB(...theme.accent2, SRGBColorSpace);

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

    const scene = new Scene(),
      camera = new PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 0, 7);
    const pm = new PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new PointLight(ac, 18, 12);
    rim.position.set(-1.5, 1, -2.5);
    scene.add(rim);

    /* противогаз */
    const glowTex = glowTexture();
    const mask = new Group();
    const depth = 0.36,
      seg = lowPower ? 24 : 48;
    const ext = (sh, d, bt, bs, bseg = lowPower ? 3 : 6) => {
      const g = new ExtrudeGeometry(sh, {
        depth: d,
        bevelEnabled: true,
        bevelThickness: bt,
        bevelSize: bs,
        bevelSegments: bseg,
        curveSegments: seg
      });
      g.translate(0, 0, -d / 2);
      return g;
    };
    const hMat = new MeshStandardMaterial({
      color: new Color(ac).multiplyScalar(0.8),
      metalness: 0.6,
      roughness: 0.34,
      emissive: ac,
      emissiveIntensity: 0.18
    });
    const dMat = new MeshStandardMaterial({
      color: new Color(ac).multiplyScalar(0.1),
      metalness: 0.75,
      roughness: 0.38
    });
    const lMat = new MeshStandardMaterial({
      color: 0x0b0d10,
      metalness: 0.95,
      roughness: 0.06,
      emissive: ac2,
      emissiveIntensity: 0.05
    });
    mask.add(new Mesh(ext(maskShape(), depth, 0.16, 0.1), hMat));
    const snout = new Mesh(ext(snoutShape(), 0.3, 0.06, 0.05), hMat);
    snout.position.z = 0.2;
    mask.add(snout);
    for (const st of [strapShape(5, 17, 9, 5, -18), strapShape(50, 17, 9, 5, 18)])
      mask.add(new Mesh(ext(st, 0.14, 0.03, 0.03, 2), dMat));
    for (const [x, y] of EYES) {
      const rimM = new Mesh(ext(rimShape(x, y), 0.16, 0.04, 0.03, 3), dMat);
      rimM.position.z = depth / 2 + 0.1;
      mask.add(rimM);
      const lens = new Mesh(new CylinderGeometry(4.95 * S, 4.95 * S, 0.06, seg), lMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(...P(x, y), depth / 2 + 0.04);
      mask.add(lens);
    }
    /* фильтр: цилиндр с рёбрами, на крышке — знак радиации */
    const [fx, fy] = P(32, 52),
      fr = 10 * S,
      fl = 0.6,
      fz = depth / 2 + 0.22;
    const can = new Mesh(new CylinderGeometry(fr, fr * 0.96, fl, seg), hMat);
    can.rotation.x = Math.PI / 2;
    can.position.set(fx, fy, fz - fl / 2 + 0.12);
    mask.add(can);
    for (const z of [-0.18, 0, 0.18]) {
      const rib = new Mesh(new TorusGeometry(fr * 0.99, 0.028, 8, seg), dMat);
      rib.position.set(fx, fy, fz - fl / 2 + 0.12 + z);
      mask.add(rib);
    }
    const cap = new Mesh(new CylinderGeometry(fr * 0.86, fr * 0.86, 0.04, seg), dMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(fx, fy, fz + 0.13);
    mask.add(cap);
    const tMat = new MeshStandardMaterial({
      color: new Color(ac).multiplyScalar(0.85),
      metalness: 0.55,
      roughness: 0.35,
      emissive: ac2,
      emissiveIntensity: 0
    });
    const tre = new Mesh(
      new ExtrudeGeometry(trefoilShapes(), {
        depth: 0.03,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.01,
        bevelSegments: 2,
        curveSegments: 24
      }),
      tMat
    );
    tre.position.z = fz + 0.15;
    mask.add(tre);
    mask.position.y = 0;
    scene.add(mask);

    /* «выдох» из фильтра: клубы пара (цвет гаснет к чёрному — при сложении это и есть исчезновение) */
    const PN = lowPower ? 40 : 80,
      pp = new Float32Array(PN * 3),
      pv = new Float32Array(PN * 3),
      pc = new Float32Array(PN * 3),
      plife = new Float32Array(PN).fill(-1),
      pmax = new Float32Array(PN).fill(1);
    const pGeo = new BufferGeometry();
    pGeo.setAttribute("position", new Float32BufferAttribute(pp, 3));
    pGeo.setAttribute("color", new Float32BufferAttribute(pc, 3));
    const puffMat = new PointsMaterial({
      map: glowTex,
      size: 0.55,
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const puffs = new Points(pGeo, puffMat);
    puffs.frustumCulled = false;
    mask.add(puffs);
    function breathe(n) {
      for (let i = 0, e = 0; i < PN && e < n; i++)
        if (plife[i] <= 0) {
          const a = Math.random() * Math.PI * 2,
            r = Math.random() * fr * 0.6;
          pp.set([fx + Math.cos(a) * r, fy + Math.sin(a) * r, fz + 0.16], i * 3);
          pv.set([(Math.random() - 0.5) * 1.1, -0.25 - Math.random() * 0.6, 0.9 + Math.random() * 1.2], i * 3);
          plife[i] = pmax[i] = 0.7 + Math.random() * 0.6;
          e++;
        }
    }
    /* свечение за маской */
    const glowMat = new SpriteMaterial({
      map: glowTex,
      color: ac,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0
    });
    const glow = new Sprite(glowMat);
    glow.position.set(0, 0.5, -0.6);
    glow.scale.setScalar(4.5);
    scene.add(glow);

    /* разряды аномалии: ломаные линии, перерисовываются каждые ~70 мс */
    const ARCS = lowPower ? 4 : 7,
      SEG = 10;
    const arcs = Array.from({ length: ARCS }, () => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
      const l = new Line(
        g,
        new LineBasicMaterial({
          color: new Color(ac2).multiplyScalar(1.6),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false
        })
      );
      l.position.y = 0.5;
      scene.add(l);
      return l;
    });
    function zapArc(l, power) {
      const a = Math.random() * Math.PI * 2,
        r0 = 1.05 + Math.random() * 0.2,
        r1 = 1.6 + Math.random() * 0.8;
      const p0 = new Vector3(Math.cos(a) * r0, Math.sin(a) * r0 * 0.9, (Math.random() - 0.5) * 0.6);
      const a2 = a + (Math.random() - 0.5) * 0.9;
      const p1 = new Vector3(Math.cos(a2) * r1, Math.sin(a2) * r1 * 0.9, (Math.random() - 0.5) * 1.2);
      const arr = l.geometry.attributes.position.array;
      for (let i = 0; i <= SEG; i++) {
        const k = i / SEG,
          j = Math.sin(k * Math.PI) * 0.22;
        arr[i * 3] = p0.x + (p1.x - p0.x) * k + (Math.random() - 0.5) * j;
        arr[i * 3 + 1] = p0.y + (p1.y - p0.y) * k + (Math.random() - 0.5) * j;
        arr[i * 3 + 2] = p0.z + (p1.z - p0.z) * k + (Math.random() - 0.5) * j;
      }
      l.geometry.attributes.position.needsUpdate = true;
      l.material.opacity = Math.random() < 0.55 * power ? 0.5 + Math.random() * 0.5 : 0;
    }

    /* искры: вылетают из-за контура маски и гаснут */
    const SN = lowPower ? 90 : 180,
      sp = new Float32Array(SN * 3),
      sv = new Float32Array(SN * 3),
      life = new Float32Array(SN).fill(-1);
    const sGeo = new BufferGeometry();
    sGeo.setAttribute("position", new Float32BufferAttribute(sp, 3));
    const sMat = new PointsMaterial({
      color: ac2,
      size: 0.045,
      map: glowMat.map,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.95
    });
    const sparks = new Points(sGeo, sMat);
    sparks.frustumCulled = false;
    sparks.position.y = 0.5;
    scene.add(sparks);
    function emit(n) {
      for (let i = 0, e = 0; i < SN && e < n; i++)
        if (life[i] <= 0) {
          const a = Math.random() * Math.PI * 2,
            r = 0.9 + Math.random() * 0.3;
          sp.set([Math.cos(a) * r, Math.sin(a) * r * 0.9, (Math.random() - 0.5) * 0.5], i * 3);
          const v = 1.2 + Math.random() * 2.2;
          sv.set([Math.cos(a) * v, Math.sin(a) * v * 0.9, (Math.random() - 0.5) * 1.5], i * 3);
          life[i] = 0.5 + Math.random() * 0.6;
          e++;
        }
    }

    /* куда улетать: центр логотипа в шапке → точка в 3D на плоскости z=0 */
    function logoTarget() {
      const el = document.querySelector(".site-header .rad-logo");
      const r = el ? el.getBoundingClientRect() : { left: 20, top: 20, width: 40, height: 40 };
      const W = window.innerWidth,
        H = window.innerHeight;
      const vh = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360),
        vw = vh * camera.aspect;
      return {
        x: ((r.left + r.width / 2) / W - 0.5) * vw,
        y: (0.5 - (r.top + r.height / 2) / H) * vh,
        s: ((r.height / H) * vh) / 2.3 // маска с фильтром ≈ 2,3 единицы в высоту
      };
    }
    function resize() {
      const W = window.innerWidth,
        H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.position.z = W < H ? 10.5 : 8.6; // на узком экране чуть дальше
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    /* хронология, с */
    const BEATS = [1.0, 2.15],
      FLY = 3.0,
      END = 3.8;
    let t0 = 0,
      last = 0,
      zap = 0,
      skipped = false,
      raf = 0,
      fly = null;
    const skip = () => {
      if (skipped) return;
      skipped = true;
      box.classList.add("out");
      setTimeout(finish, 350);
    };
    /* посетитель начал пользоваться страницей — не мешаем ему, заставка тихо исчезает */
    const onUse = () => skip();
    const USE = ["keydown", "pointerdown", "wheel", "touchstart"];
    box.querySelector(".zone-intro-skip").addEventListener("click", skip);
    USE.forEach(ev => window.addEventListener(ev, onUse, { passive: true }));

    function finish() {
      cancelAnimationFrame(raf);
      USE.forEach(ev => window.removeEventListener(ev, onUse));
      window.removeEventListener("resize", resize);
      renderer.dispose();
      pm.dispose();
      box.remove();
      const logo = document.querySelector(".site-header .rad-logo");
      if (logo) {
        logo.classList.add("intro-land");
        setTimeout(() => logo.classList.remove("intro-land"), 900);
      }
      done();
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      /* отсчёт — с первого кадра: подготовка сцены на слабом телефоне может занять секунду, иначе заставка «проскочит» */
      if (!t0) {
        t0 = last = now;
      }
      const t = (now - t0) / 1000,
        dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const b = BEATS.reduce((m, s) => Math.max(m, beat(t - s)), 0);
      const appear = Math.min(1, t / 0.75);
      let scale = 0.88 * (0.15 + 0.85 * easeOutBack(appear)) * (1 + b * 0.12);
      mask.rotation.y = -1.4 * (1 - easeInOut(appear)) + Math.sin(t * 1.15) * 0.5;
      mask.rotation.x = Math.sin(t * 0.8) * 0.12;
      mask.position.set(0, 0.5 + Math.sin(t * 1.6) * 0.04, 0);
      hMat.emissiveIntensity = 0.14 + b * 0.55;
      lMat.emissiveIntensity = 0.05 + b * 1.3; // очки вспыхивают на «вдохе»
      tMat.emissiveIntensity = b * 0.9;
      glowMat.opacity = Math.min(1, appear * 1.2) * (0.45 + b * 0.55);
      glow.scale.setScalar(4.2 + b * 1.2);
      rim.intensity = 14 + b * 30;

      /* разряды и искры: сильнее на «вдохах» */
      const power = Math.min(1, appear) * (0.35 + b);
      if ((zap -= dt) <= 0) {
        zap = 0.07;
        arcs.forEach(l => zapArc(l, power));
      }
      emit(Math.round(power * (lowPower ? 3 : 6)) + (b > 0.9 ? 25 : 0));
      for (let i = 0; i < SN; i++) {
        if (life[i] > 0) {
          life[i] -= dt;
          sv[i * 3 + 1] -= 1.6 * dt;
          for (let k = 0; k < 3; k++) sp[i * 3 + k] += sv[i * 3 + k] * dt;
          if (life[i] <= 0) sp.set([0, 0, -99], i * 3);
        }
      }
      sGeo.attributes.position.needsUpdate = true;
      BEATS.forEach(s0 => {
        if (t - s0 > 0.28 && t - s0 - dt <= 0.28) breathe(lowPower ? 22 : 45);
      });
      for (let i = 0; i < PN; i++) {
        if (plife[i] > 0) {
          plife[i] -= dt;
          for (let k = 0; k < 3; k++) {
            pp[i * 3 + k] += pv[i * 3 + k] * dt;
            pv[i * 3 + k] *= 1 - 1.6 * dt;
          }
          const f = Math.max(0, plife[i] / pmax[i]) * 0.32;
          pc.set([f * 0.9, f * 0.95, f], i * 3);
          if (plife[i] <= 0) {
            pc.set([0, 0, 0], i * 3);
            pp.set([0, 0, -99], i * 3);
          }
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      /* полёт на место логотипа */
      if (t > FLY && !skipped) {
        if (!fly) {
          fly = logoTarget();
          box.classList.add("flying");
        }
        const k = easeInOut(Math.min(1, (t - FLY) / (END - FLY)));
        mask.position.set(fly.x * k, 0.5 * (1 - k) + fly.y * k, 0);
        mask.rotation.y *= 1 - k;
        mask.rotation.x *= 1 - k;
        scale = scale * (1 - k) + fly.s * k;
        glowMat.opacity *= 1 - k;
        arcs.forEach(l => {
          l.material.opacity *= 1 - k;
        });
        sMat.opacity = 0.95 * (1 - k);
        if (k >= 1) {
          skipped = true;
          box.classList.add("out");
          setTimeout(finish, 250);
        }
      }
      mask.scale.setScalar(scale);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  });
}
