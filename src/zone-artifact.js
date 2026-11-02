/* Сердце логотипа - артефакт «Огненный шар»: сгусток плазмы в форме сердца с тёмной коркой и огненной короной.
   Рисуется один раз при сборке картинок (previews/logo.html, build-logo.js), на сайте - готовая картинка
   assets/heart-core.webp.
   Два прохода: обычный кадр и кадр одних светящихся частей, из второго - мягкое свечение (bloom) поверх первого. */
import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/* h - доля высоты кадра под сердце (с сосудами) */
export const ARTIFACT = { h: 0.56 };

const NOISE = /* glsl */ `
vec3 hash33(vec3 p){ p = fract(p * vec3(.1031,.1030,.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float hash13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
vec2 worley(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + hash33(i + g) - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; } }
  return vec2(sqrt(d1), sqrt(d2)); }
vec3 perturbN(vec3 pos, vec3 n, float h){ vec3 dpdx = dFdx(pos), dpdy = dFdy(pos); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx); float det = dot(dpdx, r1); vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad); }
`;

const g = (d, s) => Math.exp(-d / (s * s));
const smin0 = y => 0.5 * (y - Math.sqrt(y * y + 0.06)) + 0.1225;
function surface(v) {
  const yn = smin0(v.y),
    yp = v.y - yn;
  const k = 1 + yn * 0.52;
  let x = v.x * 0.92 * k * (1 + yp * 0.1),
    z = v.z * 0.8 * k;
  const y = yn * 1.34 + yp * 0.86;
  x += yn * yn * 0.12;
  const d2 = (a, b, c) => (x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2;
  const bump =
    0.19 * g(d2(-0.74, 0.36, 0.1), 0.45) +
    0.12 * g(d2(0.72, 0.52, 0.26), 0.3) +
    0.1 * g(d2(0, 0.62, -0.45), 0.5) +
    0.05 * g(d2(-0.3, 0.7, 0.3), 0.35);
  const n = 1 + bump;
  return new T.Vector3(x * n, y * n - 0.05, z * n);
}
/* JS-шум для смещения вершин (крупный рельеф) */
function h13(x, y, z) {
  let a = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return a - Math.floor(a);
}
function vn(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  let fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t,
    c = (i, j, k) => h13(ix + i, iy + j, iz + k);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy),
    L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz
  );
}
function fbmJ(x, y, z, o = 4) {
  let a = 0.5,
    s = 0;
  for (let i = 0; i < o; i++) {
    s += a * vn(x, y, z);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    z = z * 2.03 + 3.1;
    a *= 0.5;
  }
  return s;
}

