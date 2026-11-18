/* Сцены живого 3D-фона для всех 12 тем: точные координаты костров, флагов, прожекторов,
   фонарей, маячков, воды, облаков и уникальных эффектов каждой локации.
   Координаты заданы в интуитивном пространстве десктопного фото (x: 0..1 слева направо,
   y: 0..1 сверху вниз); packSceneUniforms() переводит их в WebGL UV (y снизу вверх) и
   учитывает горизонтальный кроп мобильной версии (-m.webp). */

const MOBILE_CROP_W = 0.469;

/* Режимы источников света (uLights[i].w):
   1 = тёплый мерцающий фонарь/лампа с мягким бликом
   2 = мигающий красный авиационный/сигнальный маячок
   3 = мерцающий холодный люминесцентный светильник
   4 = мягкое сияние солнца/луны */

/* Уникальные эффекты темы (uSpecial.w):
   0 = нет
   1 = вертолёт Ми-24 (вращающиеся главный и хвостовой винты + строб)
   2 = аномалия «Электра» (трещащие разряды и пульсирующая плазма)
   3 = выброс над ЧАЭС (пульсация ядра + вспышки молний в штормовых тучах)
   4 = дым из заводских труб на фоне заката
   5 = зелёная болотная аномалия с отблеском в воде
   6 = рассветные птицы в небе и солнечная дорожка */

