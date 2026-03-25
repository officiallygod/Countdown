// Fullscreen viewer: business-days countdown to target, IST-aware
// - Loads config + themes (with embedded fallbacks in viewer.html)
// - Merges config holidays with localStorage custom holidays (matches main page)
// - Excludes Sundays and holidays; pauses on excluded days
// - Uses Effects (assets/js/effects.js) for visuals

(function () {
	const IST_OFFSET_MIN = 5 * 60 + 30; // +05:30
	const MODE_KEY = 'countdown-mode';

	// DOM
	const elDays = document.getElementById('daysCount');
	const elStatus = document.getElementById('status');
	const elQuote = document.getElementById('quote');
	const elEffects = document.getElementById('effects');
	const elLights = document.getElementById('lights');
	const elModeToggle = document.getElementById('viewerModeToggle');
	const elModeIcon = document.getElementById('viewerModeIcon');
	const elModeLabel = document.getElementById('viewerModeLabel');

	// State
	let config = null;
	let themes = null;
	let holidaySet = new Set();
	let holidayMap = new Map(); // date -> { name, theme }
	let quotesByDate = {};
	let lastThemeKey = null;

	// Quote cycling state
	let allQuotes = [];
	let currentQuoteIdx = -1;

	const DARK_OVERRIDES = {
		default: {
			'--bg-1': '#0f172a',
			'--bg-2': '#111827',
			'--ink': '#e2e8f0',
			'--muted': '#cbd5e1',
			'--panel-bg': 'rgba(15, 23, 42, 0.78)',
			'--panel-border': 'rgba(255, 255, 255, 0.12)',
		},
		base: {
			'--bg-1': '#0f172a',
			'--bg-2': '#111827',
			'--ink': '#e2e8f0',
			'--muted': '#cbd5e1',
			'--panel-bg': 'rgba(15, 23, 42, 0.78)',
			'--panel-border': 'rgba(255, 255, 255, 0.12)',
			'--accent-1': '#38bdf8',
			'--accent-2': '#a78bfa',
		},
		sunday: { '--bg-1': '#1d1120', '--bg-2': '#271525' },
		diwali: { '--bg-1': '#1c1608', '--bg-2': '#2a1d10' },
		karnataka: { '--bg-1': '#1f1610', '--bg-2': '#2a1412' },
		christmas: { '--bg-1': '#152026', '--bg-2': '#0f172a' },
		newyear: { '--bg-1': '#141825', '--bg-2': '#0f1221' },
	};

	// IST utilities
	function nowInIST() {
		const now = new Date();
		const utc = now.getTime() + now.getTimezoneOffset() * 60000;
		const ist = new Date(utc + IST_OFFSET_MIN * 60000);
		return {
			y: ist.getUTCFullYear(),
			m: ist.getUTCMonth(),
			d: ist.getUTCDate(),
		};
	}
	function fmtYMD(y, m, d) {
		return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	}
	function dayOfWeek(y, m, d) {
		return new Date(Date.UTC(y, m, d)).getUTCDay();
	}
	function addDays(ymd, n) {
		const dt = new Date(Date.UTC(ymd.y, ymd.m, ymd.d));
		dt.setUTCDate(dt.getUTCDate() + n);
		return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
	}
	function isHoliday(ymd) {
		return holidaySet.has(fmtYMD(ymd.y, ymd.m, ymd.d));
	}

	// Load custom holidays from localStorage (mirrors main.js)
	function loadLocalHolidays() {
		try {
			const raw = localStorage.getItem('customHolidays');
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.filter((x) => x && typeof x.date === 'string');
		} catch {
			return [];
		}
	}

	function getStoredMode() {
		const stored = localStorage.getItem(MODE_KEY);
		return stored === 'dark' || stored === 'light' ? stored : null;
	}

	function currentMode() {
		const stored = getStoredMode();
		if (stored) return stored;
		const prefersDark =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-color-scheme: dark)').matches;
		return prefersDark ? 'dark' : 'light';
	}

	function updateModeToggle(mode) {
		if (!elModeToggle) return;
		const isDark = mode === 'dark';
		elModeToggle.setAttribute('aria-pressed', String(isDark));
		if (elModeIcon) elModeIcon.textContent = isDark ? '☀️' : '🌙';
		if (elModeLabel) elModeLabel.textContent = isDark ? 'Light mode' : 'Dark mode';
	}

	function applyMode(mode, opts = {}) {
		const next = mode === 'dark' ? 'dark' : 'light';
		document.documentElement.dataset.mode = next;
		if (!opts.skipSave) {
			localStorage.setItem(MODE_KEY, next);
		}
		updateModeToggle(next);
		if (themes && lastThemeKey) {
			applyTheme(lastThemeKey, next);
		}
	}

	function setupModeListeners() {
		const stored = getStoredMode();
		const initial = stored || currentMode();
		applyMode(initial, { skipSave: !stored });
		if (elModeToggle) {
			elModeToggle.addEventListener('click', () => {
				const next = currentMode() === 'dark' ? 'light' : 'dark';
				applyMode(next);
				recompute();
			});
		}
		if (typeof window.matchMedia === 'function') {
			const mq = window.matchMedia('(prefers-color-scheme: dark)');
			if (mq && typeof mq.addEventListener === 'function') {
				mq.addEventListener('change', (e) => {
					if (getStoredMode()) return;
					applyMode(e.matches ? 'dark' : 'light', { skipSave: true });
					recompute();
				});
			}
		}
	}

	// Business-day count (inclusive; excludes Sundays and holidays)
	function computeBusinessDays(fromYMD, toYMD) {
		const fromMs = Date.UTC(fromYMD.y, fromYMD.m, fromYMD.d);
		const toMs = Date.UTC(toYMD.y, toYMD.m, toYMD.d);
		if (fromMs > toMs) return 0;
		let count = 0;
		let cur = { ...fromYMD };
		while (true) {
			const dow = dayOfWeek(cur.y, cur.m, cur.d);
			if (dow !== 0 && !isHoliday(cur)) count += 1;
			if (cur.y === toYMD.y && cur.m === toYMD.m && cur.d === toYMD.d) break;
			cur = addDays(cur, 1);
		}
		return count;
	}

	// Theming
	function applyTheme(themeKey, mode) {
		if (!themes) return;
		lastThemeKey = themeKey;
		const root = document.documentElement;
		const base = themes.base || {};
		const current = themes[themeKey] || {};
		const palette = { ...base, ...current };
		const overlay =
			mode === 'dark'
				? DARK_OVERRIDES[themeKey] || DARK_OVERRIDES.default || DARK_OVERRIDES.base
				: null;
		const finalPalette = overlay ? { ...palette, ...overlay } : palette;
		for (const [k, v] of Object.entries(finalPalette)) root.style.setProperty(k, v);
		document.body.dataset.theme = themeKey;
		document.documentElement.dataset.mode = mode === 'dark' ? 'dark' : 'light';
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
		if (quotesMap && Object.prototype.hasOwnProperty.call(quotesMap, dstr))
			return quotesMap[dstr];
		return quoteOfTheDay(today, fallbackQuotes);
	}

	// Interactive quote cycling
	function initQuoteIndex(today) {
		if (currentQuoteIdx === -1) {
			const base = Math.floor(Date.UTC(today.y, today.m, today.d) / 86400000);
			currentQuoteIdx = Math.abs(base) % (allQuotes.length || 1);
		}
	}
	function showQuote(text) {
		if (!elQuote) return;
		elQuote.classList.remove('quote-fade');
		void elQuote.offsetWidth; // Trigger reflow to restart animation
		elQuote.classList.add('quote-fade');
		elQuote.textContent = text;
	}
	function cycleQuote() {
		if (!allQuotes.length) return;
		currentQuoteIdx = (currentQuoteIdx + 1) % allQuotes.length;
		showQuote(allQuotes[currentQuoteIdx]);
	}

	// Query handling
	function getQuery() {
		const q = new URLSearchParams(location.search);
		const today = q.get('today');
		const preview = q.get('preview'); // sunday | diwali | karnataka | christmas | newyear
		return { today, preview };
	}
	function parseYMD(str) {
		const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str || '');
		if (!m) return null;
		return { y: +m[1], m: +m[2] - 1, d: +m[3] };
	}

	// Main recompute — also refreshes localStorage holidays on each tick
	function recompute() {
		if (!config) return;

		// Rebuild holiday sets each tick so localStorage additions are reflected
		holidaySet = new Set((config.holidays || []).map((h) => h.date));
		holidayMap = new Map(
			(config.holidays || []).map((h) => [h.date, { name: h.name, theme: h.theme }])
		);
		for (const h of loadLocalHolidays()) {
			holidaySet.add(h.date);
		}

		const { today: qToday, preview } = getQuery();
		const today = qToday ? parseYMD(qToday) || nowInIST() : nowInIST();
		const [ty, tm, td] = config.target.split('-').map(Number);
		const target = { y: ty, m: tm - 1, d: td };

		// Next business day ≥ today
		let nextBiz = { y: today.y, m: today.m, d: today.d };
		while (true) {
			const dow = dayOfWeek(nextBiz.y, nextBiz.m, nextBiz.d);
			if (dow !== 0 && !isHoliday(nextBiz)) break;
			nextBiz = addDays(nextBiz, 1);
			if (Date.UTC(nextBiz.y, nextBiz.m, nextBiz.d) > Date.UTC(target.y, target.m, target.d))
				break;
		}

		// Count and pause on excluded days
		let days = computeBusinessDays(nextBiz, target);
		const todayMs = Date.UTC(today.y, today.m, today.d);
		const tgtMs = Date.UTC(target.y, target.m, target.d);
		const excluded = preview
			? true
			: dayOfWeek(today.y, today.m, today.d) === 0 || isHoliday(today);
		if (excluded && todayMs <= tgtMs) days += 1;
		elDays.textContent = String(days);

		// Theme + status
		const inferredKey = resolveThemeKey(today);
		const themeKey = preview || inferredKey;
		applyTheme(themeKey, currentMode());
		const names = {
			diwali: 'Diwali',
			karnataka: 'Karnataka Rajyotsava',
			christmas: 'Christmas',
			newyear: 'New Year',
			sunday: 'Sunday',
			base: 'Counting active',
		};
		elStatus.textContent =
			themeKey === 'base'
				? names.base
				: themeKey === 'sunday'
				? names.sunday
				: `Holiday: ${names[themeKey] || 'Holiday'}`;

		// Effects
		updateEffects(themeKey);

		// Quote — only set on first recompute; subsequent changes are user-driven
		if (currentQuoteIdx === -1) {
			const dstr = fmtYMD(today.y, today.m, today.d);
			if (quotesByDate && Object.prototype.hasOwnProperty.call(quotesByDate, dstr)) {
				// Date-specific quote: show it; cycling starts from index 0 on first tap
				showQuote(quotesByDate[dstr]);
			} else {
				// Deterministic daily quote: set index so cycling continues from here
				initQuoteIndex(today);
				showQuote(allQuotes[currentQuoteIdx] || '');
			}
		}

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
		setupModeListeners();
		[config, themes] = await Promise.all([
			loadJSON('../data/config.json', 'default-config'),
			loadJSON('../data/themes.json', 'default-themes'),
		]);
		quotesByDate = config.quotesByDate || {};
		allQuotes = config.quotes || [];
		recompute();
		setInterval(recompute, 30_000);
		window.addEventListener('resize', autosizeDays);

		// Quote cycling on tap/click/keyboard
		if (elQuote) {
			elQuote.addEventListener('click', cycleQuote);
			elQuote.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					cycleQuote();
				}
			});
		}
	}
	boot().catch((err) => {
		console.error('Boot error:', err);
		elStatus.textContent = 'Failed to load configuration';
	});

	// Fit big number to container (~85% width)
	function autosizeDays() {
		const wrap = document.querySelector('.days-wrap');
		if (!wrap) return;
		const W = wrap.clientWidth;
		const H = wrap.clientHeight;
		const text = elDays.textContent || '0';
		let meas = document.getElementById('measure-days');
		if (!meas) {
			meas = document.createElement('span');
			meas.id = 'measure-days';
			meas.style.cssText = 'position: absolute; left: -9999px; top: 0; white-space: nowrap';
			meas.style.fontFamily = getComputedStyle(elDays).fontFamily;
			meas.style.fontWeight = getComputedStyle(elDays).fontWeight;
			document.body.appendChild(meas);
		}
		meas.style.fontSize = '100px';
		meas.textContent = text;
		const widthAt100 = meas.getBoundingClientRect().width || 1;
		const perPx = widthAt100 / 100;
		const targetWidth = Math.max(200, W * 0.85);
		let fs = Math.floor(targetWidth / perPx);
		fs = Math.min(fs, Math.floor(H * 0.9));
		fs = Math.max(60, Math.min(fs, 3200));
		elDays.style.fontSize = fs + 'px';
	}

	// Effects wiring (use global Effects from assets/js/effects.js)
	function updateEffects(themeKey) {
		if (!elEffects || !window.Effects) return;
		if (lastThemeKey === themeKey) return;
		lastThemeKey = themeKey;
		elEffects.innerHTML = '';
		if (elLights) elLights.innerHTML = '';
		if (themeKey === 'christmas') Effects.buildSnow(elEffects, 60);
		else if (themeKey === 'newyear') Effects.buildConfetti(elEffects, 120);
		else if (themeKey === 'karnataka') Effects.buildPetals(elEffects, 48);
		else if (themeKey === 'diwali') Effects.buildLights(elLights, 24);
	}
})();
