/* Снаряжение из ответа API игры (25.10.2026): 12 комплектов и одиночные вещи. */
export const SETS = [
  {
    code: "SET_001",
    name: "Комплект «Первый день в Зоне»",
    bonuses: { knife: 4, pistol: 4, auto: 6 },
    extras: {},
    items: [
      {
        code: "HEAD_001",
        name: "Кепка",
        slot: "head",
        rarity: "common",
        icon: "/assets/equipment/HEAD_001.webp",
        bonuses: { knife: 2, pistol: 2, auto: 2 },
        extras: {}
      },
      {
        code: "JACKET_001",
        name: "Борцовка",
        slot: "jacket",
        rarity: "common",
        icon: "/assets/equipment/JACKET_001.webp",
        bonuses: { knife: 1, pistol: 1, auto: 2 },
        extras: {}
      },
      {
        code: "PANTS_001",
        name: "Треники",
        slot: "pants",
        rarity: "common",
        icon: "/assets/equipment/PANTS_001.webp",
        bonuses: { knife: 1, pistol: 1, auto: 2 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_002",
    name: "Комплект «Любитель прогулок»",
    bonuses: { grenade: 6, gl: 11, gauss: 36 },
    extras: {},
    items: [
      {
        code: "HEAD_002",
        name: "Вязаная шапка",
        slot: "head",
        rarity: "common",
        icon: "/assets/equipment/HEAD_002.webp",
        bonuses: { grenade: 2, gl: 5, gauss: 14 },
        extras: {}
      },
      {
        code: "JACKET_002",
        name: "Толстовка",
        slot: "jacket",
        rarity: "common",
        icon: "/assets/equipment/JACKET_002.webp",
        bonuses: { grenade: 2, gl: 3, gauss: 11 },
        extras: {}
      },
      {
        code: "PANTS_002",
        name: "Джинсы",
        slot: "pants",
        rarity: "common",
        icon: "/assets/equipment/PANTS_002.webp",
        bonuses: { grenade: 2, gl: 3, gauss: 11 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_003",
    name: "Комплект «Марафонец»",
    bonuses: { knife: 10, pistol: 10, auto: 10 },
    extras: {},
    items: [
      {
        code: "JACKET_004",
        name: "Олимпийка",
        slot: "jacket",
        rarity: "uncommon",
        icon: "/assets/equipment/JACKET_004.webp",
        bonuses: { knife: 5, pistol: 5, auto: 5 },
        extras: {}
      },
      {
        code: "PANTS_003",
        name: "Спортивные штаны",
        slot: "pants",
        rarity: "uncommon",
        icon: "/assets/equipment/PANTS_003.webp",
        bonuses: { knife: 5, pistol: 5, auto: 5 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_004",
    name: "Комплект «Полевой»",
    bonuses: { grenade: 18, gl: 33, gauss: 108 },
    extras: {},
    items: [
      {
        code: "HEAD_005",
        name: "Армейская Кепка",
        slot: "head",
        rarity: "uncommon",
        icon: "/assets/equipment/HEAD_005.webp",
        bonuses: { grenade: 6, gl: 11, gauss: 36 },
        extras: {}
      },
      {
        code: "PANTS_004",
        name: "Армейские штаны",
        slot: "pants",
        rarity: "uncommon",
        icon: "/assets/equipment/PANTS_004.webp",
        bonuses: { grenade: 6, gl: 11, gauss: 36 },
        extras: {}
      },
      {
        code: "JACKET_005",
        name: "Армейская куртка",
        slot: "jacket",
        rarity: "uncommon",
        icon: "/assets/equipment/JACKET_005.webp",
        bonuses: { grenade: 6, gl: 11, gauss: 36 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_005",
    name: "Комплект «Болотник»",
    bonuses: { knife: 14, pistol: 14, auto: 16 },
    extras: {},
    items: [
      {
        code: "HEAD_003",
        name: "Противогаз",
        slot: "head",
        rarity: "common",
        icon: "/assets/equipment/HEAD_003.webp",
        bonuses: { knife: 7, pistol: 7, auto: 8 },
        extras: {}
      },
      {
        code: "JACKET_007",
        name: "Дождевик",
        slot: "jacket",
        rarity: "common",
        icon: "/assets/equipment/JACKET_007.webp",
        bonuses: { knife: 7, pistol: 7, auto: 8 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_006",
    name: "Комплект «ОМОН»",
    bonuses: { grenade: 30, gl: 61, gauss: 198 },
    extras: {},
    items: [
      {
        code: "PANTS_005",
        name: "Штаны ОМОН",
        slot: "pants",
        rarity: "uncommon",
        icon: "/assets/equipment/PANTS_005.webp",
        bonuses: { grenade: 10, gl: 21, gauss: 68 },
        extras: {}
      },
      {
        code: "HEAD_004",
        name: "Шлем ОМОН",
        slot: "head",
        rarity: "uncommon",
        icon: "/assets/equipment/HEAD_004.webp",
        bonuses: { grenade: 10, gl: 20, gauss: 65 },
        extras: {}
      },
      {
        code: "JACKET_006",
        name: "Куртка ОМОН",
        slot: "jacket",
        rarity: "uncommon",
        icon: "/assets/equipment/JACKET_006.webp",
        bonuses: { grenade: 10, gl: 20, gauss: 65 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_007",
    name: "Комплект «КХК-01»",
    bonuses: { grenade: 41, gl: 85, gauss: 270 },
    extras: { critGaussChance: 0.01, critGaussDamage: 100 },
    items: [
      {
        code: "HEAD_006",
        name: "Шлем КХК-01",
        slot: "head",
        rarity: "rare",
        icon: "/assets/equipment/HEAD_006.webp",
        bonuses: { grenade: 21, gl: 43, gauss: 137 },
        extras: { critGaussChance: 0.01, critGaussDamage: 50 }
      },
      {
        code: "JACKET_010",
        name: "Комбинезон КХК-01",
        slot: "jacket",
        rarity: "rare",
        icon: "/assets/equipment/JACKET_010.webp",
        bonuses: { grenade: 20, gl: 42, gauss: 133 },
        extras: { critGaussDamage: 50 }
      }
    ]
  },
  {
    code: "SET_008",
    name: "Комплект «Рубеж-М»",
    bonuses: { grenade: 48, gl: 102, gauss: 324 },
    extras: { critChance: 0.02, critDamage: 50 },
    items: [
      {
        code: "HEAD_007",
        name: 'Шлем "Рубеж-М"',
        slot: "head",
        rarity: "rare",
        icon: "/assets/equipment/HEAD_007.webp",
        bonuses: { grenade: 16, gl: 34, gauss: 108 },
        extras: { critChance: 0.01, critDamage: 17 }
      },
      {
        code: "JACKET_012",
        name: 'Бронекуртка "Рубеж-М"',
        slot: "jacket",
        rarity: "rare",
        icon: "/assets/equipment/JACKET_012.webp",
        bonuses: { grenade: 16, gl: 34, gauss: 108 },
        extras: { critChance: 0.01, critDamage: 17 }
      },
      {
        code: "PANTS_006",
        name: 'Тактические штаны "Рубеж-М"',
        slot: "pants",
        rarity: "rare",
        icon: "/assets/equipment/PANTS_006.webp",
        bonuses: { grenade: 16, gl: 34, gauss: 108 },
        extras: { critDamage: 16 }
      }
    ]
  },
  {
    code: "SET_009",
    name: "Комплект «Научный сотрудник»",
    bonuses: { knife: 18, pistol: 20, auto: 22 },
    extras: {},
    items: [
      {
        code: "HEAD_008",
        name: "Гермошлем учёного",
        slot: "head",
        rarity: "rare",
        icon: "/assets/equipment/HEAD_008.webp",
        bonuses: { knife: 9, pistol: 10, auto: 11 },
        extras: {}
      },
      {
        code: "JACKET_013",
        name: "Научный комбинезон",
        slot: "jacket",
        rarity: "rare",
        icon: "/assets/equipment/JACKET_013.webp",
        bonuses: { knife: 9, pistol: 10, auto: 11 },
        extras: {}
      }
    ]
  },
  {
    code: "SET_010",
    name: "Комплект «Копатель»",
    bonuses: { grenade: 22, gl: 46, gauss: 144 },
    extras: { critGrenadeDamage: 75, critGrenadeChance: 0.01 },
    items: [
      {
        code: "HEAD_009",
        name: "Каска копателя",
        slot: "head",
        rarity: "rare",
        icon: "/assets/equipment/HEAD_009.webp",
        bonuses: { grenade: 8, gl: 16, gauss: 50 },
        extras: { critGrenadeDamage: 25, critGrenadeChance: 0.01 }
      },
      {
        code: "JACKET_014",
        name: "Потёртая куртка",
        slot: "jacket",
        rarity: "rare",
        icon: "/assets/equipment/JACKET_014.webp",
        bonuses: { grenade: 7, gl: 15, gauss: 47 },
        extras: { critGrenadeDamage: 25 }
      },
      {
        code: "PANTS_007",
        name: "Рваные джинсы",
        slot: "pants",
        rarity: "rare",
        icon: "/assets/equipment/PANTS_007.webp",
        bonuses: { grenade: 7, gl: 15, gauss: 47 },
        extras: { critGrenadeDamage: 25 }
      }
    ]
  },
  {
    code: "SET_011",
    name: "Комплект «Жестянка»",
    bonuses: { grenade: 60, gl: 125, gauss: 396 },
    extras: { critChance: 0.03, critDamage: 75 },
    items: [
      {
        code: "HEAD_010",
        name: "Консервная банка",
        slot: "head",
        rarity: "rare",
        icon: "/assets/equipment/HEAD_010.webp",
        bonuses: { grenade: 20, gl: 42, gauss: 133 },
        extras: { critChance: 0.01, critDamage: 25 }
      },
      {
        code: "JACKET_015",
        name: 'Бронекуртка "Жестянка"',
        slot: "jacket",
        rarity: "rare",
        icon: "/assets/equipment/JACKET_015.webp",
        bonuses: { grenade: 20, gl: 42, gauss: 133 },
        extras: { critChance: 0.01, critDamage: 25 }
      },
      {
        code: "PANTS_008",
        name: 'Штаны "Жестянка"',
        slot: "pants",
        rarity: "rare",
        icon: "/assets/equipment/PANTS_008.webp",
        bonuses: { grenade: 20, gl: 41, gauss: 130 },
        extras: { critChance: 0.01, critDamage: 25 }
      }
    ]
  },
  {
    code: "SET_012",
    name: "Комплект «Пятничный вечер»",
    isNew: true,
    bonuses: { grenade: 18, gl: 33, gauss: 108 },
    extras: {},
    items: [
      {
        code: "HEAD_011",
        name: "Хоккейная маска",
        slot: "head",
        rarity: "rare",
        icon: "/assets/equipment/HEAD_011.webp",
        bonuses: { grenade: 6, gl: 11, gauss: 36 },
        extras: {}
      },
      {
        code: "JACKET_016",
        name: "Потёртая куртка",
        slot: "jacket",
        rarity: "rare",
        icon: "/assets/equipment/JACKET_016.webp",
        bonuses: { grenade: 6, gl: 11, gauss: 36 },
        extras: {}
      },
      {
        code: "PANTS_009",
        name: "Старые джинсы",
        slot: "pants",
        rarity: "rare",
        icon: "/assets/equipment/PANTS_009.webp",
        bonuses: { grenade: 6, gl: 11, gauss: 36 },
        extras: {}
      }
    ]
  }
];
export const ITEMS = [
  {
    code: "JACKET_003",
    name: 'Футболка "Сердце Зоны"',
    slot: "jacket",
    rarity: "rare",
    icon: "/assets/equipment/JACKET_003.webp",
    bonuses: { grenade: 1, gl: 2, gauss: 7 },
    extras: {}
  },
  {
    code: "JACKET_008",
    name: "Кожанная куртка",
    slot: "jacket",
    rarity: "rare",
    icon: "/assets/equipment/JACKET_008.webp",
    bonuses: { grenade: 3, gl: 7, gauss: 22 },
    extras: {}
  },
  {
    code: "JACKET_009",
    name: "Бандитский плащ",
    slot: "jacket",
    rarity: "rare",
    icon: "/assets/equipment/JACKET_009.webp",
    bonuses: { grenade: 2, gl: 5, gauss: 14 },
    extras: {}
  },
  {
    code: "JACKET_011",
    name: 'Комбинезон "Рассвет"',
    slot: "jacket",
    rarity: "rare",
    icon: "/assets/equipment/JACKET_011.webp",
    bonuses: { knife: 12, pistol: 12, auto: 14 },
    extras: { cooldown: 0.03, freeNoCooldown: 0.01 }
  }
];
