/* Объёмное «Сердце Зоны» - артефакт в форме человеческого сердца: гранёный кристалл с силовыми прожилками.
   Общая модель: заставка (zone-intro.js) и картинки логотипа/иконок (previews/logo.html) рендерятся с неё
   с одним и тем же светом (createHeartLights), поэтому прилетевшее в шапку сердце совпадает с картинкой логотипа.
   Размер: тело ≈ 2 единицы в высоту; anchor - центр тела (по нему сердце встаёт ровно в центр знака) */
import {
  IcosahedronGeometry,
  CylinderGeometry,
  CircleGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  MeshPhysicalMaterial,
  MeshBasicMaterial,
  Mesh,
  Group,
  Vector3,
  Quaternion,
  Color,
  Box3,
  Float32BufferAttribute,
  DirectionalLight,
  PointLight,
  AdditiveBlending
} from "three";
import { mergeVertices, mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* картинка логотипа: высота сердца с отростками - доля стороны знака; центр тела - ровно в центре знака */
export const LOGO_HEART = { h: 0.56 };
/* сила свечения в логотипе (в заставке сердце приходит к ней в конце полёта) */
export const LOGO_BEAT = 0.45;

const g = (d, s) => Math.exp(-d / (s * s)); // мягкий «бугор»
/* детерминированный псевдослучайный ряд: у заставки и логотипа одинаковые грани и прожилки */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smin0 = y => 0.5 * (y - Math.sqrt(y * y + 0.06)) + 0.1225; // мягкое min(y, 0)

/* точка поверхности по направлению единичного вектора v: очертания человеческого сердца,
   основание и верхушка сшиты гладко */
function surface(v) {
  const yn = smin0(v.y),
    yp = v.y - yn;
  const k = 1 + yn * 0.52; // сужение к верхушке
  let x = v.x * 0.92 * k * (1 + yp * 0.1),
    z = v.z * 0.8 * k;
  const y = yn * 1.34 + yp * 0.86;
  x += yn * yn * 0.12; // верхушка смотрит чуть вправо-вниз
  const d2 = (a, b, c) => (x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2;
  const bump =
    0.19 * g(d2(-0.74, 0.36, 0.1), 0.45) +
    0.12 * g(d2(0.72, 0.52, 0.26), 0.3) +
    0.1 * g(d2(0, 0.62, -0.45), 0.5) +
    0.05 * g(d2(-0.3, 0.7, 0.3), 0.35);
  const n = 1 + bump;
  return new Vector3(x * n, y * n - 0.05, z * n);
}
const dirAB = (a, b) => new Vector3(Math.cos(b) * Math.sin(a), Math.cos(a), Math.sin(b) * Math.sin(a));

/* трубка с сужением: r(u) - радиус по длине */
function taperTube(points, r, seg, radial) {
  const c = new CatmullRomCurve3(points, false, "centripetal");
  const geo = new TubeGeometry(c, seg, 1, radial, false);
  const pos = geo.attributes.position,
    P = new Vector3(),
    v = new Vector3();
  for (let i = 0; i <= seg; i++) {
    c.getPointAt(i / seg, P);
    const k = r(i / seg);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(P).multiplyScalar(k).add(P);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  return geo;
}

/* силовые прожилки: плавные ветвящиеся линии от основания к верхушке, тонкие концы сходят на нет */
function energyVeins(rand, roots, lift) {
  const STEP = 0.04,
    core = [],
    halo = [];
  const grow = (a, b, h, len, r0, depth, aim) => {
    const n = Math.max(5, Math.round(len / STEP));
    const pts = [],
      rad = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push(surface(dirAB(a, b)).multiplyScalar(1 + lift));
      rad.push(r0 * (1 - 0.85 * u) + 0.0012);
      if (depth > 0 && i > 3 && i < n - 4 && rand() < 0.08) {
        const side = rand() < 0.5 ? -1 : 1;
        grow(
          a,
          b,
          h + side * (0.5 + rand() * 0.45),
          len * (1 - u) * (0.5 + rand() * 0.3),
          rad[i] * 0.75,
          depth - 1,
          aim + side * 0.25
        );
      }
      h += (rand() - 0.5) * 0.2 + (aim - h) * 0.08;
      a += Math.cos(h) * STEP;
      b += (Math.sin(h) * STEP) / Math.max(Math.sin(a), 0.25);
      if (a > 2.92) break;
    }
    if (pts.length < 5) return;
    const at = u => rad[Math.min(rad.length - 1, Math.round(u * (rad.length - 1)))] * Math.min(1, 0.2 + u * 8);
    const seg = pts.length * 3;
    core.push(taperTube(pts, at, seg, 6));
    halo.push(taperTube(pts, u => at(u) * 3.4, seg, 8));
  };
  roots.forEach(r => grow(...r));
  return { core: mergeGeometries(core), halo: mergeGeometries(halo), parts: core.concat(halo) };
}

export function createHeart({ detail = 6 } = {}) {
  const group = new Group();
  /* сердце чуть наклонено, как в анатомии: верхушка смотрит вправо-вниз */
  const tilt = new Group();
  tilt.rotation.z = 0.2;
  group.add(tilt);
  const rand = rng(1907);
  /* тело: кристалл с множеством граней - точки сетки чуть сдвинуты, каждая грань плоская и своего оттенка */
  let body = new IcosahedronGeometry(1, detail);
  body.deleteAttribute("normal");
  body.deleteAttribute("uv");
  body = mergeVertices(body);
  const p = body.attributes.position,
    v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const s = surface(v).multiplyScalar(1 + (rand() - 0.5) * 0.06);
    p.setXYZ(i, s.x, s.y, s.z);
  }
  body = body.toNonIndexed();
  const fp = body.attributes.position;
  const cols = new Float32Array(fp.count * 3);
  const deep = new Color(0x3a030a),
    ruby = new Color(0x9a0f22),
    hot = new Color(0xff3a26),
    c = new Color();
  for (let f = 0; f < fp.count; f += 3) {
    const y = (fp.getY(f) + fp.getY(f + 1) + fp.getY(f + 2)) / 3;
    const r = rand();
    c.copy(deep).lerp(ruby, Math.min(1, Math.max(0, 0.3 + r * 0.6 + y * 0.15)));
    if (rand() < 0.06) c.lerp(hot, 0.4); // редкие «горячие» грани - искры внутри кристалла
    for (let j = 0; j < 3; j++) cols.set([c.r, c.g, c.b], (f + j) * 3);
  }
  body.setAttribute("color", new Float32BufferAttribute(cols, 3));
  body.computeVertexNormals();
  const crystal = new MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    emissive: new Color(0xff2410),
    emissiveIntensity: 0.06,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    iridescence: 0.15,
    iridescenceIOR: 1.6,
    envMapIntensity: 0.7
  });
  const bodyMesh = new Mesh(body, crystal);
  tilt.add(bodyMesh);

  /* короткие гранёные отростки сосудов, срезанные у основания; в срезе тлеет ядро */
  const stubM = crystal.clone();
  stubM.vertexColors = false;
  stubM.color = new Color(0x8c1424);
  const coreM = new MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.9, toneMapped: false });
  const up = new Vector3(0, 1, 0);
  [
    [[0.06, 0.55, -0.06], [0.12, 1, -0.05], 0.21, 0.62],
    [[-0.2, 0.5, 0.22], [-0.5, 1, 0.25], 0.16, 0.55],
    [[-0.56, 0.42, -0.08], [-0.15, 1, -0.1], 0.12, 0.5],
    [[0.46, 0.48, -0.2], [0.45, 1, -0.2], 0.1, 0.44]
  ].forEach(([base, dir, r, len]) => {
    const d = new Vector3(...dir).normalize();
    const q = new Quaternion().setFromUnitVectors(up, d);
    const stub = new Mesh(new CylinderGeometry(r * 0.8, r, len, 6, 1), stubM);
    stub.position.set(...base).addScaledVector(d, len / 2);
    stub.quaternion.copy(q);
    tilt.add(stub);
    const cap = new Mesh(new CircleGeometry(r * 0.5, 6), coreM);
    cap.position.set(...base).addScaledVector(d, len + 0.003);
    cap.quaternion.copy(q).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
    tilt.add(cap);
  });

  /* силовые прожилки: горячая сердцевина и мягкое свечение вокруг */
  const veins = energyVeins(
    rand,
    [
      [0.92, 1.48, -0.1, 2.0, 0.024, 2, -0.08],
      [1.0, 1.15, -0.45, 1.5, 0.018, 1, -0.25],
      [1.0, 1.92, 0.45, 1.5, 0.018, 1, 0.25]
    ],
    0.03
  );
  const veinM = new MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const haloM = veinM.clone();
  haloM.color = new Color(0xff5a14);
  tilt.add(new Mesh(veins.halo, haloM), new Mesh(veins.core, veinM));
  group.updateMatrixWorld(true);
  const anchor = new Box3().setFromObject(bodyMesh).getCenter(new Vector3());
  veins.parts.forEach(x => x.dispose());

  const frame = new Box3().setFromObject(group);
  const height = frame.max.y - frame.min.y;
  const mats = [crystal, stubM, coreM, veinM, haloM];
  return {
    group,
    crystal,
    anchor,
    height,
    /* b - сила удара 0..1: кристалл разогревается изнутри, прожилки и ядра срезов вспыхивают */
    beat(b) {
      crystal.emissiveIntensity = stubM.emissiveIntensity = 0.06 + b * 0.3;
      veinM.opacity = 0.55 + b * 0.45;
      haloM.opacity = 0.1 + b * 0.26;
      coreM.opacity = 0.6 + b * 0.4;
    },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
      mats.forEach(m => m.dispose());
    }
  };
}

