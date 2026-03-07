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

	window.Effects = { buildSnow, buildConfetti, buildPetals, buildLights };
})();