export const SCENES = {
  merc: {
    mobileCropX: 0.006,
    sky: { strength: 0.85, wind: 0.028, horizonY: 0.48, swirl: 0 },
    water: { topY: 0.68, strength: 0.55, full: 0, sunX: -1 },
    atmos: { fog: 0.85, ash: 0.85, anomaly: 0.7, indoor: 0 },
    fires: [{ x: 0.091, y: 0.639, r: 0.048, power: 1.0 }],
    flags: [{ x: 0.228, y: 0.115, hw: 0.046, hh: 0.095, anchor: -1, amp: 0.009, freq: 18, speed: 3.4 }],
    beams: [{ x: 0.138, y: 0.139, angle: -0.68, len: 0.24, spread: 0.19, sweep: 0.12, power: 0.52, tint: 0 }],
    lights: [
      { x: 0.097, y: 0.478, r: 0.045, mode: 1 },
      { x: 0.163, y: 0.478, r: 0.045, mode: 1 },
      { x: 0.747, y: 0.533, r: 0.045, mode: 1 },
      { x: 0.822, y: 0.378, r: 0.04, mode: 1 }
    ],
    special: { type: 0, x: 0.5, y: 0.5, r: 0.1 }
  },

  dolg: {
    mobileCropX: 0.269,
    sky: { strength: 0.9, wind: 0.032, horizonY: 0.5, swirl: 0 },
    water: { topY: 0.72, strength: 0.48, full: 0, sunX: 0.44 },
    atmos: { fog: 0.9, ash: 1.0, anomaly: 0.65, indoor: 0 },
    fires: [{ x: 0.972, y: 0.678, r: 0.052, power: 1.05 }],
    flags: [
      { x: 0.13, y: 0.16, hw: 0.036, hh: 0.145, anchor: 2, amp: 0.0065, freq: 14, speed: 2.6 },
      { x: 0.93, y: 0.27, hw: 0.036, hh: 0.135, anchor: 2, amp: 0.0055, freq: 15, speed: 2.3 }
    ],
    beams: [
      { x: 0.237, y: 0.322, angle: -0.78, len: 0.26, spread: 0.2, sweep: 0.1, power: 0.55, tint: 0 },
      { x: 0.725, y: 0.433, angle: -2.02, len: 0.34, spread: 0.18, sweep: 0.13, power: 0.58, tint: 0 },
      { x: 0.85, y: 0.139, angle: -2.42, len: 0.26, spread: 0.18, sweep: 0.09, power: 0.45, tint: 0 }
    ],
    lights: [
      { x: 0.237, y: 0.322, r: 0.04, mode: 1 },
      { x: 0.725, y: 0.433, r: 0.042, mode: 1 },
      { x: 0.85, y: 0.139, r: 0.038, mode: 1 },
      { x: 0.438, y: 0.495, r: 0.09, mode: 4 }
    ],
    special: { type: 4, x: 0.355, y: 0.35, r: 0.16 }
  },

  svoboda: {
    mobileCropX: 0.169,
    sky: { strength: 0.75, wind: 0.022, horizonY: 0.42, swirl: 0 },
    water: { topY: 0.68, strength: 0.35, full: 0, sunX: -1 },
    atmos: { fog: 0.55, ash: 0.9, anomaly: 0.5, indoor: 0 },
    fires: [
      { x: 0.191, y: 0.689, r: 0.068, power: 1.2 },
      { x: 0.656, y: 0.522, r: 0.03, power: 0.65 },
      { x: 0.959, y: 0.572, r: 0.038, power: 0.8 }
    ],
    flags: [
      { x: 0.235, y: 0.118, hw: 0.068, hh: 0.115, anchor: -1, amp: 0.0105, freq: 16, speed: 3.1 },
      { x: 0.912, y: 0.23, hw: 0.018, hh: 0.024, anchor: 1, amp: 0.005, freq: 24, speed: 3.8 }
    ],
    beams: [],
    lights: [
      { x: 0.016, y: 0.4, r: 0.055, mode: 1 },
      { x: 0.9, y: 0.312, r: 0.11, mode: 4 },
      { x: 0.484, y: 0.485, r: 0.032, mode: 1 }
    ],
    special: { type: 0, x: 0.5, y: 0.5, r: 0.1 }
  },

  science: {
    mobileCropX: 0.487,
    sky: { strength: 0.55, wind: 0.018, horizonY: 0.45, swirl: 0 },
    water: { topY: 0.62, strength: 0.85, full: 1, sunX: 0.225 },
    atmos: { fog: 1.15, ash: 0.45, anomaly: 0.4, indoor: 0 },
    fires: [],
    flags: [],
    beams: [
      { x: 0.65, y: 0.356, angle: -2.42, len: 0.24, spread: 0.24, sweep: 0.05, power: 0.52, tint: 2 },
      { x: 0.844, y: 0.333, angle: -1.45, len: 0.22, spread: 0.28, sweep: 0.04, power: 0.42, tint: 2 }
    ],
    lights: [
      { x: 0.666, y: 0.333, r: 0.03, mode: 2 },
      { x: 0.731, y: 0.456, r: 0.034, mode: 2 },
      { x: 0.966, y: 0.372, r: 0.028, mode: 2 },
      { x: 0.844, y: 0.333, r: 0.055, mode: 3 }
    ],
    special: { type: 2, x: 0.225, y: 0.461, r: 0.135 }
  },

  monolith: {
    mobileCropX: 0.269,
    sky: { strength: 1.0, wind: 0.042, horizonY: 0.54, swirl: 1 },
    water: { topY: 0.99, strength: 0.0, full: 0, sunX: -1 },
    atmos: { fog: 0.95, ash: 1.15, anomaly: 0.9, indoor: 0 },
    fires: [],
    flags: [],
    beams: [],
    lights: [{ x: 0.495, y: 0.535, r: 0.14, mode: 4 }],
    special: { type: 3, x: 0.495, y: 0.535, r: 0.28 }
  },

  rassvet: {
    mobileCropX: 0.331,
    sky: { strength: 0.8, wind: 0.02, horizonY: 0.52, swirl: 0 },
    water: { topY: 0.58, strength: 0.78, full: 1, sunX: 0.858 },
    atmos: { fog: 0.75, ash: 0.45, anomaly: 0.45, indoor: 0 },
    fires: [],
    flags: [],
    beams: [],
    lights: [
      { x: 0.858, y: 0.533, r: 0.13, mode: 4 },
      { x: 0.053, y: 0.539, r: 0.042, mode: 1 },
      { x: 0.744, y: 0.55, r: 0.05, mode: 3 }
    ],
    special: { type: 6, x: 0.78, y: 0.25, r: 0.15 }
  },

  loners: {
    mobileCropX: 0.35,
    sky: { strength: 0.85, wind: 0.022, horizonY: 0.35, swirl: 0 },
    water: { topY: 0.72, strength: 0.32, full: 0, sunX: -1 },
    atmos: { fog: 0.65, ash: 0.95, anomaly: 0.55, indoor: 0 },
    fires: [{ x: 0.728, y: 0.745, r: 0.072, power: 1.25 }],
    flags: [],
    beams: [],
    lights: [
      { x: 0.191, y: 0.483, r: 0.055, mode: 1 },
      { x: 0.633, y: 0.248, r: 0.11, mode: 4 }
    ],
    special: { type: 0, x: 0.5, y: 0.5, r: 0.1 }
  },

  traders: {
    mobileCropX: 0.531,
    sky: { strength: 0.9, wind: 0.026, horizonY: 0.45, swirl: 0 },
    water: { topY: 0.72, strength: 0.45, full: 0, sunX: 0.27 },
    atmos: { fog: 0.75, ash: 0.6, anomaly: 0.45, indoor: 0 },
    fires: [],
    flags: [],
    beams: [],
    lights: [
      { x: 0.842, y: 0.482, r: 0.055, mode: 1 },
      { x: 0.834, y: 0.582, r: 0.05, mode: 1 },
      { x: 0.244, y: 0.356, r: 0.11, mode: 4 }
    ],
    special: { type: 0, x: 0.5, y: 0.5, r: 0.1 }
  },

  renegades: {
    mobileCropX: 0.056,
    sky: { strength: 0.85, wind: 0.028, horizonY: 0.45, swirl: 0 },
    water: { topY: 0.6, strength: 0.82, full: 1, sunX: 0.628 },
    atmos: { fog: 1.05, ash: 0.85, anomaly: 0.55, indoor: 0 },
    fires: [{ x: 0.253, y: 0.585, r: 0.058, power: 1.15 }],
    flags: [{ x: 0.142, y: 0.235, hw: 0.044, hh: 0.14, anchor: -1, amp: 0.009, freq: 16, speed: 3.2 }],
    beams: [],
    lights: [
      { x: 0.105, y: 0.535, r: 0.045, mode: 1 },
      { x: 0.235, y: 0.452, r: 0.036, mode: 1 },
      { x: 0.9, y: 0.261, r: 0.042, mode: 1 },
      { x: 0.703, y: 0.158, r: 0.085, mode: 4 }
    ],
    special: { type: 5, x: 0.628, y: 0.489, r: 0.12 }
  },

  clearsky: {
    mobileCropX: 0.0,
    sky: { strength: 0.82, wind: 0.02, horizonY: 0.5, swirl: 0 },
    water: { topY: 0.6, strength: 0.82, full: 1, sunX: 0.724 },
    atmos: { fog: 0.85, ash: 0.45, anomaly: 0.45, indoor: 0 },
    fires: [{ x: 0.394, y: 0.578, r: 0.028, power: 0.7 }],
    flags: [{ x: 0.223, y: 0.355, hw: 0.015, hh: 0.036, anchor: 1, amp: 0.0055, freq: 24, speed: 3.6 }],
    beams: [],
    lights: [
      { x: 0.152, y: 0.056, r: 0.028, mode: 2 },
      { x: 0.094, y: 0.589, r: 0.038, mode: 1 },
      { x: 0.219, y: 0.522, r: 0.038, mode: 1 },
      { x: 0.724, y: 0.535, r: 0.11, mode: 4 }
    ],
    special: { type: 6, x: 0.7, y: 0.44, r: 0.18 }
  },

  bandits: {
    mobileCropX: 0.306,
    sky: { strength: 0.0, wind: 0.0, horizonY: 0.1, swirl: 0 },
    water: { topY: 0.76, strength: 0.38, full: 0, sunX: -1 },
    atmos: { fog: 0.95, ash: 0.9, anomaly: 0.35, indoor: 1 },
    fires: [{ x: 0.79, y: 0.535, r: 0.068, power: 1.25 }],
    flags: [],
    beams: [{ x: 0.962, y: 0.135, angle: -2.4, len: 0.3, spread: 0.24, sweep: 0.03, power: 0.36, tint: 2 }],
    lights: [
      { x: 0.125, y: 0.562, r: 0.052, mode: 1 },
      { x: 0.962, y: 0.135, r: 0.058, mode: 3 },
      { x: 0.281, y: 0.538, r: 0.04, mode: 3 }
    ],
    special: { type: 0, x: 0.5, y: 0.5, r: 0.1 }
  },

  military: {
    mobileCropX: 0.25,
    sky: { strength: 0.88, wind: 0.03, horizonY: 0.48, swirl: 0 },
    water: { topY: 0.66, strength: 0.55, full: 0, sunX: -1 },
    atmos: { fog: 0.95, ash: 0.75, anomaly: 0.6, indoor: 0 },
    fires: [],
    flags: [],
    beams: [{ x: 0.41, y: 0.165, angle: -0.34, len: 0.38, spread: 0.16, sweep: 0.17, power: 0.78, tint: 1 }],
    lights: [
      { x: 0.326, y: 0.032, r: 0.028, mode: 2 },
      { x: 0.412, y: 0.439, r: 0.052, mode: 1 },
      { x: 0.559, y: 0.467, r: 0.048, mode: 1 },
      { x: 0.716, y: 0.433, r: 0.038, mode: 1 }
    ],
    special: { type: 1, x: 0.682, y: 0.163, r: 0.072 }
  }
};

