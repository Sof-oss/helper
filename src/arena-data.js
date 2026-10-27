/* Бонус к урону от характеристик арены.
   Формула: floor(базовый урон × очки × c / 100), c = 0.04907% за одно очко.
   Базовый урон - урон оружия на первом уровне. */
export const ARENA_COEF_PERCENT = 0.04907;
export const ARENA_BASE = {
  knife: 47,
  pistol: 49,
  auto: 55,
  grenade: 56,
  gl: 115,
  gauss: 367
};