/* тело сердца: сфера с подразбиением -> поверхность; disp(v, p) - смещение по нормали */
function body(detail, disp) {
  let geo = new T.IcosahedronGeometry(1, detail);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo);
  const p = geo.attributes.position,
    v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const s = surface(v);
    if (disp) s.multiplyScalar(1 + disp(v, s));
    p.setXYZ(i, s.x, s.y, s.z);
  }
  geo.computeVertexNormals();
  return geo;
}
const STUBS = [
  [[0.06, 0.55, -0.06], [0.12, 1, -0.05], 0.21, 0.62],
  [[-0.2, 0.5, 0.22], [-0.5, 1, 0.25], 0.16, 0.55],
  [[-0.56, 0.42, -0.08], [-0.15, 1, -0.1], 0.12, 0.5],
  [[0.46, 0.48, -0.2], [0.45, 1, -0.2], 0.1, 0.44]
];
/* отростки сосудов: base, dir, r, len -> меши; cap - материал среза */
function stubs(parent, mat, capMat, radial = 12, open = false) {
  const up = new T.Vector3(0, 1, 0);
  STUBS.forEach(([base, dir, r, len]) => {
    const d = new T.Vector3(...dir).normalize();
    const q = new T.Quaternion().setFromUnitVectors(up, d);
    const geo = new T.CylinderGeometry(r * 0.78, r, len, radial, 8, open);
    const m = new T.Mesh(geo, mat);
    m.position.set(...base).addScaledVector(d, len / 2);
    m.quaternion.copy(q);
    parent.add(m);
    if (capMat) {
      const cap = new T.Mesh(new T.CircleGeometry(r * 0.78 * 0.98, radial), capMat);
      cap.position.set(...base).addScaledVector(d, len + 0.002);
      cap.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2));
      parent.add(cap);
    }
  });
}
/* материал со своим шейдерным кодом поверх стандартного: col - цвет/шероховатость, emi - свечение, h - рельеф */
function shaderMat(params, code, uniforms = {}) {
  const m = new T.MeshPhysicalMaterial(params);
  m.userData.u = Object.assign({ uGlow: { value: 0 } }, uniforms);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    const U = Object.keys(m.userData.u)
      .map(k => `uniform ${typeof m.userData.u[k].value === "number" ? "float" : "vec3"} ${k};`)
      .join("\n");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vObj;\n${U}\n${NOISE}\n${code.fns || ""}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${code.col || ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${code.rough || ""}`)
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\n${code.h ? `{ float hh = ${code.h}; normal = perturbN(-vViewPosition, normal, hh); }` : ""}`
      )
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${code.emi || ""}`)
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>\nif (uGlow > .5) gl_FragColor = vec4(totalEmissiveRadiance, diffuseColor.a);`
      );
  };
  return m;
}
/* у обычных материалов в проходе свечения - чёрный (они только закрывают свечение) */
const BLACK = new T.MeshBasicMaterial({ color: 0 });