export function getScene(key) {
  return SCENES[key] || SCENES.merc;
}

const glY = y => 1 - y;

/* Упаковка параметров темы в плоские Float32Array для uniforms WebGL 1 */
export function packSceneUniforms(key, isMobileImg = false) {
  const s = getScene(key);
  const crop = new Float32Array(isMobileImg ? [s.mobileCropX, MOBILE_CROP_W] : [0, 1]);
  const sky = new Float32Array([s.sky.strength, s.sky.wind, glY(s.sky.horizonY), s.sky.swirl]);
  const water = new Float32Array([glY(s.water.topY), s.water.strength, s.water.full, s.water.sunX]);
  const atmos = new Float32Array([s.atmos.fog, s.atmos.ash, s.atmos.anomaly, s.atmos.indoor]);

  const fires = new Float32Array(12);
  for (let i = 0; i < 3; i++) {
    const f = s.fires[i];
    if (!f) continue;
    fires[i * 4] = f.x;
    fires[i * 4 + 1] = glY(f.y);
    fires[i * 4 + 2] = f.r;
    fires[i * 4 + 3] = f.power;
  }

  const flags = new Float32Array(8);
  const flagDir = new Float32Array(8);
  for (let i = 0; i < 2; i++) {
    const fl = s.flags[i];
    if (!fl) continue;
    flags[i * 4] = fl.x;
    flags[i * 4 + 1] = glY(fl.y);
    flags[i * 4 + 2] = fl.hw;
    flags[i * 4 + 3] = fl.hh;
    flagDir[i * 4] = fl.anchor;
    flagDir[i * 4 + 1] = fl.amp;
    flagDir[i * 4 + 2] = fl.freq;
    flagDir[i * 4 + 3] = fl.speed;
  }

  const beams = new Float32Array(12);
  const beamOpt = new Float32Array(12);
  for (let i = 0; i < 3; i++) {
    const b = s.beams[i];
    if (!b) continue;
    beams[i * 4] = b.x;
    beams[i * 4 + 1] = glY(b.y);
    beams[i * 4 + 2] = b.angle;
    beams[i * 4 + 3] = b.len;
    beamOpt[i * 4] = b.spread;
    beamOpt[i * 4 + 1] = b.sweep;
    beamOpt[i * 4 + 2] = b.power;
    beamOpt[i * 4 + 3] = b.tint;
  }

  const lights = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    const l = s.lights[i];
    if (!l) continue;
    lights[i * 4] = l.x;
    lights[i * 4 + 1] = glY(l.y);
    lights[i * 4 + 2] = l.r;
    lights[i * 4 + 3] = l.mode;
  }

  const special = new Float32Array([s.special.x, glY(s.special.y), s.special.r, s.special.type]);

  return { crop, sky, water, atmos, fires, flags, flagDir, beams, beamOpt, lights, special };
}
