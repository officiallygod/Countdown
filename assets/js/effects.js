// Lightweight, commented effects helpers for the viewer.
// Exposes a global Effects object: window.Effects
(function () {
	function el(tag, cls) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		return e;
	}

	function buildSnow(root, n) {
		for (let i = 0; i < n; i++) {
			const s = el('span', 'snowflake');
			s.style.setProperty('--sz', (Math.random() * 6 + 4).toFixed(1) + 'px');
			s.style.setProperty('--left', (Math.random() * 100).toFixed(1) + '%');
			s.style.setProperty('--dur', (Math.random() * 8 + 8).toFixed(1) + 's');
			s.style.setProperty('--drift', (Math.random() * 60 - 30).toFixed(0) + 'px');
			s.style.animationDelay = (Math.random() * 6).toFixed(2) + 's';
			root.appendChild(s);
		}
	}

	function buildConfetti(root, n) {
		const colors = ['#ff9aa2', '#ffdab9', '#b5ead7', '#c7ceea', '#ffd166', '#a7e8c9'];
		for (let i = 0; i < n; i++) {
			const c = el('span', 'confetti');
			c.style.setProperty('--w', (Math.random() * 5 + 4).toFixed(1) + 'px');
			c.style.setProperty('--h', (Math.random() * 10 + 6).toFixed(1) + 'px');
			c.style.setProperty('--left', (Math.random() * 100).toFixed(1) + '%');
			c.style.setProperty('--dur', (Math.random() * 5 + 6).toFixed(1) + 's');
			c.style.setProperty('--rot', Math.floor(Math.random() * 360) + 'deg');
			c.style.setProperty('--c', colors[i % colors.length]);
			c.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
			root.appendChild(c);
		}
	}

	function buildPetals(root, n) {
		for (let i = 0; i < n; i++) {
			const p = el('span', 'petal');
			p.style.setProperty('--sz', (Math.random() * 10 + 10).toFixed(1) + 'px');
			p.style.setProperty('--left', (Math.random() * 100).toFixed(1) + '%');
			p.style.setProperty('--dur', (Math.random() * 6 + 8).toFixed(1) + 's');
			p.style.setProperty('--drift', (Math.random() * 60 - 30).toFixed(0) + 'px');
			p.style.setProperty('--rot', Math.floor(Math.random() * 180) + 'deg');
			p.style.animationDelay = (Math.random() * 5).toFixed(2) + 's';
			root.appendChild(p);
		}
	}

	function buildLights(root, n) {
		const palette = ['#ffd27f', '#f9a8d4', '#ffcd66', '#f7a1bf'];
		for (let i = 0; i < n; i++) {
			const b = el('span', 'bulb');
			b.style.background = palette[i % palette.length];
			b.style.setProperty('--blink', (2.2 + Math.random() * 2).toFixed(2) + 's');
			root.appendChild(b);
		}
	}

	// SVG-based daypart sprites (tiny, sparse, behind content)
	const SPRITES = {
		night: ['../assets/svg/dayparts/moon.svg', '../assets/svg/dayparts/star.svg'],
		morning: [
			'../assets/svg/dayparts/dawn.svg',
			'../assets/svg/dayparts/sun.svg',
			'../assets/svg/dayparts/sparkle.svg',
		],
		noon: ['../assets/svg/dayparts/sun.svg', '../assets/svg/dayparts/sparkle.svg'],
		evening: ['../assets/svg/dayparts/cloudsun.svg', '../assets/svg/dayparts/sparkle.svg'],
	};

	function buildDaypartSprites(root, daypart, n) {
		// Night uses emoji particles; others use SVG sprites
		if (daypart === 'night') {
			const emojis = ['🌙', '⭐', '✨'];
			const bucket = 100 / n;
			for (let i = 0; i < n; i++) {
				const e = el('span', 'emoji');
				e.textContent = emojis[Math.floor(Math.random() * emojis.length)];
				const size = Math.round(Math.random() * 12 + 16); // 16–28px
				e.style.fontSize = size + 'px';
				// Even distribution across width with slight jitter
				const jitter = Math.random() * bucket * 0.3 - bucket * 0.15;
				const left = i * bucket + bucket / 2 + jitter;
				e.style.left = Math.max(0, Math.min(100, left)).toFixed(1) + '%';
				const top = (Math.random() * 50 + 10).toFixed(1) + '%';
				e.style.top = top;
				e.style.animationDuration = (Math.random() * 3 + 7).toFixed(1) + 's';
				e.style.opacity = (Math.random() * 0.25 + 0.45).toFixed(2);
				root.appendChild(e);
			}
			return;
		}
		const set = SPRITES[daypart] || SPRITES.noon;
		const bucket = 100 / n;
		for (let i = 0; i < n; i++) {
			const s = el('span', 'sprite');
			s.style.backgroundImage = `url(${set[Math.floor(Math.random() * set.length)]})`;
			const size = (Math.random() * 14 + 22) | 0; // 22–36px
			s.style.width = size + 'px';
			s.style.height = Math.round(size * (0.9 + Math.random() * 0.3)) + 'px';
			const jitter = Math.random() * bucket * 0.3 - bucket * 0.15;
			const left = i * bucket + bucket / 2 + jitter;
			s.style.left = Math.max(0, Math.min(100, left)).toFixed(1) + '%';
			const topBase = daypart === 'evening' ? 12 : 6;
			const topRange = daypart === 'evening' ? 30 : 25;
			s.style.top = (Math.random() * topRange + topBase).toFixed(1) + '%';
			s.style.animationDuration = (Math.random() * 3 + 7).toFixed(1) + 's';
			s.style.opacity = (Math.random() * 0.2 + 0.35).toFixed(2);
			root.appendChild(s);
		}
	}

	window.Effects = { buildSnow, buildConfetti, buildPetals, buildLights, buildDaypartSprites };
})();