/* ---------- плазма ---------- */
function plasma() {
  const grp = new T.Group();
  const geo = body(80, (v, s) => (fbmJ(s.x * 3, s.y * 3, s.z * 3) - 0.5) * 0.05);
  const fns = `vec3 fire(float t){ return mix(mix(vec3(.18,.0,.0), vec3(.95,.08,.0), smoothstep(.0,.5,t)), mix(vec3(1.,.38,.02), vec3(1.,.85,.5), smoothstep(.8,1.,t)), smoothstep(.5,.85,t)); }
    float plasmaF(vec3 p){ vec3 q = p*2.6; vec3 w = vec3(fbm(q), fbm(q+4.1), fbm(q+8.3)); return fbm(q*1.3 + w*2.6); }`;
  const mat = shaderMat(
    { color: 0x000000, roughness: 0.5, metalness: 0, emissive: 0xffffff, envMapIntensity: 0.2 },
    {
      fns,
      col: `diffuseColor.rgb = vec3(.06,.01,.0);`,
      emi: `{ vec3 V = normalize(vViewPosition); float fr = 1. - clamp(dot(normal, V), 0., 1.);
      float t = plasmaF(vObj); t = clamp((t - .32) * 1.7, 0., 1.);
      float crust = smoothstep(.5, .3, plasmaF(vObj*1.5 + 11.)) * .85;
      totalEmissiveRadiance = fire(clamp(t*.85 + fr*.3, 0., 1.)) * (1.15 + fr*1.6) * (1. - crust); }`
    }
  );
  grp.add(new T.Mesh(geo, mat));
  /* корона: оболочка чуть больше тела, светится по краю */
  const shell = body(60, () => 0.07);
  const sh = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uGlow: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vObj; void main(){ vObj = position; vec4 mv = modelViewMatrix*vec4(position,1.); vV = -mv.xyz; vN = normalMatrix*normal; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vObj; uniform float uGlow; ${NOISE}
      void main(){ float fr = 1. - abs(dot(normalize(vN), normalize(vV))); float n = fbm(vObj*4.);
      float a = pow(fr, 2.2) * (0.4 + n) * 1.1; gl_FragColor = vec4(vec3(1.,.45,.08)*a, a); }`
  });
  sh.userData.glow = true;
  grp.add(new T.Mesh(shell, sh));
  stubs(grp, mat, null, 14);
  return { grp, light: 0xff7a20, noEnv: true };
}

/* рендер: px - сторона кадра, h - доля высоты сердца в кадре; на выходе - canvas с картинкой и отдельно - canvas свечения */
function render(px, h) {
  const canvas = document.createElement("canvas");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.setClearColor(0, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(35, 1, 0.1, 50);
  cam.position.set(0, 0, 8.6);
  const pm = new T.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const { grp, light, noEnv } = plasma();
  if (noEnv) scene.environmentIntensity = 0.15;
  const tilt = new T.Group();
  tilt.rotation.z = 0.2;
  tilt.add(grp);
  const root = new T.Group();
  root.add(tilt);
  scene.add(root);
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root),
    size = box.getSize(new T.Vector3());
  const vh = 2 * cam.position.z * Math.tan((cam.fov * Math.PI) / 360);
  const s = (h * vh) / size.y;
  root.scale.setScalar(s);
  const ctr = box.getCenter(new T.Vector3());
  root.position.copy(ctr).multiplyScalar(-s);
  const key = new T.DirectionalLight(0xfff1e6, 1.25);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new T.DirectionalLight(light, 2.2);
  rim.position.set(-3, 1.5, -2.5);
  scene.add(rim);
  const rim2 = new T.DirectionalLight(light, 1.2);
  rim2.position.set(3, -2, -1);
  scene.add(rim2);
  scene.add(new T.AmbientLight(0x402020, 0.4));
  renderer.render(scene, cam);
  const out = document.createElement("canvas");
  out.width = out.height = px;
  out.getContext("2d").drawImage(canvas, 0, 0);
  /* проход свечения: светящиеся части как есть, остальное - чёрное */
  const keep = new Map();
  scene.traverse(o => {
    if (o.isMesh) {
      keep.set(o, o.material);
      const mm = o.material;
      if (mm.userData && mm.userData.skipGlow) {
        o.visible = false;
        return;
      }
      if (mm.userData && mm.userData.u) mm.userData.u.uGlow.value = 1;
      else if (mm.uniforms && mm.uniforms.uGlow) mm.uniforms.uGlow.value = 1;
      else if (!(mm.userData && mm.userData.glow)) o.material = BLACK;
    }
  });
  renderer.toneMapping = T.NoToneMapping;
  scene.environment = null;
  renderer.render(scene, cam);
  const glow = document.createElement("canvas");
  glow.width = glow.height = px;
  glow.getContext("2d").drawImage(canvas, 0, 0);
  keep.forEach((mm, o) => {
    o.material = mm;
    o.visible = true;
  });
  pm.dispose();
  renderer.dispose();
  return { img: out, glow };
}
/* итог: картинка + блум по светящимся частям */
export function renderArtifact(px, h = ARTIFACT.h, bloom = 1) {
  const { img, glow } = render(px, h);
  const g2 = glow.getContext("2d"),
    d = g2.getImageData(0, 0, px, px),
    D = d.data;
  for (let i = 0; i < D.length; i += 4) {
    const m = Math.max(D[i], D[i + 1], D[i + 2]);
    if (m < 8) {
      D[i + 3] = 0;
      continue;
    }
    D[i] = (D[i] * 255) / m;
    D[i + 1] = (D[i + 1] * 255) / m;
    D[i + 2] = (D[i + 2] * 255) / m;
    D[i + 3] = m;
  }
  g2.putImageData(d, 0, 0);
  const out = document.createElement("canvas");
  out.width = out.height = px;
  const o = out.getContext("2d");
  const blur = (r, a) => {
    o.save();
    o.globalCompositeOperation = "lighter";
    o.globalAlpha = a;
    o.filter = `blur(${r}px)`;
    o.drawImage(glow, 0, 0);
    o.restore();
  };
  blur(px * 0.03, 0.55 * bloom);
  o.drawImage(img, 0, 0);
  blur(px * 0.006, 0.5 * bloom);
  blur(px * 0.016, 0.45 * bloom);
  return out;
}
