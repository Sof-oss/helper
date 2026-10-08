/* Объёмное «Сердце Зоны» - анатомическое сердце, слегка огранённое, как артефакт.
   Общая модель: заставка (zone-intro.js) и картинки логотипа/иконок рендерятся с неё, поэтому везде одно и то же сердце.
   Размер: тело ≈ 2 единицы в высоту, с сосудами ≈ 2,5; центр тела - в нуле */
import {
  IcosahedronGeometry,
  TubeGeometry,
  SphereGeometry,
  CatmullRomCurve3,
  MeshPhysicalMaterial,
  MeshBasicMaterial,
  Mesh,
  Group,
  Vector3,
  Color,
  AdditiveBlending
} from "three";

const g = (d, s) => Math.exp(-d / (s * s)); // мягкий «бугор»
/* точка поверхности сердца по направлению единичного вектора v */
function surface(v) {
  let x = v.x * 0.98,
    y = v.y,
    z = v.z * 0.82;
  if (y < 0) {
    const k = 1 + y * 0.5; // сужение к верхушке
    x *= k;
    z *= k;
    y *= 1.32;
    x += y * y * 0.22; // верхушка смотрит вправо-вниз
  } else {
    y *= 0.78;
    x *= 1 + y * 0.12;
  }
  const d2 = (a, b, c) => (x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2;
  const bump =
    0.2 * g(d2(-0.78, 0.32, 0.12), 0.45) + 0.12 * g(d2(0.74, 0.5, 0.28), 0.3) + 0.08 * g(d2(0, 0.55, -0.5), 0.5);
  /* межжелудочковая борозда спереди */
  const gx = x - (0.12 + (0.55 - y) * 0.2);
  const groove = z > 0 && y < 0.55 ? -0.05 * Math.exp(-(gx * gx) / 0.012) : 0;
  const n = 1 + bump + groove;
  return new Vector3(x * n, y * n - 0.05, z * n);
}

export function createHeart({ detail = 3, tube = 10, veins = true } = {}) {
  const group = new Group();
  const body = new IcosahedronGeometry(1, detail);
  const p = body.attributes.position,
    v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const s = surface(v);
    p.setXYZ(i, s.x, s.y, s.z);
  }
  body.computeVertexNormals();
  const flesh = new MeshPhysicalMaterial({
    color: 0x5c0a12,
    emissive: new Color(0xff2a14),
    emissiveIntensity: 0.05,
    roughness: 0.5,
    metalness: 0.05,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    sheen: 0.35,
    sheenColor: new Color(0xd04a40),
    flatShading: true
  });
  const vessel = flesh.clone();
  vessel.color = new Color(0x7a1a22);
  const vein = flesh.clone();
  vein.color = new Color(0x6e1420);
  vein.emissive = new Color(0x2a0810);
  vein.clearcoat = 0.2;
  vein.sheen = 0;
  vein.roughness = 0.75;
  vein.clearcoat = 0;
  group.add(new Mesh(body, flesh));

  const T = (pts, r, mat, seg = 28) => {
    const c = new CatmullRomCurve3(pts.map(a => new Vector3(...a)));
    const m = new Mesh(new TubeGeometry(c, seg, r, tube, false), mat);
    group.add(m);
    /* скруглённый торец */
    const cap = new Mesh(new SphereGeometry(r * 0.98, tube, 6), mat);
    cap.position.copy(c.getPoint(1));
    group.add(cap);
    return c;
  };
  /* дуга аорты с тремя ветвями */
  const arch = T(
    [
      [0.02, 0.35, -0.02],
      [0.02, 0.95, 0.02],
      [0.2, 1.3, -0.04],
      [0.58, 1.3, -0.16],
      [0.78, 0.98, -0.32],
      [0.8, 0.6, -0.46]
    ],
    0.21,
    vessel
  );
  [0.36, 0.47, 0.58].forEach((u, i) => {
    const a = arch.getPoint(u);
    T(
      [
        [a.x, a.y, a.z],
        [a.x - 0.05 + i * 0.05, a.y + 0.26, a.z],
        [a.x - 0.1 + i * 0.1, a.y + 0.42, a.z + 0.02]
      ],
      0.07 - i * 0.008,
      vessel,
      8
    );
  });
  /* лёгочный ствол - спереди, уходит влево вверх */
  T(
    [
      [0.18, 0.3, 0.32],
      [0.1, 0.78, 0.4],
      [-0.12, 1.02, 0.36],
      [-0.42, 1.08, 0.22]
    ],
    0.17,
    vessel
  );
  /* верхняя полая вена - слева */
  T(
    [
      [-0.62, 0.4, -0.06],
      [-0.6, 0.9, -0.12],
      [-0.58, 1.22, -0.16]
    ],
    0.135,
    vein,
    10
  );

  /* светящиеся «прожилки» артефакта на поверхности: пульсируют с ударами */
  let glowMat = null;
  if (veins) {
    glowMat = new MeshBasicMaterial({
      color: 0xffb04a,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const onSurf = (a, b) => {
      const d = new Vector3(
        Math.cos(b) * Math.sin(a),
        Math.cos(a),
        Math.cos(b) * 0 + Math.sin(b) * Math.sin(a)
      ).normalize();
      return surface(d).multiplyScalar(1.012);
    };
    const path = list => {
      const c = new CatmullRomCurve3(list.map(([a, b]) => onSurf(a, b)));
      group.add(new Mesh(new TubeGeometry(c, 40, 0.014, 5, false), glowMat));
    };
    /* (полярный угол от верха, азимут; азимут π/2 - к зрителю) */
    path([
      [1.2, 1.25],
      [1.6, 1.2],
      [2.0, 1.1],
      [2.4, 0.95],
      [2.75, 0.75]
    ]);
    path([
      [1.6, 1.2],
      [1.85, 1.6],
      [2.15, 1.9]
    ]);
    path([
      [1.3, 0.6],
      [1.7, 0.45],
      [2.1, 0.35]
    ]);
    path([
      [1.35, 2.3],
      [1.75, 2.45],
      [2.15, 2.4]
    ]);
  }
  return {
    group,
    flesh,
    glowMat,
    /* b - сила удара 0..1 */
    beat(b) {
      flesh.emissiveIntensity = vessel.emissiveIntensity = 0.05 + b * 0.3;
      if (glowMat) glowMat.opacity = 0.35 + b * 0.65;
    },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
      [flesh, vessel, vein, glowMat].forEach(m => m && m.dispose());
    }
  };
}
