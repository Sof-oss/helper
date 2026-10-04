/* 3D-логотип при первом заходе: объёмное сердце со знаком радиации бьётся, светится и покачивается,
   вокруг трещат разряды аномалии. Через ~3,5 с сердце улетает на место логотипа в шапке.
   Показывается один раз (метка zoneIntroSeen в браузере). Пропустить — кнопка, клик, Esc или любая клавиша */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Shape, Path, ExtrudeGeometry, MeshStandardMaterial, Mesh, Group,
  PMREMGenerator, DirectionalLight, PointLight, SpriteMaterial, Sprite, CanvasTexture, AdditiveBlending,
  BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Points, PointsMaterial, Color, Vector3,
  SRGBColorSpace, ACESFilmicToneMapping
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { readTheme, lowPower } from "./zone-theme.js";

const SEEN = "zoneIntroSeen";
const S = 1 / 26;                                     // масштаб SVG-координат логотипа (64×64) в 3D
const P = (x, y) => [(x - 32) * S, (32.5 - y) * S];   // точка из SVG: центр в 0, ось Y вверх

/* контур сердца — тот же путь, что в SVG-логотипе */
function heartShape() {
  const s = new Shape(), c = (a, b, d, e, f, g) => s.bezierCurveTo(...P(a, b), ...P(d, e), ...P(f, g));
  s.moveTo(...P(32, 58));
  c(13.5, 45.5, 4, 35.6, 4, 23.6);
  c(4, 14, 11.2, 7, 20, 7);
  c(25.3, 7, 29.6, 9.7, 32, 13.8);
  c(34.4, 9.7, 38.7, 7, 44, 7);
  c(52.8, 7, 60, 14, 60, 23.6);
  c(60, 35.6, 50.5, 45.5, 32, 58);
  return s;
}
/* знак радиации: три лопасти (кольцевые сектора) и центр, как в логотипе */
function trefoilShapes() {
  const [cx, cy] = P(32, 28.5), r1 = 6.2 * S, r2 = 15.5 * S, out = [];
  for (const mid of [90, -30, 210]) {                 // верхняя, правая нижняя, левая нижняя
    const a1 = (mid - 30) * Math.PI / 180, a2 = (mid + 30) * Math.PI / 180;
    const s = new Shape();
    s.moveTo(cx + Math.cos(a1) * r2, cy + Math.sin(a1) * r2);
    s.absarc(cx, cy, r2, a1, a2, false);
    s.lineTo(cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1);
    s.absarc(cx, cy, r1, a2, a1, true);
    out.push(s);
  }
  const dot = new Shape(); dot.absarc(cx, cy, 3.6 * S, 0, Math.PI * 2, false); out.push(dot);
  return out;
}
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
const easeOutBack = x => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const beat = t => {                                    // двойной удар сердца, t — секунды от начала удара
  if (t < 0 || t > .7) return 0;
  return Math.exp(-Math.pow((t - .08) / .06, 2)) + .6 * Math.exp(-Math.pow((t - .3) / .07, 2));
};

export function shouldShowIntro() {
  const root = document.documentElement;
  return root.classList.contains("intro-pending") && !window.__introSkip;
}

