/**
 * CODEX OF PHYSICS — Main JavaScript
 * Navigation, scroll effects, hero simulation, and animations
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────
     NAVIGATION — sticky scroll effect
     ────────────────────────────────────────── */
  const nav = document.getElementById('main-nav');
  function handleNavScroll() {
    if (window.scrollY > 30) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  /* ──────────────────────────────────────────
     SMOOTH SCROLL — anchor links
     ────────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ──────────────────────────────────────────
     INTERSECTION OBSERVER — reveal animations
     ────────────────────────────────────────── */
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // stagger delay based on index
          const delay = entry.target.dataset.delay || 0;
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, parseInt(delay));
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealElements.forEach(el => revealObserver.observe(el));

  /* ──────────────────────────────────────────
     HERO PARTICLE / BOHR MINI-SIM (2D Canvas)
     A lightweight 2D orbital animation for the hero section
     ────────────────────────────────────────── */
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) {
    const hCtx = heroCanvas.getContext('2d');
    let hW, hH, hCX, hCY;
    let hFrame = 0;

    function resizeHero() {
      hW = heroCanvas.width = heroCanvas.clientWidth;
      hH = heroCanvas.height = heroCanvas.clientHeight;
      hCX = hW / 2;
      hCY = hH / 2;
    }

    resizeHero();
    window.addEventListener('resize', resizeHero, { passive: true });

    // Orbital data for 2D hero
    const heroOrbits = [
      { n: 1, color: '#00d4ff',   period: 2000 },
      { n: 2, color: '#e040fb',   period: 3500 },
      { n: 3, color: '#ffd600',   period: 5000 },
      { n: 4, color: '#00ff78',   period: 7000 },
      { n: 5, color: '#ff6d00',   period: 9500 },
    ];

    // Random tilt angles for 2D perspective projection (constant)
    const heroTilts = [0, 25, 55, 85, 115].map(d => d * Math.PI / 180);

    // Background stars for hero
    const heroStars = Array.from({ length: 240 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.5 + 0.1,
    }));

    // Scale multiplier for orbit radius (fitting within viewport)
    function heroR(n) {
      const base = Math.min(hW, hH) * 0.06;
      return base * n * n;
    }

    function drawHero(timestamp) {
      hCtx.clearRect(0, 0, hW, hH);

      // Draw stars
      heroStars.forEach(s => {
        hCtx.beginPath();
        hCtx.arc(s.x * hW, s.y * hH, s.r, 0, Math.PI * 2);
        hCtx.fillStyle = `rgba(136, 153, 187, ${s.a})`;
        hCtx.fill();
      });

      // Nucleus glow (orangered)
      const nPulse = 0.7 + 0.3 * Math.sin(timestamp * 0.002);
      const nRadius = 10 * nPulse;

      const nucleusGrad = hCtx.createRadialGradient(hCX, hCY, 0, hCX, hCY, nRadius * 3.5);
      nucleusGrad.addColorStop(0, `rgba(255, 100, 50, ${0.7 * nPulse})`);
      nucleusGrad.addColorStop(0.4, `rgba(255, 69, 0, ${0.3 * nPulse})`);
      nucleusGrad.addColorStop(1, 'rgba(255, 69, 0, 0)');
      hCtx.beginPath();
      hCtx.arc(hCX, hCY, nRadius * 3.5, 0, Math.PI * 2);
      hCtx.fillStyle = nucleusGrad;
      hCtx.fill();

      hCtx.beginPath();
      hCtx.arc(hCX, hCY, nRadius, 0, Math.PI * 2);
      hCtx.fillStyle = '#ff5533';
      hCtx.fill();

      heroOrbits.forEach((orb, i) => {
        const r = heroR(orb.n);
        if (r > Math.min(hW, hH) * 0.55) return; // clip to viewport

        const tilt = heroTilts[i];
        const color = orb.color;
        const period = orb.period;

        // Draw ellipse (tilted circle projected to 2D)
        const scaleY = Math.cos(tilt);
        hCtx.save();
        hCtx.translate(hCX, hCY);
        hCtx.scale(1, scaleY || 0.05);

        hCtx.beginPath();
        hCtx.setLineDash([6, 4]);
        hCtx.arc(0, 0, r, 0, Math.PI * 2);
        hCtx.strokeStyle = `${color}55`;
        hCtx.lineWidth = 1;
        hCtx.stroke();
        hCtx.setLineDash([]);
        hCtx.restore();

        // Electron angle
        const theta = ((timestamp / period) * Math.PI * 2) + Math.PI / 2;
        const ex = hCX + r * Math.cos(theta);
        const ey = hCY + r * Math.sin(theta) * scaleY;

        // Electron glow
        const eGrad = hCtx.createRadialGradient(ex, ey, 0, ex, ey, 18);
        eGrad.addColorStop(0, color + 'cc');
        eGrad.addColorStop(0.4, color + '44');
        eGrad.addColorStop(1, color + '00');
        hCtx.beginPath();
        hCtx.arc(ex, ey, 18, 0, Math.PI * 2);
        hCtx.fillStyle = eGrad;
        hCtx.fill();

        // Electron dot
        hCtx.beginPath();
        hCtx.arc(ex, ey, 4, 0, Math.PI * 2);
        hCtx.fillStyle = color;
        hCtx.fill();
      });

      hFrame++;
      requestAnimationFrame(drawHero);
    }

    requestAnimationFrame(drawHero);
  }

  /* ──────────────────────────────────────────
     SIM CARD PREVIEW ANIMATIONS (mini 2D previews)
     ────────────────────────────────────────── */
  const previewCanvases = document.querySelectorAll('.preview-canvas');
  previewCanvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    resize();

    const type = canvas.dataset.sim;
    let raf;

    if (type === 'bohr') {
      const colors = ['#00d4ff', '#e040fb', '#ffd600'];
      const tilts = [0, 30, 60].map(d => d * Math.PI / 180);
      const periods = [1800, 3200, 5000];

      function drawBohrPreview(t) {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        ctx.clearRect(0, 0, w, h);

        // Nucleus
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
        grad.addColorStop(0, '#ff6633cc');
        grad.addColorStop(1, '#ff450000');
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5533';
        ctx.fill();

        [1,2,3].forEach((n, i) => {
          const r = Math.min(w, h) * 0.1 * n * n;
          const tilt = tilts[i];
          const scaleY = Math.cos(tilt);
          const color = colors[i];

          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, scaleY || 0.05);
          ctx.beginPath();
          ctx.setLineDash([5, 3]);
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = color + '55';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          const theta = ((t / periods[i]) * Math.PI * 2) + Math.PI / 2;
          const ex = cx + r * Math.cos(theta);
          const ey = cy + r * Math.sin(theta) * scaleY;

          const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 12);
          eGrad.addColorStop(0, color + 'cc');
          eGrad.addColorStop(1, color + '00');
          ctx.beginPath();
          ctx.arc(ex, ey, 12, 0, Math.PI * 2);
          ctx.fillStyle = eGrad;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex, ey, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });

        raf = requestAnimationFrame(drawBohrPreview);
      }
      raf = requestAnimationFrame(drawBohrPreview);
    }

    // Observe to stop animation when off-screen (perf)
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          cancelAnimationFrame(raf);
        } else {
          raf = requestAnimationFrame(() => {});
        }
      });
    });
    obs.observe(canvas);
  });

  /* ──────────────────────────────────────────
     ABOUT GLYPH ANIMATION (small atomic visual)
     ────────────────────────────────────────── */
  const aboutCanvas = document.getElementById('about-canvas');
  if (aboutCanvas) {
    const ac = aboutCanvas.getContext('2d');

    function resizeAbout() {
      aboutCanvas.width = aboutCanvas.clientWidth;
      aboutCanvas.height = aboutCanvas.clientHeight;
    }
    resizeAbout();

    const aColors = ['#00d4ff', '#e040fb', '#ffd600', '#00ff78', '#ff6d00'];
    const aTilts = [0, 30, 60, 90, 120].map(d => d * Math.PI / 180);
    const aPeriods = [2500, 4200, 6000, 8000, 10500];

    function drawAboutGlyph(t) {
      const w = aboutCanvas.width, h = aboutCanvas.height;
      const cx = w / 2, cy = h / 2;
      ac.clearRect(0, 0, w, h);

      // Nucleus
      const gr = ac.createRadialGradient(cx, cy, 0, cx, cy, 20);
      gr.addColorStop(0, '#ff6633cc');
      gr.addColorStop(1, 'transparent');
      ac.beginPath();
      ac.arc(cx, cy, 20, 0, Math.PI * 2);
      ac.fillStyle = gr;
      ac.fill();
      ac.beginPath();
      ac.arc(cx, cy, 8, 0, Math.PI * 2);
      ac.fillStyle = '#ff5533';
      ac.fill();

      [1,2,3,4,5].forEach((n, i) => {
        const r = Math.min(w,h) * 0.07 * n * n;
        if (r > Math.min(w,h) * 0.46) return;
        const tilt = aTilts[i];
        const scaleY = Math.cos(tilt);
        const color = aColors[i];

        ac.save();
        ac.translate(cx, cy);
        ac.scale(1, scaleY || 0.05);
        ac.beginPath();
        ac.setLineDash([4, 3]);
        ac.arc(0, 0, r, 0, Math.PI * 2);
        ac.strokeStyle = color + '44';
        ac.lineWidth = 1;
        ac.stroke();
        ac.setLineDash([]);
        ac.restore();

        const theta = ((t / aPeriods[i]) * Math.PI * 2) + Math.PI / 2;
        const ex = cx + r * Math.cos(theta);
        const ey = cy + r * Math.sin(theta) * scaleY;

        const eGr = ac.createRadialGradient(ex, ey, 0, ex, ey, 10);
        eGr.addColorStop(0, color + 'cc');
        eGr.addColorStop(1, color + '00');
        ac.beginPath();
        ac.arc(ex, ey, 10, 0, Math.PI * 2);
        ac.fillStyle = eGr;
        ac.fill();
        ac.beginPath();
        ac.arc(ex, ey, 3, 0, Math.PI * 2);
        ac.fillStyle = color;
        ac.fill();
      });

      requestAnimationFrame(drawAboutGlyph);
    }

    requestAnimationFrame(drawAboutGlyph);
  }

  /* ──────────────────────────────────────────
     HOVER PARALLAX on sim cards
     ────────────────────────────────────────── */
  document.querySelectorAll('.sim-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-4px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

})();
