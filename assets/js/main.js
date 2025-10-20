// Countdown to Jan 5, 2026 excluding Sundays and custom holidays
// Works in IST (Asia/Kolkata)

(function () {
	let TARGET = { y: 2026, m: 0, d: 5 }; // Overridden by config when available
	const IST_OFFSET_MIN = 5 * 60 + 30; // +330

	const $days = document.getElementById('daysCount');
	const $status = document.getElementById('status');
	const $nowIst = document.getElementById('nowIst');
	const $form = document.getElementById('holidayForm');
	const $date = document.getElementById('holidayDate');
	const $label = document.getElementById('holidayLabel');
	const $list = document.getElementById('holidayList');
	const $clear = document.getElementById('clearHolidays');

	// Utilities for IST dates
	function nowInIST() {
		const now = new Date();
		const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
		const istMs = utcMs + IST_OFFSET_MIN * 60000;
		const ist = new Date(istMs);
		return {
			y: ist.getUTCFullYear(),
			m: ist.getUTCMonth(), // 0-based
			d: ist.getUTCDate(),
			h: ist.getUTCHours(),
			min: ist.getUTCMinutes(),
			sec: ist.getUTCSeconds(),
			toDate: () => ist,
		};
	}

	function fmtYMD(y, m, d) {
		const mm = String(m + 1).padStart(2, '0');
		const dd = String(d).padStart(2, '0');
		return `${y}-${mm}-${dd}`;
	}

	function parseYMD(str) {
		const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str);
		if (!m) return null;
		const y = Number(m[1]);
		const mo = Number(m[2]) - 1;
		const d = Number(m[3]);
		return { y, m: mo, d };
	}

	function dayOfWeek(y, m, d) {
		// 0=Sunday..6=Saturday; timezone-independent for a given calendar date
		return new Date(Date.UTC(y, m, d)).getUTCDay();
	}

	function addDays(dateObj, n) {
		const dt = new Date(Date.UTC(dateObj.y, dateObj.m, dateObj.d));
		dt.setUTCDate(dt.getUTCDate() + n);
		return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
	}

	// Holidays store
	function loadHolidays() {
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
	// Config holidays (from data/config.json or embedded default)
	let configHolidaySet = new Set();
	async function loadConfig() {
		try {
			const res = await fetch('../data/config.json', { cache: 'no-store' });
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const cfg = await res.json();
			if (cfg && cfg.target) {
				const [y, m, d] = cfg.target.split('-').map(Number);
				TARGET = { y, m: m - 1, d };
			}
			if (cfg && Array.isArray(cfg.holidays)) {
				configHolidaySet = new Set(cfg.holidays.map((h) => h.date));
			}
		} catch (_) {
			const el = document.getElementById('default-config');
			if (el) {
				try {
					const cfg = JSON.parse(el.textContent || '{}');
					if (cfg && cfg.target) {
						const [y, m, d] = cfg.target.split('-').map(Number);
						TARGET = { y, m: m - 1, d };
					}
					if (cfg && Array.isArray(cfg.holidays)) {
						configHolidaySet = new Set(cfg.holidays.map((h) => h.date));
					}
				} catch {}
			}
		}
	}
	function saveHolidays(items) {
		localStorage.setItem('customHolidays', JSON.stringify(items));
	}

	function renderHolidays(list) {
		$list.innerHTML = '';
		if (!list.length) {
			const li = document.createElement('li');
			li.textContent = 'No holidays added';
			li.style.color = '#667085';
			$list.appendChild(li);
			return;
		}
		for (const item of list) {
			const li = document.createElement('li');
			const left = document.createElement('div');
			const right = document.createElement('div');
			left.innerHTML = `<strong>${item.date}</strong> <span class="label">${
				item.label ? '— ' + escapeHtml(item.label) : ''
			}</span>`;
			const btn = document.createElement('button');
			btn.textContent = 'Remove';
			btn.addEventListener('click', () => {
				const next = loadHolidays().filter(
					(x) => x.date !== item.date || x.label !== item.label
				);
				saveHolidays(next);
				renderHolidays(next);
				recompute();
			});
			right.appendChild(btn);
			li.appendChild(left);
			li.appendChild(right);
			$list.appendChild(li);
		}
	}

	function escapeHtml(s) {
		return String(s).replace(
			/[&<>"]/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
		);
	}

	function isHoliday(ymd, holidaysSet) {
		return holidaysSet.has(fmtYMD(ymd.y, ymd.m, ymd.d));
	}

	function computeBusinessDays(fromYMD, toYMD, holidaysSet) {
		// Inclusive of both ends; excludes Sundays and holidays
		// If from > to, return 0
		const fromDT = Date.UTC(fromYMD.y, fromYMD.m, fromYMD.d);
		const toDT = Date.UTC(toYMD.y, toYMD.m, toYMD.d);
		if (fromDT > toDT) return 0;

		let count = 0;
		let cur = { ...fromYMD };
		while (true) {
			const dow = dayOfWeek(cur.y, cur.m, cur.d);
			const holiday = isHoliday(cur, holidaysSet);
			if (dow !== 0 && !holiday) count += 1; // exclude Sundays and holidays

			if (cur.y === toYMD.y && cur.m === toYMD.m && cur.d === toYMD.d) break;
			cur = addDays(cur, 1);
		}
		return count;
	}

	function recompute() {
		const now = nowInIST();
		const today = { y: now.y, m: now.m, d: now.d };
		const target = { ...TARGET };

		const holidays = loadHolidays();
		const holidaySet = new Set(holidays.map((h) => h.date));
		// Merge config holidays so admin and viewer match
		for (const d of configHolidaySet) holidaySet.add(d);

		const dow = dayOfWeek(today.y, today.m, today.d);
		const todayIsSunday = dow === 0;
		const todayIsHoliday = isHoliday(today, holidaySet);

		// Find next business day >= today
		let nextBiz = { ...today };
		while (true) {
			const w = dayOfWeek(nextBiz.y, nextBiz.m, nextBiz.d);
			if (w !== 0 && !isHoliday(nextBiz, holidaySet)) break;
			nextBiz = addDays(nextBiz, 1);
			// Safety: break if ran past target
			const nextMs = Date.UTC(nextBiz.y, nextBiz.m, nextBiz.d);
			const tgtMs = Date.UTC(target.y, target.m, target.d);
			if (nextMs > tgtMs) break;
		}

		let days = computeBusinessDays(nextBiz, target, holidaySet);
		// If today is excluded, we 'pause' the count (show yesterday's working count),
		// so display +1 relative to next working day's count, when target not passed.
		const todayMs = Date.UTC(today.y, today.m, today.d);
		const tgtMs = Date.UTC(target.y, target.m, target.d);
		if ((todayIsSunday || todayIsHoliday) && todayMs <= tgtMs) {
			days = days + 1;
		}
		$days.textContent = String(days);

		let statusMsg = 'Counting active';
		if (todayMs > tgtMs) {
			statusMsg = 'Target reached or passed';
		} else if (todayIsSunday) {
			statusMsg = 'Paused: Sunday (IST)';
		} else if (todayIsHoliday) {
			const entry = holidays.find((h) => h.date === fmtYMD(today.y, today.m, today.d));
			statusMsg = `Paused: Holiday${entry && entry.label ? ' — ' + entry.label : ''}`;
		}
		$status.textContent = statusMsg;

		// Show current IST date/time
		const dtf = new Intl.DateTimeFormat(undefined, {
			timeZone: 'Asia/Kolkata',
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		$nowIst.textContent = `Now (IST): ${dtf.format(new Date())}`;
	}

	function scheduleNextTick() {
		// Update every 30 seconds to keep time label fresh and rollover near midnight IST
		setInterval(() => {
			recompute();
		}, 30_000);
	}

	// Initial render
	(async function init() {
		await loadConfig();
		renderHolidays(loadHolidays());
		recompute();
		scheduleNextTick();
	})();
})();