/* свет сердца: ключевой сверху-справа, тёплый контровой (отблеск знака радиации) сзади и снизу, блики спереди.
   place(center, rotation, s) ставит свет вокруг сердца масштаба s - освещение одинаково при любом размере и месте */
export function createHeartLights(scene) {
  const key = new DirectionalLight(0xfff1e6, 1.5);
  scene.add(key, key.target);
  const pts = [
    [0xff5a24, 18, [-1.4, 0.85, -1.7]],
    [0xff7a2a, 11, [1.85, -1.1, -0.3]],
    [0xffc4a0, 1.6, [-1.9, -0.4, 2.3]],
    [0xffe0d0, 2.4, [1.2, 1.6, 2.4]]
  ].map(([col, I, pos]) => {
    const l = new PointLight(col, 0, 0, 2);
    scene.add(l);
    return { l, I, pos: new Vector3(...pos) };
  });
  const KEY = new Vector3(2, 3, 4);
  return {
    place(center, rotation, s) {
      key.target.position.copy(center);
      key.position.copy(KEY).applyEuler(rotation).add(center);
      pts.forEach(({ l, I, pos }) => {
        l.position.copy(pos).multiplyScalar(s).applyEuler(rotation).add(center);
        l.intensity = I * s * s;
      });
    },
    dispose() {
      [key, key.target, ...pts.map(x => x.l)].forEach(o => o.removeFromParent());
    }
  };
}
