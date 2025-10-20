// Fullscreen viewer: business-days countdown to target, IST-aware
// - Loads config + themes (with embedded fallbacks in viewer.html)
// - Excludes Sundays and holidays; pauses on excluded days
// - Uses Effects (assets/js/effects.js) for visuals

(function () {
  const IST_OFFSET_MIN = 5 * 60 + 30; // +05:30

  // DOM
  const elDays = document.getElementById('daysCount');
  const elStatus = document.getElementById('status');
  const elQuote = document.getElementById('quote');
  const elEffects = document.getElementById('effects');
  const elLights = document.getElementById('lights');

  // State
  let config = null;
  let themes = null;
  let holidaySet = new Set();
  let holidayMap = new Map(); // date -> { name, theme }
  let quotesByDate = {};
  let lastThemeKey = null;
  let lastDaypart = null;

  // IST utilities
  function nowInIST() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + IST_OFFSET_MIN * 60000);
    return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), d: ist.getUTCDate(), h: ist.getUTCHours(), toDate: () => ist };
  }
  function fmtYMD(y, m, d) { return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  function dayOfWeek(y, m, d) { return new Date(Date.UTC(y, m, d)).getUTCDay(); }
  function addDays(ymd, n) { const dt = new Date(Date.UTC(ymd.y, ymd.m, ymd.d)); dt.setUTCDate(dt.getUTCDate()+n); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() }; }
  function isHoliday(ymd) { return holidaySet.has(fmtYMD(ymd.y, ymd.m, ymd.d)); }

  // Business-day count (inclusive; excludes Sundays and holidays)
  function computeBusinessDays(fromYMD, toYMD) {
    const fromMs = Date.UTC(fromYMD.y, fromYMD.m, fromYMD.d);
    const toMs = Date.UTC(toYMD.y, toYMD.m, toYMD.d);
    if (fromMs > toMs) return 0;
    let count = 0; let cur = { ...fromYMD };
    while (true) {
      const dow = dayOfWeek(cur.y, cur.m, cur.d);
      if (dow !== 0 && !isHoliday(cur)) count += 1;
      if (cur.y === toYMD.y && cur.m === toYMD.m && cur.d === toYMD.d) break;
      cur = addDays(cur, 1);
    }
    return count;
  }

  // Theming
  function applyTheme(themeKey) {
    if (!themes) return;
    const root = document.documentElement;
    const base = themes.base || {};
    const current = themes[themeKey] || {};
    for (const [k, v] of Object.entries(base)) root.style.setProperty(k, v);
    for (const [k, v] of Object.entries(current)) root.style.setProperty(k, v);
    document.body.dataset.theme = themeKey;
  }
  function resolveThemeKey(today) {
    const dstr = fmtYMD(today.y, today.m, today.d);
    const h = holidayMap.get(dstr);
    if (h) return h.theme;
    if (dayOfWeek(today.y, today.m, today.d) === 0) return 'sunday';
    return 'base';
  }

  // Quotes
  function quoteOfTheDay(today, quotes) {
    if (!quotes || !quotes.length) return '';
    const base = Math.floor(Date.UTC(today.y, today.m, today.d) / 86400000);
    const idx = Math.abs(base) % quotes.length;
    return quotes[idx];
  }
  function quoteForDate(today, quotesMap, fallbackQuotes) {
    const dstr = fmtYMD(today.y, today.m, today.d);
    if (quotesMap && Object.prototype.hasOwnProperty.call(quotesMap, dstr)) return quotesMap[dstr];
    return quoteOfTheDay(today, fallbackQuotes);
  }

  // Query handling
  function getQuery() {
    const q = new URLSearchParams(location.search);
    const today = q.get('today');
    const preview = q.get('preview'); // sunday | diwali | karnataka | christmas | newyear
    const daypart = q.get('daypart'); // morning | noon | evening | night (testing)
    return { today, preview, daypart };
  }
  function parseYMD(str) { const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str || ''); if (!m) return null; return { y: +m[1], m: +m[2] - 1, d: +m[3] }; }

  // Main recompute
  function recompute() {
    if (!config) return;
    const { today: qToday, preview, daypart: qPart } = getQuery();
    const today = qToday ? (parseYMD(qToday) || nowInIST()) : nowInIST();
    const [ty, tm, td] = config.target.split('-').map(Number);
    const target = { y: ty, m: tm - 1, d: td };

    // Next business day ≥ today
    let nextBiz = { y: today.y, m: today.m, d: today.d };
    while (true) {
      const dow = dayOfWeek(nextBiz.y, nextBiz.m, nextBiz.d);
      if (dow !== 0 && !isHoliday(nextBiz)) break;
      nextBiz = addDays(nextBiz, 1);
      if (Date.UTC(nextBiz.y, nextBiz.m, nextBiz.d) > Date.UTC(target.y, target.m, target.d)) break;
    }

    // Count and pause on excluded days
    let days = computeBusinessDays(nextBiz, target);
    const todayMs = Date.UTC(today.y, today.m, today.d);
    const tgtMs = Date.UTC(target.y, target.m, target.d);
    const excluded = preview ? true : (dayOfWeek(today.y, today.m, today.d) === 0 || isHoliday(today));
    if (excluded && todayMs <= tgtMs) days += 1;
    elDays.textContent = String(days);

    // Theme + status
    const inferredKey = resolveThemeKey(today);
    const themeKey = preview || inferredKey;
    applyTheme(themeKey);
    const names = { diwali: 'Diwali', karnataka: 'Karnataka Rajyotsava', christmas: 'Christmas', newyear: 'New Year', sunday: 'Sunday', base: 'Counting active' };
    elStatus.textContent = themeKey === 'base' ? names.base : (themeKey === 'sunday' ? names.sunday : `Holiday: ${names[themeKey] || 'Holiday'}`);

    // Daypart visuals
    const istNow = nowInIST();
    const daypart = (qPart && ['morning','noon','evening','night'].includes(qPart)) ? qPart : getDaypart(istNow.h);
    updateDaypart(daypart);
    updateEffects(themeKey, daypart);

    // Quote
    elQuote.textContent = quoteForDate(today, quotesByDate, config.quotes);

    // Fit number
    autosizeDays();
  }

  // Load JSON with fallback script tag
  async function loadJSON(url, fallbackId) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (e) {
      const el = document.getElementById(fallbackId);
      if (!el) throw e;
      return JSON.parse(el.textContent || '{}');
    }
  }

  // Boot
  async function boot() {
    [config, themes] = await Promise.all([
      loadJSON('../data/config.json', 'default-config'),
      loadJSON('../data/themes.json', 'default-themes')
    ]);
    holidaySet = new Set((config.holidays || []).map(h => h.date));
    holidayMap = new Map((config.holidays || []).map(h => [h.date, { name: h.name, theme: h.theme }]));
    quotesByDate = config.quotesByDate || {};
    recompute();
    setInterval(recompute, 30_000);
    window.addEventListener('resize', autosizeDays);
  }
  boot().catch(err => { console.error('Boot error:', err); elStatus.textContent = 'Failed to load configuration'; });

  // Fit big number to container (~85% width)
  function autosizeDays() {
    const wrap = document.querySelector('.days-wrap');
    if (!wrap) return;
    const W = wrap.clientWidth; const H = wrap.clientHeight; const text = elDays.textContent || '0';
    let meas = document.getElementById('measure-days');
    if (!meas) { meas = document.createElement('span'); meas.id = 'measure-days'; meas.style.position = 'absolute'; meas.style.left = '-9999px'; meas.style.top = '0'; meas.style.whiteSpace = 'nowrap'; meas.style.fontFamily = getComputedStyle(elDays).fontFamily; meas.style.fontWeight = getComputedStyle(elDays).fontWeight; document.body.appendChild(meas); }
    meas.style.fontSize = '100px'; meas.textContent = text;
    const widthAt100 = meas.getBoundingClientRect().width || 1; const perPx = widthAt100 / 100; const targetWidth = Math.max(200, W * 0.85);
    let fs = Math.floor(targetWidth / perPx); fs = Math.min(fs, Math.floor(H * 0.9)); fs = Math.max(60, Math.min(fs, 3200)); elDays.style.fontSize = fs + 'px';
  }

  // Effects wiring (use global Effects from assets/js/effects.js)
  function clearEffects() { if (elEffects) elEffects.innerHTML = ''; }
  function updateEffects(themeKey, daypart) {
    if (!elEffects || !window.Effects) return;
    if (lastThemeKey === themeKey && lastDaypart === daypart) return;
    lastThemeKey = themeKey; lastDaypart = daypart;
    clearEffects(); if (elLights) elLights.innerHTML = '';
    if (themeKey === 'christmas') Effects.buildSnow(elEffects, 60);
    else if (themeKey === 'newyear') Effects.buildConfetti(elEffects, 120);
    else if (themeKey === 'karnataka') Effects.buildPetals(elEffects, 48);
    else if (themeKey === 'diwali') Effects.buildLights(elLights, 24);
    if (themeKey === 'base') Effects.buildDaypartSprites(elEffects, daypart, 6);
    else if (themeKey === 'sunday') Effects.buildDaypartSprites(elEffects, daypart, 10);
  }

  // Daypart helpers
  function getDaypart(h) { if (h >= 19 || h < 6) return 'night'; if (h < 11) return 'morning'; if (h < 16) return 'noon'; return 'evening'; }
  function updateDaypart(dp) { if (document.body.dataset.daypart !== dp) document.body.dataset.daypart = dp; }
})();

