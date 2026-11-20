/* Система достижений игроков «Сердца Зоны»: каталог, расчёт прогресса, очков и уникальные значки.
   Работает в браузере (window.ZoneAchievements) и в Node.js (для модульных тестов). */
(function (root) {
  "use strict";

  const DAY_MS = 864e5;

  /* категории достижений */
  const CATEGORIES = [
    { key: "path", label: "Путь сталкера" },
    { key: "reputation", label: "Репутация и слава" },
    { key: "factions", label: "Группировки" },
    { key: "bosses", label: "Боссы" },
    { key: "activities", label: "Активности" }
  ];

  /* уровни сложности (редкости): цвет рамки, подпись, порядок */
  const RARITIES = {
    common: { key: "common", label: "Обычное", color: "#8fb4c9", bg: "#15232e", order: 1 },
    rare: { key: "rare", label: "Редкое", color: "#4ec9a0", bg: "#112922", order: 2 },
    epic: { key: "epic", label: "Эпическое", color: "#b88cff", bg: "#201733", order: 3 },
    legendary: { key: "legendary", label: "Легендарное", color: "#f6c453", bg: "#2e220d", order: 4 }
  };

  /* звания по проценту набранных очков достижений */
  const SCORE_RANKS = [
    [85, "Легенда Зоны"],
    [65, "Хранитель Зоны"],
    [45, "Мастер достижений"],
    [25, "Опытный следопыт"],
    [10, "Искатель Зоны"],
    [0, "Начинающий сталкер"]
  ];

  function scoreRank(pct) {
    for (const [min, title] of SCORE_RANKS) {
      if (pct >= min) return title;
    }
    return SCORE_RANKS[SCORE_RANKS.length - 1][1];
  }

  /* разбор строки времени в игре (p.z: «0 дней», «14 дней», «6 месяцев», «1 год» и т. п.) -> дни */
  function parseZoneDays(text) {
    if (!text) return 0;
    const s = String(text).trim().toLowerCase();
    let total = 0;
    const yearMatch = /(\d+)\s*(?:год|года|лет|г\.)/.exec(s);
    const monthMatch = /(\d+)\s*(?:месяц|месяца|месяцев|мес)/.exec(s);
    const weekMatch = /(\d+)\s*(?:недел|нед)/.exec(s);
    const dayMatch = /(\d+)\s*(?:ден|дня|дней|дн|сут)/.exec(s);
    if (yearMatch) total += Number(yearMatch[1]) * 365;
    if (monthMatch) total += Number(monthMatch[1]) * 30;
    if (weekMatch) total += Number(weekMatch[1]) * 7;
    if (dayMatch) total += Number(dayMatch[1]);
    return total;
  }

  /* разбор истории группировок (gh + dates) и текущего состояния */
  function analyzeFactions(player, dates, leaderInfo) {
    const curGroup = player.g && player.g !== "-" ? String(player.g).trim() : "";
    const gh = Array.isArray(player.gh) ? player.gh : [];
    const lastMs = Array.isArray(dates) && dates.length ? dates[dates.length - 1] : 0;

    let everInFaction = Boolean(curGroup);
    let leftCount = 0;
    let switchCount = 0;
    let maxStayDays = 0;

    const cleanName = g => (g && g !== "-" ? String(g).trim() : "");

    for (let i = 0; i < gh.length; i++) {
      const g = cleanName(gh[i][1]);
      if (g) everInFaction = true;
      if (i > 0) {
        const prev = cleanName(gh[i - 1][1]);
        if (prev && g !== prev) {
          leftCount++;
          if (g) switchCount++;
        }
      }
      if (g && Array.isArray(dates) && dates.length) {
        const from = dates[gh[i][0]];
        if (typeof from === "number") {
          const to = i + 1 < gh.length && typeof dates[gh[i + 1][0]] === "number" ? dates[gh[i + 1][0]] : lastMs;
          const days = Math.max(0, (to - from) / DAY_MS);
          if (days > maxStayDays) maxStayDays = days;
        }
      }
    }

    /* переходы вида A -> "" -> B в пределах истории также считаем сменой отряда */
    let prevNonEmpty = "";
    let distinctSwitches = 0;
    const switchTimes = [];
    for (let i = 0; i < gh.length; i++) {
      const g = cleanName(gh[i][1]);
      if (!g) continue;
      if (prevNonEmpty && g !== prevNonEmpty) {
        distinctSwitches++;
        if (Array.isArray(dates) && typeof dates[gh[i][0]] === "number") {
          switchTimes.push(dates[gh[i][0]]);
        }
      }
      prevNonEmpty = g;
    }
    const factionChanges = Math.max(switchCount, distinctSwitches);

    /* максимальное число смен группировки в пределах 30 дней */
    let maxSwitchesIn30d = 0;
    for (let l = 0, r = 0; r < switchTimes.length; r++) {
      while (switchTimes[r] - switchTimes[l] > 30 * DAY_MS) l++;
      if (r - l + 1 > maxSwitchesIn30d) maxSwitchesIn30d = r - l + 1;
    }

    /* лидерство: leaderInfo может быть [isCurrent (0|1), ...factions] или объектом { current, ever } */
    let isCurrentLeader = false;
    let everLeader = false;
    if (Array.isArray(leaderInfo)) {
      isCurrentLeader = Boolean(leaderInfo[0]);
      everLeader = isCurrentLeader || leaderInfo.length > 1;
    } else if (leaderInfo && typeof leaderInfo === "object") {
      isCurrentLeader = Boolean(leaderInfo.current);
      everLeader = Boolean(leaderInfo.ever || leaderInfo.current);
    }

    return {
      inFactionNow: Boolean(curGroup),
      everInFaction,
      everLeft: leftCount > 0,
      leftCount,
      factionChanges,
      maxSwitchesIn30d,
      maxStayDays: Math.floor(maxStayDays),
      isCurrentLeader,
      everLeader
    };
  }

  /* извлечение всех показателей игрока в единый снимок */
  function extractStats(player, ctx) {
    const metrics = (ctx && Array.isArray(ctx.metrics) ? ctx.metrics : []).slice();
    const bosses = (ctx && Array.isArray(ctx.bosses) ? ctx.bosses : []).slice();
    const dates = (ctx && Array.isArray(ctx.dates) ? ctx.dates : []).slice();
    const vals = Array.isArray(player.v) ? player.v : [];
    const ranks = Array.isArray(player.r) ? player.r : [];
    const bossVals = Array.isArray(player.b) ? player.b : [];

    const metricOf = k => {
      const i = metrics.indexOf(k);
      return i >= 0 ? Number(vals[i]) || 0 : 0;
    };
    const bossOf = name => {
      const i = bosses.indexOf(name);
      return i >= 0 ? Number(bossVals[i]) || 0 : 0;
    };

    const validRanks = ranks.filter(r => typeof r === "number" && r > 0);
    const bestRank = validRanks.length ? Math.min(...validRanks) : null;
    const top100Count = validRanks.filter(r => r <= 100).length;
    const bossesTypesDefeated = bosses.length
      ? bosses.reduce((acc, _, i) => acc + ((Number(bossVals[i]) || 0) > 0 ? 1 : 0), 0)
      : bossVals.filter(x => x > 0).length;

    const fac = analyzeFactions(player, dates, ctx && ctx.leaderInfo);

    return {
      level: Number(player.l) || 0,
      zoneDays: parseZoneDays(player.z),
      reputation: metricOf("reputation"),
      bossesTotal: metricOf("bosses"),
      stashes: metricOf("stashes"),
      talents: metricOf("talents"),
      collections: metricOf("collections"),
      expeditions: metricOf("expeditions"),
      defense: metricOf("defense"),
      bosses: {
        rat: bossOf("Крыса"),
        alpha: bossOf("Альфа-пёс"),
        boar: bossOf("Боров"),
        swamp: bossOf("Болотная тварь"),
        ghoul: bossOf("Упырь"),
        izlom: bossOf("Излом")
      },
      bossesTypesTotal: bosses.length || 6,
      bossesTypesDefeated,
      bestRank,
      top100Count,
      nickChanges: Array.isArray(player.nh) ? player.nh.length : 0,
      factions: fac
    };
  }

  /* каталог всех 65 игровых достижений */
  const DEFINITIONS = [
    /* ── Путь сталкера: уровень ── */
    {
      id: "lvl-5",
      category: "path",
      series: "level",
      tier: 1,
      rarity: "common",
      points: 10,
      name: "Первые шаги",
      desc: "Достичь 5 уровня",
      target: 5,
      unit: "ур.",
      icon: "lvl-1",
      value: s => s.level
    },
    {
      id: "lvl-10",
      category: "path",
      series: "level",
      tier: 2,
      rarity: "common",
      points: 20,
      name: "Опытный сталкер",
      desc: "Достичь 10 уровня",
      target: 10,
      unit: "ур.",
      icon: "lvl-2",
      value: s => s.level
    },
    {
      id: "lvl-20",
      category: "path",
      series: "level",
      tier: 3,
      rarity: "rare",
      points: 40,
      name: "Ветеран Зоны",
      desc: "Достичь 20 уровня",
      target: 20,
      unit: "ур.",
      icon: "lvl-3",
      value: s => s.level
    },
    {
      id: "lvl-25",
      category: "path",
      series: "level",
      tier: 4,
      rarity: "epic",
      points: 65,
      name: "Мастер Зоны",
      desc: "Достичь 25 уровня",
      target: 25,
      unit: "ур.",
      icon: "lvl-4",
      value: s => s.level
    },
    {
      id: "lvl-30",
      category: "path",
      series: "level",
      tier: 5,
      rarity: "legendary",
      points: 100,
      name: "Легенда Зоны",
      desc: "Достичь 30 уровня",
      target: 30,
      unit: "ур.",
      icon: "lvl-5",
      value: s => s.level
    },

    /* ── Путь сталкера: время в игре ── */
    {
      id: "time-7",
      category: "path",
      series: "zone-time",
      tier: 1,
      rarity: "common",
      points: 10,
      name: "Первая неделя",
      desc: "Провести 7 дней в Зоне",
      target: 7,
      unit: "дн.",
      icon: "time-1",
      value: s => s.zoneDays
    },
    {
      id: "time-30",
      category: "path",
      series: "zone-time",
      tier: 2,
      rarity: "common",
      points: 20,
      name: "Месяц за периметром",
      desc: "Провести 1 месяц в Зоне",
      target: 30,
      unit: "дн.",
      icon: "time-2",
      value: s => s.zoneDays
    },
    {
      id: "time-90",
      category: "path",
      series: "zone-time",
      tier: 3,
      rarity: "rare",
      points: 35,
      name: "Сезон в аномалиях",
      desc: "Провести 3 месяца в Зоне",
      target: 90,
      unit: "дн.",
      icon: "time-3",
      value: s => s.zoneDays
    },
    {
      id: "time-180",
      category: "path",
      series: "zone-time",
      tier: 4,
      rarity: "epic",
      points: 60,
      name: "Полгода в Зоне",
      desc: "Провести 6 месяцев в Зоне",
      target: 180,
      unit: "дн.",
      icon: "time-4",
      value: s => s.zoneDays
    },
    {
      id: "time-365",
      category: "path",
      series: "zone-time",
      tier: 5,
      rarity: "legendary",
      points: 100,
      name: "Старожил Зоны",
      desc: "Провести 1 год в Зоне",
      target: 365,
      unit: "дн.",
      icon: "time-5",
      value: s => s.zoneDays
    },

    /* ── Репутация и слава ── */
    {
      id: "rep-1k",
      category: "reputation",
      series: "rep",
      tier: 1,
      rarity: "common",
      points: 10,
      name: "Знакомое имя",
      desc: "Набрать 1 000 репутации",
      target: 1000,
      icon: "rep-1",
      value: s => s.reputation
    },
    {
      id: "rep-10k",
      category: "reputation",
      series: "rep",
      tier: 2,
      rarity: "common",
      points: 25,
      name: "Уважаемый боец",
      desc: "Набрать 10 000 репутации",
      target: 10000,
      icon: "rep-2",
      value: s => s.reputation
    },
    {
      id: "rep-50k",
      category: "reputation",
      series: "rep",
      tier: 3,
      rarity: "rare",
      points: 50,
      name: "Авторитет Зоны",
      desc: "Набрать 50 000 репутации",
      target: 50000,
      icon: "rep-3",
      value: s => s.reputation
    },
    {
      id: "rep-150k",
      category: "reputation",
      series: "rep",
      tier: 4,
      rarity: "epic",
      points: 80,
      name: "Имя на слуху",
      desc: "Набрать 150 000 репутации",
      target: 150000,
      icon: "rep-4",
      value: s => s.reputation
    },
    {
      id: "rep-300k",
      category: "reputation",
      series: "rep",
      tier: 5,
      rarity: "legendary",
      points: 120,
      name: "Миф Зоны",
      desc: "Набрать 300 000 репутации",
      target: 300000,
      icon: "rep-5",
      value: s => s.reputation
    },
    {
      id: "rank-100",
      category: "reputation",
      series: "rank-best",
      tier: 1,
      rarity: "rare",
      points: 25,
      name: "В сотне лучших",
      desc: "Попасть в Топ-100 любого рейтинга",
      kind: "rank",
      target: 100,
      icon: "rank-100",
      value: s => (s.bestRank && s.bestRank <= 100 ? 1 : 0),
      rankCheck: s => s.bestRank !== null && s.bestRank <= 100
    },
    {
      id: "rank-10",
      category: "reputation",
      series: "rank-best",
      tier: 2,
      rarity: "epic",
      points: 60,
      name: "Элита Зоны",
      desc: "Войти в Топ-10 любого рейтинга",
      kind: "rank",
      target: 10,
      icon: "rank-10",
      value: s => (s.bestRank && s.bestRank <= 10 ? 1 : 0),
      rankCheck: s => s.bestRank !== null && s.bestRank <= 10
    },
    {
      id: "rank-1",
      category: "reputation",
      series: "rank-best",
      tier: 3,
      rarity: "legendary",
      points: 125,
      name: "Номер один",
      desc: "Занять 1-е место в любом рейтинге",
      kind: "rank",
      target: 1,
      icon: "rank-1",
      value: s => (s.bestRank === 1 ? 1 : 0),
      rankCheck: s => s.bestRank === 1
    },
    {
      id: "multi-3",
      category: "reputation",
      series: "rank-multi",
      tier: 1,
      rarity: "epic",
      points: 55,
      name: "Универсал",
      desc: "Войти в Топ-100 сразу в 3 рейтингах",
      target: 3,
      unit: "рейт.",
      icon: "multi-3",
      value: s => s.top100Count
    },
    {
      id: "multi-7",
      category: "reputation",
      series: "rank-multi",
      tier: 2,
      rarity: "legendary",
      points: 130,
      name: "Повелитель рейтингов",
      desc: "Войти в Топ-100 во всех 7 рейтингах",
      target: 7,
      unit: "рейт.",
      icon: "multi-7",
      value: s => s.top100Count
    },
    {
      id: "nick-change",
      category: "reputation",
      rarity: "common",
      points: 15,
      name: "Новое имя",
      desc: "Сменить позывной в Зоне",
      kind: "boolean",
      target: 1,
      icon: "dogtag",
      value: s => (s.nickChanges > 0 ? 1 : 0)
    },

    /* ── Группировки ── */
    {
      id: "fac-join",
      category: "factions",
      rarity: "common",
      points: 15,
      name: "Под знамёнами",
      desc: "Вступить в группировку",
      kind: "boolean",
      target: 1,
      icon: "fac-join",
      value: s => (s.factions.everInFaction ? 1 : 0)
    },
    {
      id: "fac-leave",
      category: "factions",
      rarity: "common",
      points: 20,
      name: "Вольный ветер",
      desc: "Покинуть группировку или сменить отряд",
      kind: "boolean",
      target: 1,
      icon: "fac-leave",
      value: s => (s.factions.everLeft ? 1 : 0)
    },
    {
      id: "fac-nomad",
      category: "factions",
      rarity: "rare",
      points: 35,
      name: "Кочевник Зоны",
      desc: "Сменить группировку 2 раза",
      target: 2,
      unit: "раз",
      icon: "fac-nomad",
      value: s => s.factions.factionChanges
    },
    {
      id: "fac-frequent",
      category: "factions",
      rarity: "epic",
      points: 65,
      name: "Перекати-поле",
      desc: "Сменить группировку 3 раза за 30 дней",
      target: 3,
      unit: "раз",
      icon: "fac-frequent",
      value: s => s.factions.maxSwitchesIn30d
    },
    {
      id: "fac-leader-now",
      category: "factions",
      rarity: "epic",
      points: 60,
      name: "Действующий командир",
      desc: "Возглавлять группировку в данный момент",
      kind: "boolean",
      target: 1,
      icon: "fac-cmd",
      value: s => (s.factions.isCurrentLeader ? 1 : 0)
    },
    {
      id: "fac-leader-ever",
      category: "factions",
      rarity: "epic",
      points: 75,
      name: "Главенство в отряде",
      desc: "Стать лидером группировки",
      kind: "boolean",
      target: 1,
      icon: "fac-leader",
      value: s => (s.factions.everLeader ? 1 : 0)
    },
    {
      id: "fac-stay-7",
      category: "factions",
      series: "fac-stay",
      tier: 1,
      rarity: "common",
      points: 15,
      name: "Свой среди своих",
      desc: "Пробыть 7 дней подряд в одной группировке",
      target: 7,
      unit: "дн.",
      icon: "stay-1",
      value: s => s.factions.maxStayDays
    },
    {
      id: "fac-stay-14",
      category: "factions",
      series: "fac-stay",
      tier: 2,
      rarity: "common",
      points: 25,
      name: "Плечом к плечу",
      desc: "Пробыть 14 дней подряд в одной группировке",
      target: 14,
      unit: "дн.",
      icon: "stay-2",
      value: s => s.factions.maxStayDays
    },
    {
      id: "fac-stay-30",
      category: "factions",
      series: "fac-stay",
      tier: 3,
      rarity: "rare",
      points: 45,
      name: "Верность отряду",
      desc: "Пробыть 30 дней подряд в одной группировке",
      target: 30,
      unit: "дн.",
      icon: "stay-3",
      value: s => s.factions.maxStayDays
    },
    {
      id: "fac-stay-90",
      category: "factions",
      series: "fac-stay",
      tier: 4,
      rarity: "epic",
      points: 85,
      name: "Хранитель знамени",
      desc: "Пробыть 90 дней подряд в одной группировке",
      target: 90,
      unit: "дн.",
      icon: "stay-4",
      value: s => s.factions.maxStayDays
    },
    {
      id: "fac-stay-180",
      category: "factions",
      series: "fac-stay",
      tier: 5,
      rarity: "legendary",
      points: 130,
      name: "Несгибаемый ветеран",
      desc: "Пробыть 180 дней подряд в одной группировке",
      target: 180,
      unit: "дн.",
      icon: "stay-5",
      value: s => s.factions.maxStayDays
    },

    /* ── Боссы: общие победы ── */
    {
      id: "boss-10",
      category: "bosses",
      series: "boss-total",
      tier: 1,
      rarity: "common",
      points: 10,
      name: "Первая кровь",
      desc: "Победить 10 любых боссов",
      target: 10,
      icon: "boss-1",
      value: s => s.bossesTotal
    },
    {
      id: "boss-100",
      category: "bosses",
      series: "boss-total",
      tier: 2,
      rarity: "common",
      points: 25,
      name: "Охотник на мутантов",
      desc: "Победить 100 любых боссов",
      target: 100,
      icon: "boss-2",
      value: s => s.bossesTotal
    },
    {
      id: "boss-500",
      category: "bosses",
      series: "boss-total",
      tier: 3,
      rarity: "rare",
      points: 50,
      name: "Зверобой",
      desc: "Победить 500 любых боссов",
      target: 500,
      icon: "boss-3",
      value: s => s.bossesTotal
    },
    {
      id: "boss-1500",
      category: "bosses",
      series: "boss-total",
      tier: 4,
      rarity: "epic",
      points: 85,
      name: "Гроза мутантов",
      desc: "Победить 1 500 любых боссов",
      target: 1500,
      icon: "boss-4",
      value: s => s.bossesTotal
    },
    {
      id: "boss-2500",
      category: "bosses",
      series: "boss-total",
      tier: 5,
      rarity: "legendary",
      points: 125,
      name: "Истребитель Зоны",
      desc: "Победить 2 500 любых боссов",
      target: 2500,
      icon: "boss-5",
      value: s => s.bossesTotal
    },

    /* ── Боссы: конкретные боссы (с уникальными портретами боссов) ── */
    {
      id: "rat-50",
      category: "bosses",
      series: "boss-rat",
      tier: 1,
      rarity: "common",
      points: 15,
      name: "Крысолов",
      desc: "Победить 50 Крыс",
      target: 50,
      bossImg: "/assets/bosses/rat-cut.webp",
      tierMark: "I",
      icon: "boss-rat-1",
      value: s => s.bosses.rat
    },
    {
      id: "rat-500",
      category: "bosses",
      series: "boss-rat",
      tier: 2,
      rarity: "rare",
      points: 45,
      name: "Гроза подземелий",
      desc: "Победить 500 Крыс",
      target: 500,
      bossImg: "/assets/bosses/rat-cut.webp",
      tierMark: "II",
      icon: "boss-rat-2",
      value: s => s.bosses.rat
    },
    {
      id: "alpha-25",
      category: "bosses",
      series: "boss-alpha",
      tier: 1,
      rarity: "common",
      points: 20,
      name: "Волкодав",
      desc: "Победить 25 Альфа-псов",
      target: 25,
      bossImg: "/assets/bosses/alpha-cut.webp",
      tierMark: "I",
      icon: "boss-alpha-1",
      value: s => s.bosses.alpha
    },
    {
      id: "alpha-250",
      category: "bosses",
      series: "boss-alpha",
      tier: 2,
      rarity: "epic",
      points: 55,
      name: "Вожак стаи",
      desc: "Победить 250 Альфа-псов",
      target: 250,
      bossImg: "/assets/bosses/alpha-cut.webp",
      tierMark: "II",
      icon: "boss-alpha-2",
      value: s => s.bosses.alpha
    },
    {
      id: "boar-15",
      category: "bosses",
      series: "boss-boar",
      tier: 1,
      rarity: "common",
      points: 20,
      name: "Загонщик",
      desc: "Победить 15 Боровов",
      target: 15,
      bossImg: "/assets/bosses/boar-cut.webp",
      tierMark: "I",
      icon: "boss-boar-1",
      value: s => s.bosses.boar
    },
    {
      id: "boar-150",
      category: "bosses",
      series: "boss-boar",
      tier: 2,
      rarity: "epic",
      points: 60,
      name: "Король свалки",
      desc: "Победить 150 Боровов",
      target: 150,
      bossImg: "/assets/bosses/boar-cut.webp",
      tierMark: "II",
      icon: "boss-boar-2",
      value: s => s.bosses.boar
    },
    {
      id: "swamp-10",
      category: "bosses",
      series: "boss-swamp",
      tier: 1,
      rarity: "rare",
      points: 30,
      name: "Болотный следопыт",
      desc: "Победить 10 Болотных тварей",
      target: 10,
      bossImg: "/assets/bosses/swamp-cut.webp",
      tierMark: "I",
      icon: "boss-swamp-1",
      value: s => s.bosses.swamp
    },
    {
      id: "swamp-75",
      category: "bosses",
      series: "boss-swamp",
      tier: 2,
      rarity: "epic",
      points: 75,
      name: "Хозяин топей",
      desc: "Победить 75 Болотных тварей",
      target: 75,
      bossImg: "/assets/bosses/swamp-cut.webp",
      tierMark: "II",
      icon: "boss-swamp-2",
      value: s => s.bosses.swamp
    },
    {
      id: "ghoul-5",
      category: "bosses",
      series: "boss-ghoul",
      tier: 1,
      rarity: "rare",
      points: 40,
      name: "Ночной дозор",
      desc: "Победить 5 Упырей",
      target: 5,
      bossImg: "/assets/bosses/ghoul-cut.webp",
      tierMark: "I",
      icon: "boss-ghoul-1",
      value: s => s.bosses.ghoul
    },
    {
      id: "ghoul-20",
      category: "bosses",
      series: "boss-ghoul",
      tier: 2,
      rarity: "epic",
      points: 90,
      name: "Охотник на нежить",
      desc: "Победить 20 Упырей",
      target: 20,
      bossImg: "/assets/bosses/ghoul-cut.webp",
      tierMark: "II",
      icon: "boss-ghoul-2",
      value: s => s.bosses.ghoul
    },
    {
      id: "izlom-1",
      category: "bosses",
      series: "boss-izlom",
      tier: 1,
      rarity: "rare",
      points: 50,
      name: "Разлом",
      desc: "Победить Излома хотя бы 1 раз",
      target: 1,
      bossImg: "/assets/bosses/izlom-cut.webp",
      tierMark: "I",
      icon: "boss-izlom-1",
      value: s => s.bosses.izlom
    },
    {
      id: "izlom-10",
      category: "bosses",
      series: "boss-izlom",
      tier: 2,
      rarity: "legendary",
      points: 115,
      name: "Покоритель Излома",
      desc: "Победить 10 Изломов",
      target: 10,
      bossImg: "/assets/bosses/izlom-cut.webp",
      tierMark: "II",
      icon: "boss-izlom-2",
      value: s => s.bosses.izlom
    },
    {
      id: "boss-all",
      category: "bosses",
      rarity: "epic",
      points: 65,
      name: "Полный бестиарий",
      desc: "Победить каждого из 6 боссов хотя бы по разу",
      target: 6,
      unit: "боссов",
      icon: "bestiary",
      value: s => s.bossesTypesDefeated
    },

    /* ── Активности Зоны ── */
    {
      id: "stash-100",
      category: "activities",
      series: "stashes",
      tier: 1,
      rarity: "common",
      points: 10,
      name: "Кладоискатель",
      desc: "Найти 100 тайников",
      target: 100,
      icon: "stash-1",
      value: s => s.stashes
    },
    {
      id: "stash-1000",
      category: "activities",
      series: "stashes",
      tier: 2,
      rarity: "rare",
      points: 30,
      name: "Мародёр",
      desc: "Найти 1 000 тайников",
      target: 1000,
      icon: "stash-2",
      value: s => s.stashes
    },
    {
      id: "stash-5000",
      category: "activities",
      series: "stashes",
      tier: 3,
      rarity: "epic",
      points: 75,
      name: "Хранитель схронов",
      desc: "Найти 5 000 тайников",
      target: 5000,
      icon: "stash-3",
      value: s => s.stashes
    },
    {
      id: "tal-10",
      category: "activities",
      series: "talents",
      tier: 1,
      rarity: "common",
      points: 15,
      name: "Ученик Зоны",
      desc: "Изучить 10 талантов",
      target: 10,
      icon: "tal-1",
      value: s => s.talents
    },
    {
      id: "tal-40",
      category: "activities",
      series: "talents",
      tier: 2,
      rarity: "rare",
      points: 45,
      name: "Мастер ремесла",
      desc: "Изучить 40 талантов",
      target: 40,
      icon: "tal-2",
      value: s => s.talents
    },
    {
      id: "tal-100",
      category: "activities",
      series: "talents",
      tier: 3,
      rarity: "legendary",
      points: 100,
      name: "Гений Зоны",
      desc: "Изучить 100 талантов",
      target: 100,
      icon: "tal-3",
      value: s => s.talents
    },
    {
      id: "col-10",
      category: "activities",
      series: "collections",
      tier: 1,
      rarity: "common",
      points: 15,
      name: "Собиратель",
      desc: "Собрать 10 коллекций",
      target: 10,
      icon: "col-1",
      value: s => s.collections
    },
    {
      id: "col-50",
      category: "activities",
      series: "collections",
      tier: 2,
      rarity: "rare",
      points: 50,
      name: "Антиквар",
      desc: "Собрать 50 коллекций",
      target: 50,
      icon: "col-2",
      value: s => s.collections
    },
    {
      id: "col-120",
      category: "activities",
      series: "collections",
      tier: 3,
      rarity: "legendary",
      points: 95,
      name: "Хранитель артефактов",
      desc: "Собрать 120 коллекций",
      target: 120,
      icon: "col-3",
      value: s => s.collections
    },
    {
      id: "exp-25",
      category: "activities",
      series: "expeditions",
      tier: 1,
      rarity: "common",
      points: 15,
      name: "Разведчик",
      desc: "Совершить 25 вылазок",
      target: 25,
      icon: "exp-1",
      value: s => s.expeditions
    },
    {
      id: "exp-100",
      category: "activities",
      series: "expeditions",
      tier: 2,
      rarity: "rare",
      points: 45,
      name: "Проводник",
      desc: "Совершить 100 вылазок",
      target: 100,
      icon: "exp-2",
      value: s => s.expeditions
    },
    {
      id: "exp-200",
      category: "activities",
      series: "expeditions",
      tier: 3,
      rarity: "epic",
      points: 85,
      name: "Первопроходец",
      desc: "Совершить 200 вылазок",
      target: 200,
      icon: "exp-3",
      value: s => s.expeditions
    },
    {
      id: "def-25",
      category: "activities",
      series: "defense",
      tier: 1,
      rarity: "common",
      points: 15,
      name: "Часовой",
      desc: "Провести 25 защит лагеря",
      target: 25,
      icon: "def-1",
      value: s => s.defense
    },
    {
      id: "def-100",
      category: "activities",
      series: "defense",
      tier: 2,
      rarity: "rare",
      points: 45,
      name: "Защитник периметра",
      desc: "Провести 100 защит лагеря",
      target: 100,
      icon: "def-2",
      value: s => s.defense
    },
    {
      id: "def-200",
      category: "activities",
      series: "defense",
      tier: 3,
      rarity: "epic",
      points: 85,
      name: "Несокрушимый щит",
      desc: "Провести 200 защит лагеря",
      target: 200,
      icon: "def-3",
      value: s => s.defense
    }
  ];

  /* расчёт всех достижений игрока: статусы unlocked / in_progress / locked, очки, сводка */
  function evaluate(player, ctx) {
    const stats = extractStats(player || {}, ctx || {});

    /* сначала вычисляем сырой факт выполнения каждого достижения */
    const raw = DEFINITIONS.map(def => {
      const current = Number(def.value(stats)) || 0;
      let unlocked = false;
      let pct = 0;

      if (def.kind === "rank") {
        unlocked = Boolean(def.rankCheck(stats));
        pct = unlocked ? 100 : 0;
      } else if (def.kind === "boolean") {
        unlocked = current >= 1;
        pct = unlocked ? 100 : 0;
      } else {
        unlocked = current >= def.target;
        pct = unlocked ? 100 : Math.min(99, Math.floor((Math.max(0, current) / def.target) * 100));
      }

      return { def, current, unlocked, pct };
    });

    /* определяем активную следующую ступень в каждой цепочке (series), чтобы «В процессе» показывало
       именно ближайшие достижимые цели, а далёкие будущие ступени оставались в «Не получено» */
    const nextInSeries = {};
    for (const item of raw) {
      const ser = item.def.series;
      if (!ser || item.unlocked) continue;
      if (nextInSeries[ser] === undefined || item.def.tier < nextInSeries[ser]) {
        nextInSeries[ser] = item.def.tier;
      }
    }

    let earnedPoints = 0;
    let totalPoints = 0;
    let unlockedCount = 0;
    let inProgressCount = 0;
    let lockedCount = 0;

    const items = raw.map(item => {
      const { def, current, unlocked, pct } = item;
      totalPoints += def.points;
      let status = "locked";

      if (unlocked) {
        status = "unlocked";
        earnedPoints += def.points;
        unlockedCount++;
      } else if (def.kind === "rank") {
        /* для рейтингов: если игрок уже в топ-100, следующий шаг (топ-10) - в процессе; если в топ-10, шаг #1 - в процессе */
        const isNext = def.series ? nextInSeries[def.series] === def.tier : true;
        if (isNext && stats.bestRank !== null && stats.bestRank <= def.target * 10) {
          status = "in_progress";
          inProgressCount++;
        } else {
          lockedCount++;
        }
      } else if (def.kind === "boolean") {
        lockedCount++;
      } else if (current > 0) {
        const isNext = !def.series || nextInSeries[def.series] === def.tier;
        if (isNext) {
          status = "in_progress";
          inProgressCount++;
        } else {
          lockedCount++;
        }
      } else {
        lockedCount++;
      }

      const rarityMeta = RARITIES[def.rarity] || RARITIES.common;
      return {
        id: def.id,
        category: def.category,
        series: def.series || null,
        tier: def.tier || 1,
        rarity: def.rarity,
        rarityLabel: rarityMeta.label,
        color: rarityMeta.color,
        bg: rarityMeta.bg,
        points: def.points,
        name: def.name,
        desc: def.desc,
        kind: def.kind || "numeric",
        target: def.target,
        unit: def.unit || "",
        current,
        bestRank: def.kind === "rank" ? stats.bestRank : null,
        pct,
        status,
        icon: def.icon,
        bossImg: def.bossImg || null,
        tierMark: def.tierMark || ""
      };
    });

    const pctPoints = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const pctCount = items.length ? Math.round((unlockedCount / items.length) * 100) : 0;

    return {
      items,
      stats,
      summary: {
        earnedPoints,
        totalPoints,
        pctPoints,
        pctCount,
        rankTitle: scoreRank(pctPoints),
        total: items.length,
        unlocked: unlockedCount,
        inProgress: inProgressCount,
        locked: lockedCount
      }
    };
  }

  /* фильтрация и сортировка списка достижений */
  const STATUS_ORDER = { in_progress: 0, unlocked: 1, locked: 2 };
  function filterItems(items, statusFilter, categoryFilter) {
    const out = items.filter(x => {
      if (statusFilter && statusFilter !== "all" && x.status !== statusFilter) return false;
      if (categoryFilter && categoryFilter !== "all" && x.category !== categoryFilter) return false;
      return true;
    });
    return out.sort((a, b) => {
      if (statusFilter === "unlocked") return b.points - a.points || a.name.localeCompare(b.name, "ru");
      if (statusFilter === "in_progress") return b.pct - a.pct || b.points - a.points;
      if (statusFilter === "locked") return a.points - b.points || a.name.localeCompare(b.name, "ru");
      /* «Все»: сначала в процессе (ближайшие сверху), затем полученные (самые ценные сверху), затем закрытые */
      if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (a.status === "in_progress") return b.pct - a.pct || b.points - a.points;
      if (a.status === "unlocked") return b.points - a.points || a.name.localeCompare(b.name, "ru");
      return a.points - b.points || a.name.localeCompare(b.name, "ru");
    });
  }

  /* уникальные векторные символы (viewBox 0 0 64 64) для всех не-боссовых достижений */
  const GLYPHS = {
    /* Уровень: от одного шеврона до легендарного герба с короной */
    "lvl-1":
      '<path d="M18 37l14-12 14 12" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="32" cy="43" r="3" fill="currentColor"/>',
    "lvl-2":
      '<path d="M17 31l15-12 15 12M17 42l15-12 15 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    "lvl-3":
      '<path d="M32 14l4.6 9.5 10.4 1.5-7.5 7.3 1.8 10.4L32 37.8l-9.3 4.9 1.8-10.4-7.5-7.3 10.4-1.5z" fill="currentColor" opacity=".92"/><path d="M21 47l11-4 11 4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
    "lvl-4":
      '<polygon points="32,12 48,22 44,44 32,52 20,44 16,22" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="2.4"/><path d="M32 19l3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.2-7.3-3.8-7.3 3.8 1.4-8.2-5.9-5.8 8.2-1.2z" fill="currentColor"/>',
    "lvl-5":
      '<path d="M15 26l6 15h22l6-15-9 7-8-13-8 13z" fill="currentColor"/><rect x="19" y="44" width="26" height="4.5" rx="2" fill="currentColor"/><circle cx="32" cy="15" r="2.8" fill="#fff"/>',

    /* Время в Зоне */
    "time-1":
      '<circle cx="32" cy="34" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 26v8l6 4M26 16h12M32 16v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>',
    "time-2":
      '<rect x="16" y="19" width="32" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M16 28h32M24 15v7M40 15v7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><text x="32" y="42" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="13" font-weight="700" fill="currentColor">30</text>',
    "time-3":
      '<path d="M21 16h22M21 48h22M24 16c0 9 8 11 8 16s-8 7-8 16M40 16c0 9-8 11-8 16s8 7 8 16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" fill="none"/><path d="M27 44h10l-5-7z" fill="currentColor"/>',
    "time-4":
      '<circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="2.6"/><polygon points="32,19 36,32 32,45 28,32" fill="currentColor" opacity=".88"/><circle cx="32" cy="32" r="3" fill="#0c1218"/><path d="M32 12v4M32 48v4M12 32h4M48 32h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    "time-5":
      '<circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 3"/><circle cx="32" cy="32" r="12" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="2.2"/><path d="M32 23v9l7 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M26 12l6-3 6 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>',

    /* Репутация */
    "rep-1":
      '<path d="M20 38c0-6 5-10 12-10s12 4 12 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="22" r="6" fill="currentColor"/><path d="M23 45h18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    "rep-2":
      '<path d="M32 15l13 7v11c0 9-5.5 14.5-13 17-7.5-2.5-13-8-13-17V22z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.6"/><path d="M25 32l5 5 10-10" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    "rep-3":
      '<path d="M18 42c-3-8-1-17 6-22M46 42c3-8 1-17-6-22" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M32 18l3.5 7 7.8 1.2-5.6 5.5 1.3 7.8L32 35.8l-7 3.7 1.3-7.8-5.6-5.5 7.8-1.2z" fill="currentColor"/>',
    "rep-4":
      '<circle cx="32" cy="32" r="15" fill="currentColor" opacity=".16" stroke="currentColor" stroke-width="2.4"/><path d="M32 14l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="currentColor"/>',
    "rep-5":
      '<path d="M32 11l5 11 12 2-8.5 8 2 12L32 38.5 21.5 44l2-12-8.5-8 12-2z" fill="currentColor"/><circle cx="32" cy="30" r="5" fill="#10151c"/><path d="M20 49h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',

    /* Рейтинги и позывной */
    "rank-100":
      '<path d="M22 15h20l-4 12H26z" fill="currentColor" opacity=".5"/><circle cx="32" cy="36" r="13" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.6"/><text x="32" y="40.5" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="11.5" font-weight="700" fill="currentColor">100</text>',
    "rank-10":
      '<path d="M21 14h22l-5 12H26z" fill="currentColor" opacity=".75"/><circle cx="32" cy="36" r="13" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="2.8"/><text x="32" y="41" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="14" font-weight="700" fill="currentColor">10</text>',
    "rank-1":
      '<path d="M20 17h24v10c0 7-5 12-12 14-7-2-12-7-12-14z" fill="currentColor"/><path d="M20 20h-5c0 6 2 9 5 10M44 20h5c0 6-2 9-5 10M32 41v7M24 48h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" fill="none"/><text x="32" y="31" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="13" font-weight="700" fill="#181205">1</text>',
    "multi-3":
      '<polygon points="32,14 48,44 16,44" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><circle cx="32" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="39" r="3" fill="currentColor"/><circle cx="40" cy="39" r="3" fill="currentColor"/>',
    "multi-7":
      '<polygon points="32,12 45,18 50,32 43,45 32,50 21,45 14,32 19,18" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.4"/><text x="32" y="38" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="20" font-weight="700" fill="currentColor">7</text>',
    dogtag:
      '<rect x="21" y="16" width="22" height="32" rx="6" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="2.6"/><circle cx="32" cy="22" r="2.2" fill="currentColor"/><path d="M26 31h12M26 37h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',

    /* Группировки */
    "fac-join":
      '<path d="M22 15v34" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M24 17h20l-4 8 4 8H24z" fill="currentColor"/>',
    "fac-leave":
      '<path d="M20 17h14v30H20z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M31 32h16M41 26l6 6-6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    "fac-nomad":
      '<circle cx="19" cy="42" r="4" fill="currentColor"/><circle cx="32" cy="22" r="4" fill="currentColor"/><circle cx="45" cy="42" r="4" fill="currentColor"/><path d="M22 39l8-14M35 25l8 14M24 42h16" stroke="currentColor" stroke-width="2.4" stroke-dasharray="3 2.5" fill="none"/>',
    "fac-frequent":
      '<path d="M20 26a14 14 0 0 1 22-4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M40 16l4 7-8 .5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M44 38a14 14 0 0 1-22 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M24 48l-4-7 8-.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="32" cy="32" r="5" fill="currentColor"/>',
    "fac-cmd":
      '<rect x="19" y="16" width="26" height="32" rx="4" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.6"/><path d="M32 22l2.6 5.2 5.8.8-4.2 4 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4 5.8-.8z" fill="currentColor"/><path d="M23 42h18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    "fac-leader":
      '<path d="M16 39l4-17 12 9 12-9 4 17z" fill="currentColor"/><rect x="17" y="42" width="30" height="5" rx="2" fill="currentColor"/><circle cx="32" cy="18" r="3.2" fill="currentColor"/>',
    "stay-1":
      '<path d="M32 14l14 6v12c0 9.5-6 15.5-14 18.5C24 47.5 18 41.5 18 32V20z" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="2.6"/><text x="32" y="38" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="16" font-weight="700" fill="currentColor">7</text>',
    "stay-2":
      '<path d="M32 14l14 6v12c0 9.5-6 15.5-14 18.5C24 47.5 18 41.5 18 32V20z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.6"/><text x="32" y="38" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="15" font-weight="700" fill="currentColor">14</text>',
    "stay-3":
      '<path d="M32 14l15 6v12c0 10-6.5 16-15 19-8.5-3-15-9-15-19V20z" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="2.8"/><text x="32" y="38" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="15" font-weight="700" fill="currentColor">30</text>',
    "stay-4":
      '<path d="M32 13l15 6v13c0 10-6.5 16-15 19-8.5-3-15-9-15-19V19z" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="2.8"/><path d="M23 23h18" stroke="currentColor" stroke-width="2"/><text x="32" y="40" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="14" font-weight="700" fill="currentColor">90</text>',
    "stay-5":
      '<path d="M32 12l16 6.5V32c0 10.5-7 16.5-16 20-9-3.5-16-9.5-16-20V18.5z" fill="currentColor" opacity=".28" stroke="currentColor" stroke-width="3"/><text x="32" y="39" text-anchor="middle" font-family="Oswald,Arial,sans-serif" font-size="12.5" font-weight="700" fill="currentColor">180</text>',

    /* Боссы: общие + бестиарий */
    "boss-1": '<path d="M22 18c2 12 6 21 10 28 4-7 8-16 10-28-4 4-7 6-10 6s-6-2-10-6z" fill="currentColor"/>',
    "boss-2":
      '<circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="2.8"/><circle cx="32" cy="32" r="4" fill="currentColor"/><path d="M32 13v7M32 44v7M13 32h7M44 32h7" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    "boss-3":
      '<path d="M18 46L44 18M46 46L20 18M17 40l7 7M47 40l-7 7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none"/>',
    "boss-4":
      '<path d="M20 31c0-8 5.2-14 12-14s12 6 12 14c0 5-2.5 8.5-5 10v5H25v-5c-2.5-1.5-5-5-5-10z" fill="currentColor" opacity=".88"/><circle cx="27" cy="31" r="2.7" fill="#0d131a"/><circle cx="37" cy="31" r="2.7" fill="#0d131a"/><path d="M29 42v4M32 42v4M35 42v4" stroke="#0d131a" stroke-width="1.8"/>',
    "boss-5":
      '<path d="M16 20l6 6 10-12 10 12 6-6-4 24H20z" fill="currentColor" opacity=".92"/><circle cx="27" cy="34" r="2.6" fill="#171106"/><circle cx="37" cy="34" r="2.6" fill="#171106"/><path d="M24 47h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    bestiary:
      '<circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="32" cy="19" r="3" fill="currentColor"/><circle cx="43" cy="25.5" r="3" fill="currentColor"/><circle cx="43" cy="38.5" r="3" fill="currentColor"/><circle cx="32" cy="45" r="3" fill="currentColor"/><circle cx="21" cy="38.5" r="3" fill="currentColor"/><circle cx="21" cy="25.5" r="3" fill="currentColor"/><circle cx="32" cy="32" r="4.5" fill="currentColor"/>',

    /* Тайники */
    "stash-1":
      '<rect x="16" y="25" width="32" height="20" rx="3" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.6"/><path d="M16 32h32M29 32v5h6v-5" stroke="currentColor" stroke-width="2.6" fill="none"/>',
    "stash-2":
      '<path d="M15 26l4-7h26l4 7v19a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="2.6"/><path d="M15 28h34M32 28v8" stroke="currentColor" stroke-width="2.8"/><circle cx="32" cy="37" r="2.6" fill="currentColor"/>',
    "stash-3":
      '<path d="M14 27l5-9h26l5 9v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="currentColor" opacity=".28" stroke="currentColor" stroke-width="2.6"/><path d="M32 22l4 8-4 8-4-8z" fill="currentColor"/><path d="M21 15l3-3M43 15l-3-3M32 13v-3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',

    /* Таланты */
    "tal-1":
      '<circle cx="32" cy="32" r="6" fill="currentColor"/><circle cx="20" cy="22" r="3.5" fill="currentColor" opacity=".75"/><circle cx="44" cy="22" r="3.5" fill="currentColor" opacity=".75"/><path d="M23 24l6 5M41 24l-6 5" stroke="currentColor" stroke-width="2.4"/>',
    "tal-2":
      '<circle cx="32" cy="18" r="4" fill="currentColor"/><circle cx="19" cy="34" r="4" fill="currentColor"/><circle cx="45" cy="34" r="4" fill="currentColor"/><circle cx="32" cy="46" r="4.5" fill="currentColor"/><path d="M32 22v20M22 32l8-11M42 32l-8-11M22 36l7 8M42 36l-7 8" stroke="currentColor" stroke-width="2.2"/>',
    "tal-3":
      '<path d="M32 13l15 9v18l-15 9-15-9V22z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.4"/><path d="M32 19l8 13-8 13-8-13z" fill="currentColor"/><circle cx="32" cy="32" r="3.5" fill="#181205"/>',

    /* Коллекции */
    "col-1":
      '<path d="M32 16l12 16-12 16-12-16z" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M24 32h16" stroke="currentColor" stroke-width="2"/>',
    "col-2":
      '<rect x="17" y="18" width="13" height="13" rx="2.5" fill="currentColor" opacity=".8"/><rect x="34" y="18" width="13" height="13" rx="2.5" fill="currentColor" opacity=".45"/><rect x="17" y="34" width="13" height="13" rx="2.5" fill="currentColor" opacity=".45"/><rect x="34" y="34" width="13" height="13" rx="2.5" fill="currentColor" opacity=".9"/>',
    "col-3":
      '<circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-dasharray="5 3"/><path d="M32 17l9 15-9 15-9-15z" fill="currentColor"/><circle cx="32" cy="32" r="4" fill="#171106"/>',

    /* Вылазки */
    "exp-1":
      '<path d="M16 44l10-22 10 14 12-18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="48" cy="18" r="3.2" fill="currentColor"/>',
    "exp-2":
      '<circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M22 42l6-14 14-6-6 14z" fill="currentColor"/>',
    "exp-3":
      '<path d="M14 45l11-21 8 11 8-16 9 26z" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M41 19v-7l7 3.5-7 3.5" fill="currentColor"/>',

    /* Защита лагеря */
    "def-1":
      '<path d="M32 15l14 5v12c0 9-6 14.5-14 17-8-2.5-14-8-14-17V20z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.8"/><path d="M32 23v16M24 31h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    "def-2":
      '<path d="M18 46V24h6v5h5v-5h6v5h5v-5h6v22z" fill="currentColor" opacity=".24" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M28 46v-9h8v9" stroke="currentColor" stroke-width="2.4"/>',
    "def-3":
      '<path d="M32 12l16 6v14c0 10-6.5 16.5-16 20-9.5-3.5-16-10-16-20V18z" fill="currentColor" opacity=".28" stroke="currentColor" stroke-width="2.8"/><path d="M24 27l8-5 8 5v7c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10z" fill="currentColor"/>'
  };

  /* рендер уникальной картинки-значка достижения (HTML-строка) */
  function badgeHtml(item) {
    const cls = "pc-ach-badge r-" + item.rarity + " st-" + item.status;
    if (item.bossImg) {
      return (
        '<div class="' +
        cls +
        ' has-art" aria-hidden="true">' +
        '<img src="' +
        item.bossImg +
        '" alt="" width="54" height="54" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
        (item.tierMark ? '<span class="pc-ach-tier">' + item.tierMark + "</span>" : "") +
        "</div>"
      );
    }
    const glyph = GLYPHS[item.icon] || GLYPHS["lvl-1"];
    return (
      '<div class="' +
      cls +
      '" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" width="54" height="54" focusable="false">' +
      '<path class="pc-ach-plate" d="M10 6h44a4 4 0 0 1 4 4v26c0 12-10.5 20-26 25C16.5 56 6 48 6 36V10a4 4 0 0 1 4-4z"/>' +
      '<path class="pc-ach-stitch" d="M13 11h38v24c0 9-8 15-19 19.5C21 50 13 44 13 35z"/>' +
      '<g class="pc-ach-glyph">' +
      glyph +
      "</g>" +
      "</svg>" +
      "</div>"
    );
  }

  /* форматирование распространённости достижения: «4,8% игроков (141)» */
  function formatOwnership(count, total) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const tot = Math.max(0, Math.floor(Number(total) || 0));
    const fmtNum = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    if (!tot) return { pct: 0, pctText: "0%", count: n, total: 0, label: "0% игроков (" + fmtNum(n) + ")" };
    const pct = Math.min(100, (n / tot) * 100);
    let pctText;
    if (n === 0) pctText = "0%";
    else if (n >= tot) pctText = "100%";
    else if (pct < 0.1) pctText = "<0,1%";
    else {
      const rounded = Math.round(pct * 10) / 10;
      pctText = (rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1).replace(".", ",")) + "%";
    }
    return {
      pct,
      pctText,
      count: n,
      total: tot,
      label: pctText + " игроков (" + fmtNum(n) + ")"
    };
  }

  const api = {
    CATEGORIES,
    RARITIES,
    DEFINITIONS,
    GLYPHS,
    parseZoneDays,
    analyzeFactions,
    extractStats,
    evaluate,
    filterItems,
    badgeHtml,
    scoreRank,
    formatOwnership
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ZoneAchievements = api;
})(typeof window !== "undefined" ? window : null);