export function runIntro() {
  return new Promise(done => {
    const root = document.documentElement;
    try { localStorage.setItem(SEEN, "1"); } catch (e) {}
    const theme = readTheme();
    const ac = new Color().setRGB(...theme.accent, SRGBColorSpace), ac2 = new Color().setRGB(...theme.accent2, SRGBColorSpace);

    /* оверлей поверх страницы */
    const box = document.createElement("div");
    box.className = "zone-intro";
    box.innerHTML = '<canvas aria-hidden="true"></canvas><div class="zone-intro-title"><b>Сердце Зоны</b><span>Онлайн-помощник Зоны</span></div><button type="button" class="zone-intro-skip">Пропустить</button>';
    document.body.appendChild(box);
    const canvas = box.querySelector("canvas");
    let renderer;
    try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch (e) { console.warn("Заставка: нет WebGL", e); box.remove(); root.classList.remove("intro-pending"); return done(); }
    root.classList.remove("intro-pending");          // теперь страницу закрывает сам оверлей
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene(), camera = new PerspectiveCamera(35, 1, .1, 50);
    camera.position.set(0, 0, 7);
    const pm = new PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    scene.environmentIntensity = .55;
    const key = new DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, 4); scene.add(key);
    const rim = new PointLight(ac, 18, 12); rim.position.set(-1.5, 1, -2.5); scene.add(rim);

    /* сердце */
    const heart = new Group();
    const depth = .32, bevel = { bevelEnabled: true, bevelThickness: .09, bevelSize: .07, bevelSegments: lowPower ? 3 : 6, curveSegments: lowPower ? 24 : 48 };
    const hGeo = new ExtrudeGeometry(heartShape(), { depth, ...bevel }); hGeo.translate(0, 0, -depth / 2);
    const hMat = new MeshStandardMaterial({ color: new Color(ac).multiplyScalar(.8), metalness: .6, roughness: .32, emissive: ac, emissiveIntensity: .18 });
    heart.add(new Mesh(hGeo, hMat));
    const tMat = new MeshStandardMaterial({ color: new Color(ac).multiplyScalar(.12), metalness: .35, roughness: .5, emissive: ac2, emissiveIntensity: 0 });
    const tGeo = new ExtrudeGeometry(trefoilShapes(), { depth: .05, bevelEnabled: true, bevelThickness: .02, bevelSize: .015, bevelSegments: 2, curveSegments: 24 });
    const front = new Mesh(tGeo, tMat); front.position.z = depth / 2 + .08; heart.add(front);
    const back = new Mesh(tGeo, tMat); back.rotation.y = Math.PI; back.position.z = -depth / 2 - .08; heart.add(back);
    scene.add(heart);

    /* свечение за сердцем */
    const glowMat = new SpriteMaterial({ map: glowTexture(), color: ac, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
    const glow = new Sprite(glowMat); glow.position.z = -.6; glow.scale.setScalar(4.5); scene.add(glow);

    /* разряды аномалии: ломаные линии, перерисовываются каждые ~70 мс */
    const ARCS = lowPower ? 4 : 7, SEG = 10;
    const arcs = Array.from({ length: ARCS }, () => {
      const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
      const l = new Line(g, new LineBasicMaterial({ color: new Color(ac2).multiplyScalar(1.6), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      scene.add(l); return l;
    });
    function zapArc(l, power) {
      const a = Math.random() * Math.PI * 2, r0 = 1.05 + Math.random() * .2, r1 = 1.6 + Math.random() * .8;
      const p0 = new Vector3(Math.cos(a) * r0, Math.sin(a) * r0 * .9, (Math.random() - .5) * .6);
      const a2 = a + (Math.random() - .5) * .9;
      const p1 = new Vector3(Math.cos(a2) * r1, Math.sin(a2) * r1 * .9, (Math.random() - .5) * 1.2);
      const arr = l.geometry.attributes.position.array;
      for (let i = 0; i <= SEG; i++) {
        const k = i / SEG, j = Math.sin(k * Math.PI) * .22;
        arr[i * 3] = p0.x + (p1.x - p0.x) * k + (Math.random() - .5) * j;
        arr[i * 3 + 1] = p0.y + (p1.y - p0.y) * k + (Math.random() - .5) * j;
        arr[i * 3 + 2] = p0.z + (p1.z - p0.z) * k + (Math.random() - .5) * j;
      }
      l.geometry.attributes.position.needsUpdate = true;
      l.material.opacity = Math.random() < .55 * power ? .5 + Math.random() * .5 : 0;
    }

    /* искры: вылетают из-за контура сердца и гаснут */
    const SN = lowPower ? 90 : 180, sp = new Float32Array(SN * 3), sv = new Float32Array(SN * 3), life = new Float32Array(SN).fill(-1);
    const sGeo = new BufferGeometry(); sGeo.setAttribute("position", new Float32BufferAttribute(sp, 3));
    const sMat = new PointsMaterial({ color: ac2, size: .045, map: glowMat.map, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: .95 });
    const sparks = new Points(sGeo, sMat); sparks.frustumCulled = false; scene.add(sparks);
    function emit(n) {
      for (let i = 0, e = 0; i < SN && e < n; i++) if (life[i] <= 0) {
        const a = Math.random() * Math.PI * 2, r = .9 + Math.random() * .3;
        sp.set([Math.cos(a) * r, Math.sin(a) * r * .9, (Math.random() - .5) * .5], i * 3);
        const v = 1.2 + Math.random() * 2.2;
        sv.set([Math.cos(a) * v, Math.sin(a) * v * .9, (Math.random() - .5) * 1.5], i * 3);
        life[i] = .5 + Math.random() * .6; e++;
      }
    }

    /* куда улетать: центр логотипа в шапке → точка в 3D на плоскости z=0 */
    function logoTarget() {
      const el = document.querySelector(".site-header .rad-logo");
      const r = el ? el.getBoundingClientRect() : { left: 20, top: 20, width: 40, height: 40 };
      const W = window.innerWidth, H = window.innerHeight;
      const vh = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360), vw = vh * camera.aspect;
      return {
        x: ((r.left + r.width / 2) / W - .5) * vw,
        y: (.5 - (r.top + r.height / 2) / H) * vh,
        s: (r.height / H) * vh / 2.0                    // сердце ≈ 2 единицы в высоту
      };
    }
    function resize() {
      const W = window.innerWidth, H = window.innerHeight;
      renderer.setSize(W, H, false); camera.aspect = W / H;
      camera.position.z = W < H ? 10.5 : 8.6;              // на узком экране чуть дальше
      camera.updateProjectionMatrix();
    }
    resize(); window.addEventListener("resize", resize);

    /* хронология, с */
    const BEATS = [1.0, 2.15], FLY = 3.0, END = 3.8;
    let t0 = performance.now(), last = t0, zap = 0, skipped = false, raf = 0, fly = null;
    const skip = () => { if (skipped) return; skipped = true; box.classList.add("out"); setTimeout(finish, 350); };
    const onKey = () => skip();
    box.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);

    function finish() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey); window.removeEventListener("resize", resize);
      renderer.dispose(); pm.dispose(); box.remove();
      const logo = document.querySelector(".site-header .rad-logo");
      if (logo) { logo.classList.add("intro-land"); setTimeout(() => logo.classList.remove("intro-land"), 900); }
      done();
    }
    function frame() {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
      const b = BEATS.reduce((m, s) => Math.max(m, beat(t - s)), 0);
      const appear = Math.min(1, t / .75);
      let scale = (.15 + .85 * easeOutBack(appear)) * (1 + b * .12);
      heart.rotation.y = -1.4 * (1 - easeInOut(appear)) + Math.sin(t * 1.15) * .5;
      heart.rotation.x = Math.sin(t * .8) * .12;
      heart.position.set(0, .25 + Math.sin(t * 1.6) * .04, 0);
      hMat.emissiveIntensity = .18 + b * .8;
      tMat.emissiveIntensity = b * .35;
      glowMat.opacity = Math.min(1, appear * 1.2) * (.45 + b * .55);
      glow.scale.setScalar(4.2 + b * 1.2);
      rim.intensity = 14 + b * 30;

      /* разряды и искры: сильнее на ударах */
      const power = Math.min(1, appear) * (.35 + b);
      if ((zap -= dt) <= 0) { zap = .07; arcs.forEach(l => zapArc(l, power)); }
      emit(Math.round(power * (lowPower ? 3 : 6)) + (b > .9 ? 25 : 0));
      for (let i = 0; i < SN; i++) {
        if (life[i] > 0) {
          life[i] -= dt;
          sv[i * 3 + 1] -= 1.6 * dt;
          for (let k = 0; k < 3; k++) sp[i * 3 + k] += sv[i * 3 + k] * dt;
          if (life[i] <= 0) sp.set([0, 0, -99], i * 3);
        }
      }
      sGeo.attributes.position.needsUpdate = true;

      /* полёт на место логотипа */
      if (t > FLY && !skipped) {
        if (!fly) { fly = logoTarget(); box.classList.add("flying"); }
        const k = easeInOut(Math.min(1, (t - FLY) / (END - FLY)));
        heart.position.set(fly.x * k, .25 * (1 - k) + fly.y * k, 0);
        heart.rotation.y *= 1 - k; heart.rotation.x *= 1 - k;
        scale = scale * (1 - k) + fly.s * k;
        glowMat.opacity *= 1 - k; arcs.forEach(l => { l.material.opacity *= 1 - k; });
        sMat.opacity = .95 * (1 - k);
        if (k >= 1) { skipped = true; box.classList.add("out"); setTimeout(finish, 250); }
      }
      heart.scale.setScalar(scale);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(frame);
  });
}
