/**
 * CODEX OF PHYSICS — Schrödinger Hydrogen Orbital Simulation
 * 
 * Reimplements the Python quantum orbital visualization in WebGL/Three.js.
 * 
 * Physics:
 *   ψ(n,l,m; r,θ,φ) = R_nl(r) · Y_lm(θ,φ)
 *   R_nl = normalization · exp(-ρ/2) · ρ^l · L_{n-l-1}^{2l+1}(ρ)
 *   where ρ = 2Zr / (n·a₀)
 * 
 *   Probability density: |ψ|² 
 *   Points sampled via rejection sampling, identical to the Python code.
 */

(function () {
  'use strict';

  /* ══════════════════════════════════════════
     MATH: Factorial, Laguerre, Spherical Harmonics
     ══════════════════════════════════════════ */

  function factorial(n) {
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  /**
   * Generalized Laguerre polynomial L_n^alpha(x)
   * Using recurrence relation:
   *   L_0^a(x) = 1
   *   L_1^a(x) = 1 + a - x
   *   (k+1) L_{k+1}^a(x) = (2k + 1 + a - x) L_k^a(x) - (k + a) L_{k-1}^a(x)
   */
  function laguerre(n, alpha, x) {
    if (n === 0) return 1.0;
    if (n === 1) return 1.0 + alpha - x;
    let prev2 = 1.0;
    let prev1 = 1.0 + alpha - x;
    let curr = 0;
    for (let k = 1; k < n; k++) {
      curr = ((2 * k + 1 + alpha - x) * prev1 - (k + alpha) * prev2) / (k + 1);
      prev2 = prev1;
      prev1 = curr;
    }
    return curr;
  }

  /**
   * Associated Legendre polynomial P_l^m(x)
   * Using recurrence. |m| is used; sign handled in Y_lm.
   */
  function assocLegendre(l, m, x) {
    const am = Math.abs(m);
    if (am > l) return 0;

    // Start with P_am^am
    let pmm = 1.0;
    if (am > 0) {
      const somx2 = Math.sqrt(Math.max(0, 1 - x * x));
      let fact = 1.0;
      for (let i = 1; i <= am; i++) {
        pmm *= -fact * somx2;
        fact += 2.0;
      }
    }
    if (l === am) return pmm;

    // P_{am+1}^am
    let pmm1 = x * (2 * am + 1) * pmm;
    if (l === am + 1) return pmm1;

    // Recurrence
    let pll = 0;
    for (let ll = am + 2; ll <= l; ll++) {
      pll = (x * (2 * ll - 1) * pmm1 - (ll + am - 1) * pmm) / (ll - am);
      pmm = pmm1;
      pmm1 = pll;
    }
    return pll;
  }

  /**
   * Real spherical harmonic Y_l^m(theta, phi)
   * Returns real part for visualization (matching Python's sph_harm_y behavior)
   * For m > 0: sqrt(2) * N * P_l^m * cos(m*phi)
   * For m < 0: sqrt(2) * N * P_l^|m| * sin(|m|*phi)
   * For m = 0: N * P_l^0
   */
  function sphericalHarmonicReal(l, m, theta, phi) {
    const am = Math.abs(m);
    const norm = Math.sqrt(
      ((2 * l + 1) / (4 * Math.PI)) *
      (factorial(l - am) / factorial(l + am))
    );
    const plm = assocLegendre(l, am, Math.cos(theta));

    if (m > 0) {
      return Math.SQRT2 * norm * plm * Math.cos(m * phi);
    } else if (m < 0) {
      return Math.SQRT2 * norm * plm * Math.sin(am * phi);
    } else {
      return norm * plm;
    }
  }

  /**
   * Complex spherical harmonic magnitude |Y_l^m|² for probability density
   */
  function sphericalHarmonicMagSq(l, m, theta) {
    const am = Math.abs(m);
    const norm = Math.sqrt(
      ((2 * l + 1) / (4 * Math.PI)) *
      (factorial(l - am) / factorial(l + am))
    );
    const plm = assocLegendre(l, am, Math.cos(theta));
    return norm * norm * plm * plm;
  }

  /**
   * Hydrogen wavefunction ψ(n, l, m, r, θ, φ)
   * Returns { real, prob } where prob = |ψ|²
   */
  function hydrogenPsi(n, l, m, r, theta, phi, Z, a0) {
    const rho = (2 * Z * r) / (n * a0);

    // Radial normalization
    const normR = Math.sqrt(
      Math.pow(2 * Z / (n * a0), 3) *
      factorial(n - l - 1) /
      (2 * n * factorial(n + l))
    );

    const lag = laguerre(n - l - 1, 2 * l + 1, rho);
    const radial = normR * Math.exp(-rho / 2) * Math.pow(rho, l) * lag;

    const ylm = sphericalHarmonicReal(l, m, theta, phi);

    const psiReal = radial * ylm;
    const prob = radial * radial * sphericalHarmonicMagSq(l, m, theta);

    return { real: psiReal, prob: prob };
  }

  /* ══════════════════════════════════════════
     POINT GENERATION (rejection sampling,
     matches Python's Monte Carlo approach)
     ══════════════════════════════════════════ */

  function generateOrbitalPoints(n, l, m, Z, a0, numSamples, targetPoints) {
    const boxSize = n * n + 5;
    const positions = [];
    const colors = [];
    const sizes = [];

    // Adaptive: first pass to find max probability
    let maxProb = 0;
    const probeCount = Math.min(numSamples, 50000);
    for (let i = 0; i < probeCount; i++) {
      const x = (Math.random() * 2 - 1) * boxSize;
      const y = (Math.random() * 2 - 1) * boxSize;
      const z = (Math.random() * 2 - 1) * boxSize;
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r < 1e-8) continue;
      const theta = Math.acos(Math.max(-1, Math.min(1, z / r)));
      const phi = ((Math.atan2(y, x) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const { prob } = hydrogenPsi(n, l, m, r, theta, phi, Z, a0);
      if (prob > maxProb) maxProb = prob;
    }
    if (maxProb === 0) maxProb = 1e-10;

    // Main rejection sampling pass
    let accepted = 0;
    let attempts = 0;
    const maxAttempts = numSamples * 5;

    while (accepted < targetPoints && attempts < maxAttempts) {
      const batchSize = Math.min(10000, maxAttempts - attempts);
      for (let i = 0; i < batchSize && accepted < targetPoints; i++) {
        attempts++;
        const x = (Math.random() * 2 - 1) * boxSize;
        const y = (Math.random() * 2 - 1) * boxSize;
        const z = (Math.random() * 2 - 1) * boxSize;
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r < 1e-8) continue;
        const theta = Math.acos(Math.max(-1, Math.min(1, z / r)));
        const phi = ((Math.atan2(y, x) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        const { real, prob } = hydrogenPsi(n, l, m, r, theta, phi, Z, a0);

        if (Math.random() < prob / maxProb) {
          positions.push(x, y, z);

          // Color: blue for positive ψ, red for negative ψ (like Python's bwr colormap)
          const sign = real > 0 ? 1 : -1;
          const intensity = Math.min(1, Math.sqrt(prob / maxProb));

          if (sign > 0) {
            colors.push(
              0.15 + 0.15 * intensity,   // R
              0.4 + 0.4 * intensity,     // G
              0.85 + 0.15 * intensity    // B
            );
          } else {
            colors.push(
              0.85 + 0.15 * intensity,   // R
              0.15 + 0.15 * intensity,   // G
              0.3 + 0.2 * intensity      // B
            );
          }

          sizes.push(0.15 + 0.35 * intensity);
          accepted++;
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      sizes: new Float32Array(sizes),
      count: accepted,
    };
  }

  /* ══════════════════════════════════════════
     THREE.JS SCENE SETUP
     ══════════════════════════════════════════ */

  const canvas = document.getElementById('sim-canvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x030508, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
  let camDistance = 12;
  let camAngle = 0;
  let camPhi = Math.PI / 8;
  let autoRotate = true;

  camera.position.set(0, 5, camDistance);
  camera.lookAt(0, 0, 0);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // Stars background
  (function () {
    const geo = new THREE.BufferGeometry();
    const count = 1500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 400;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x556688, size: 0.2, sizeAttenuation: true })));
  })();

  // Nucleus (tiny dot at center)
  const nucGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const nucMat = new THREE.MeshBasicMaterial({ color: 0xff5533 });
  const nucMesh = new THREE.Mesh(nucGeo, nucMat);
  scene.add(nucMesh);

  const nucGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.15, depthWrite: false })
  );
  scene.add(nucGlow);

  /* ══════════════════════════════════════════
     PARTICLE SYSTEM (GPU point cloud)
     ══════════════════════════════════════════ */

  // Custom shader for particles with glow
  const particleVertexShader = `
    attribute float size;
    attribute vec3 customColor;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = customColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (600.0 / -mvPosition.z);
      gl_PointSize = clamp(gl_PointSize, 1.5, 20.0);
      gl_Position = projectionMatrix * mvPosition;
      vAlpha = clamp(1.0 - (-mvPosition.z / 120.0), 0.3, 1.0);
    }
  `;

  const particleFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d) * vAlpha * 0.85;
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  let particleSystem = null;
  let currentN = 2, currentL = 1, currentM = 0, currentZ = 1;
  const a0 = 1.0;
  let isGenerating = false;

  // Particle count based on quantum numbers (higher n = more points needed)
  function getParticleCount(n) {
    const base = 40000;
    return Math.min(base + n * n * 8000, 120000);
  }

  function getSampleCount(n) {
    return getParticleCount(n) * 12;
  }

  /**
   * Generate or regenerate the orbital point cloud
   */
  function regenerateOrbital() {
    if (isGenerating) return;
    isGenerating = true;

    // Update status
    const statusEl = document.getElementById('gen-status');
    if (statusEl) {
      statusEl.textContent = 'Generating...';
      statusEl.style.color = 'var(--accent-amber)';
    }

    // Use requestAnimationFrame to not block UI
    requestAnimationFrame(() => {
      const targetPts = getParticleCount(currentN);
      const samples = getSampleCount(currentN);

      const data = generateOrbitalPoints(currentN, currentL, currentM, currentZ, a0, samples, targetPts);

      // Remove old particle system
      if (particleSystem) {
        scene.remove(particleSystem);
        particleSystem.geometry.dispose();
        particleSystem.material.dispose();
      }

      // Create geometry
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('customColor', new THREE.BufferAttribute(data.colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));

      const material = new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      particleSystem = new THREE.Points(geometry, material);
      scene.add(particleSystem);

      // Adjust camera distance based on orbital size
      const targetDist = Math.max(8, (currentN * currentN + 5) * 1.2);
      camDistance = targetDist;

      if (statusEl) {
        statusEl.textContent = `${data.count.toLocaleString()} pts`;
        statusEl.style.color = 'var(--accent-green)';
      }

      // Update state display
      const stateEl = document.getElementById('quantum-state-display');
      if (stateEl) {
        const orbitalNames = ['s', 'p', 'd', 'f', 'g', 'h'];
        const orbName = orbitalNames[currentL] || '?';
        stateEl.textContent = `${currentN}${orbName} (m=${currentM})`;
      }

      isGenerating = false;
    });
  }

  /* ══════════════════════════════════════════
     ANIMATION LOOP
     ══════════════════════════════════════════ */

  let lastTime = performance.now();
  let fpsSmooth = 60;
  let frame = 0;

  function animate(timestamp) {
    requestAnimationFrame(animate);
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > 0) fpsSmooth = fpsSmooth * 0.92 + (1000 / dt) * 0.08;

    // Auto-rotate camera
    if (autoRotate) {
      camAngle += 0.003;
    }

    camera.position.set(
      camDistance * Math.sin(camAngle) * Math.cos(camPhi),
      camDistance * Math.sin(camPhi) + 2,
      camDistance * Math.cos(camAngle) * Math.cos(camPhi)
    );
    camera.lookAt(0, 0, 0);

    // Nucleus pulse
    const p = 1 + 0.08 * Math.sin(timestamp * 0.004);
    nucMesh.scale.setScalar(p);
    nucGlow.scale.setScalar(p * 1.4);

    // Subtle particle rotation
    if (particleSystem) {
      particleSystem.rotation.y = timestamp * 0.00005;
    }

    renderer.render(scene, camera);

    if (frame++ % 30 === 0) {
      const el = document.getElementById('fps-counter');
      if (el) el.textContent = Math.round(fpsSmooth) + ' fps';
    }
  }
  requestAnimationFrame(animate);

  /* ══════════════════════════════════════════
     RESIZE
     ══════════════════════════════════════════ */
  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', onResize);

  /* ══════════════════════════════════════════
     MOUSE / TOUCH CONTROLS
     ══════════════════════════════════════════ */
  let isDragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    autoRotate = false;
    const ct = document.getElementById('ctrl-auto-rotate');
    if (ct) ct.checked = false;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    camAngle += (e.clientX - lastX) * 0.008;
    camPhi = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, camPhi + (e.clientY - lastY) * 0.008));
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camDistance = Math.max(4, Math.min(80, camDistance + e.deltaY * 0.03));
  }, { passive: false });

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      autoRotate = false;
    }
  });
  window.addEventListener('touchend', () => { isDragging = false; });
  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    camAngle += (e.touches[0].clientX - lastX) * 0.008;
    camPhi = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, camPhi + (e.touches[0].clientY - lastY) * 0.008));
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }, { passive: false });

  // Pinch zoom
  let lastPinch = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinch = Math.sqrt(dx * dx + dy * dy);
    }
  });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      camDistance = Math.max(4, Math.min(80, camDistance + (lastPinch - d) * 0.05));
      lastPinch = d;
    }
  }, { passive: false });

  /* ══════════════════════════════════════════
     FULLSCREEN
     ══════════════════════════════════════════ */
  const fsBtn = document.getElementById('ctrl-fullscreen');
  const canvasArea = document.querySelector('.lab-canvas-area');
  if (fsBtn && canvasArea) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        canvasArea.requestFullscreen().then(() => {
          fsBtn.textContent = '⛶ Exit Fullscreen';
          setTimeout(onResize, 100);
        }).catch(() => {});
      } else {
        document.exitFullscreen();
        fsBtn.textContent = '⛶ Fullscreen';
        setTimeout(onResize, 100);
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        fsBtn.textContent = '⛶ Fullscreen';
        setTimeout(onResize, 100);
      }
    });
  }

  /* ══════════════════════════════════════════
     CONTROL PANEL
     ══════════════════════════════════════════ */
  function updateSliderTrack(input) {
    const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, var(--accent-indigo) ${pct}%, var(--bg-card) ${pct}%)`;
  }

  // Validate quantum numbers: l < n, |m| <= l
  function validateQuantumNumbers() {
    const lSlider = document.getElementById('ctrl-l');
    const mSlider = document.getElementById('ctrl-m');
    const lDisplay = document.getElementById('val-l');
    const mDisplay = document.getElementById('val-m');
    const orbitalNames = ['s', 'p', 'd', 'f', 'g', 'h'];

    if (!lSlider || !mSlider) return;

    // l must be 0..n-1
    lSlider.max = currentN - 1;
    if (currentL >= currentN) {
      currentL = currentN - 1;
      lSlider.value = currentL;
    }
    lDisplay.textContent = `${currentL} (${orbitalNames[currentL] || '?'})`;
    updateSliderTrack(lSlider);

    // m must be -l..l
    mSlider.min = -currentL;
    mSlider.max = currentL;
    if (Math.abs(currentM) > currentL) {
      currentM = 0;
      mSlider.value = 0;
    }
    mDisplay.textContent = currentM;
    updateSliderTrack(mSlider);
  }

  // n slider
  const nSlider = document.getElementById('ctrl-n');
  const nDisplay = document.getElementById('val-n');
  if (nSlider) {
    nSlider.addEventListener('input', () => {
      currentN = parseInt(nSlider.value);
      nDisplay.textContent = currentN;
      updateSliderTrack(nSlider);
      validateQuantumNumbers();
      regenerateOrbital();
    });
    updateSliderTrack(nSlider);
  }

  // l slider
  const lSlider = document.getElementById('ctrl-l');
  const lDisplay = document.getElementById('val-l');
  if (lSlider) {
    lSlider.addEventListener('input', () => {
      currentL = parseInt(lSlider.value);
      const orbitalNames = ['s', 'p', 'd', 'f', 'g', 'h'];
      lDisplay.textContent = `${currentL} (${orbitalNames[currentL] || '?'})`;
      updateSliderTrack(lSlider);
      validateQuantumNumbers();
      regenerateOrbital();
    });
    updateSliderTrack(lSlider);
  }

  // m slider
  const mSlider = document.getElementById('ctrl-m');
  const mDisplay = document.getElementById('val-m');
  if (mSlider) {
    mSlider.addEventListener('input', () => {
      currentM = parseInt(mSlider.value);
      mDisplay.textContent = currentM;
      updateSliderTrack(mSlider);
      regenerateOrbital();
    });
    updateSliderTrack(mSlider);
  }

  // Z slider
  const zSlider = document.getElementById('ctrl-z');
  const zDisplay = document.getElementById('val-z');
  if (zSlider) {
    zSlider.addEventListener('input', () => {
      currentZ = parseInt(zSlider.value);
      zDisplay.textContent = currentZ;
      updateSliderTrack(zSlider);
      regenerateOrbital();
    });
    updateSliderTrack(zSlider);
  }

  // Auto-rotate toggle
  const rotToggle = document.getElementById('ctrl-auto-rotate');
  if (rotToggle) {
    rotToggle.checked = autoRotate;
    rotToggle.addEventListener('change', () => { autoRotate = rotToggle.checked; });
  }

  // Reset
  const resetBtn = document.getElementById('ctrl-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentN = 2; currentL = 1; currentM = 0; currentZ = 1;
      autoRotate = true;
      camAngle = 0;
      camPhi = Math.PI / 8;
      if (nSlider) { nSlider.value = 2; nDisplay.textContent = 2; updateSliderTrack(nSlider); }
      if (lSlider) { lSlider.value = 1; updateSliderTrack(lSlider); }
      if (mSlider) { mSlider.value = 0; mSlider.min = -1; mSlider.max = 1; updateSliderTrack(mSlider); }
      if (zSlider) { zSlider.value = 1; zDisplay.textContent = 1; updateSliderTrack(zSlider); }
      if (rotToggle) rotToggle.checked = true;
      validateQuantumNumbers();
      regenerateOrbital();
    });
  }

  // Preset buttons
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [pn, pl, pm] = btn.dataset.preset.split(',').map(Number);
      currentN = pn;
      currentL = pl;
      currentM = pm;

      if (nSlider) { nSlider.value = pn; nDisplay.textContent = pn; updateSliderTrack(nSlider); }
      validateQuantumNumbers();
      if (lSlider) { lSlider.value = pl; updateSliderTrack(lSlider); }
      if (mSlider) { mSlider.value = pm; updateSliderTrack(mSlider); }
      validateQuantumNumbers();
      regenerateOrbital();
    });
  });

  /* ══════════════════════════════════════════
     INITIAL GENERATION
     ══════════════════════════════════════════ */
  // Canvas sizing fix
  function resizeCanvas() {
    const area = canvas.parentElement;
    canvas.style.width = area.clientWidth + 'px';
    canvas.style.height = area.clientHeight + 'px';
    onResize();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Generate initial 2p orbital
  setTimeout(() => {
    regenerateOrbital();
  }, 100);

})();
