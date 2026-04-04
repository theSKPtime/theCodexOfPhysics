/**
 * CODEX OF PHYSICS — Bohr Model 3D Simulation
 * Translated from Python/Matplotlib to Three.js
 * Physics logic preserved exactly from original simulation.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────
     CONFIGURATION (mirrors Python defaults)
     ────────────────────────────────────────── */
  const CONFIG = {
    numLevels: 5,
    orbitColors: ['#00d4ff', '#e040fb', '#ffd600', '#00ff78', '#ff6d00'],
    tilts: [0, 30, 60, 90, 120],            // degrees, same as Python
    bohrRadius: 1.0,                          // a₀ scale factor
    electronSpeeds: [1.0, 0.6, 0.45, 0.35, 0.28], // relative angular speeds
    showGrid: false,
    showTrails: false,
    rotateCamera: true,
    cameraRotationSpeed: 0.15,
  };

  /* ──────────────────────────────────────────
     SCENE SETUP
     ────────────────────────────────────────── */
  const canvas = document.getElementById('sim-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x030508, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030508, 0.018);

  const camera = new THREE.PerspectiveCamera(
    52,
    canvas.clientWidth / canvas.clientHeight,
    0.1, 500
  );
  camera.position.set(0, 6, 18);
  camera.lookAt(0, 0, 0);

  /* ──────────────────────────────────────────
     AMBIENT LIGHTING
     ────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const pointLight = new THREE.PointLight(0xffffff, 0.6, 60);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);

  /* ──────────────────────────────────────────
     NUCLEUS (orangered sphere, r=0.3 in Python)
     ────────────────────────────────────────── */
  const nucleusGeo = new THREE.SphereGeometry(0.38, 64, 64);
  const nucleusMat = new THREE.MeshPhongMaterial({
    color: 0xff4500,
    emissive: 0xff2200,
    emissiveIntensity: 0.6,
    shininess: 80,
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  scene.add(nucleus);

  // Nucleus glow halo
  const nucleusLight = new THREE.PointLight(0xff4500, 1.2, 8);
  scene.add(nucleusLight);

  // Nucleus pulse effect using a transparent sphere
  const glowGeo = new THREE.SphereGeometry(0.55, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff4500,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const nucleusGlow = new THREE.Mesh(glowGeo, glowMat);
  scene.add(nucleusGlow);

  /* ──────────────────────────────────────────
     STARS BACKGROUND
     ────────────────────────────────────────── */
  (function buildStars() {
    const starGeo = new THREE.BufferGeometry();
    const count = 2000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 300;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x8899bb, size: 0.18, sizeAttenuation: true });
    scene.add(new THREE.Points(starGeo, starMat));
  })();

  /* ──────────────────────────────────────────
     ORBITAL HELPER FUNCTIONS
     ────────────────────────────────────────── */

  /**
   * Compute orbit radius: r_n = a₀ * n²  (Bohr model)
   * In Python: r = 0.8 * (n**2), so we replicate that.
   */
  function getRadius(n) { return 0.8 * n * n * CONFIG.bohrRadius; }

  /**
   * Compute 3D point on tilted circular orbit.
   * Same trig as Python:
   *   x = r * cos(θ)
   *   y = r * sin(θ) * cos(tilt)
   *   z = r * sin(θ) * sin(tilt)
   */
  function orbitPoint(r, tiltRad, theta) {
    return new THREE.Vector3(
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.cos(tiltRad),
      r * Math.sin(theta) * Math.sin(tiltRad)
    );
  }

  /* ──────────────────────────────────────────
     BUILD ORBITS & ELECTRONS
     ────────────────────────────────────────── */
  const orbits = [];   // { group, ring, electron, glowMesh, light, r, tiltRad, color, trailPoints, trailLine }
  const THETA_SEGMENTS = 128;

  for (let i = 0; i < CONFIG.numLevels; i++) {
    const n = i + 1;
    const r = getRadius(n);
    const tiltDeg = CONFIG.tilts[i];
    const tiltRad = THREE.MathUtils.degToRad(tiltDeg);
    const color = new THREE.Color(CONFIG.orbitColors[i]);
    const colorHex = parseInt(CONFIG.orbitColors[i].replace('#', ''), 16);

    // ── Orbit ring (dashed appearance via points) ──
    const ringPoints = [];
    for (let j = 0; j <= THETA_SEGMENTS; j++) {
      const theta = (j / THETA_SEGMENTS) * Math.PI * 2;
      ringPoints.push(orbitPoint(r, tiltRad, theta));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineDashedMaterial({
      color: colorHex,
      opacity: 0.55,
      transparent: true,
      dashSize: 0.3,
      gapSize: 0.15,
      linewidth: 1,
    });
    const ring = new THREE.Line(ringGeo, ringMat);
    ring.computeLineDistances();

    // ── Electron sphere ──
    const eGeo = new THREE.SphereGeometry(0.12, 20, 20);
    const eMat = new THREE.MeshPhongMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.9,
      shininess: 100,
    });
    const electron = new THREE.Mesh(eGeo, eMat);

    // Electron glow halo
    const eGlowGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const eGlowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const eGlow = new THREE.Mesh(eGlowGeo, eGlowMat);
    electron.add(eGlow);

    // Electron point light
    const eLight = new THREE.PointLight(colorHex, 0.5, r * 0.7);
    electron.add(eLight);

    // Trail geometry (empty initially)
    const maxTrailPoints = 80;
    const trailPositions = new Float32Array(maxTrailPoints * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.25,
      linewidth: 1,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);

    // Group everything per orbit level
    const group = new THREE.Group();
    group.add(ring);
    group.add(electron);
    group.add(trailLine);
    scene.add(group);

    orbits.push({ group, ring, electron, eGlow, eLight, r, tiltRad, color, maxTrailPoints, trailGeo, trailMat, trailLine, trailBuffer: [] });
  }

  /* Apply initial visibility for numLevels */
  let activeN = 5;
  applyVisibility(activeN);

  function applyVisibility(n) {
    activeN = n;
    orbits.forEach((o, i) => {
      const vis = i < n;
      o.group.visible = vis;
    });
  }

  /* ──────────────────────────────────────────
     ANIMATION STATE
     ────────────────────────────────────────── */
  let frame = 0;
  let lastTime = performance.now();
  let fps = 60;
  let fpsSmooth = 60;
  let paused = false;
  let cameraAngle = 0;

  // Speeds per orbit (matching Python: 80 + idx*40 frames period, at 50ms interval = 4s base, 6s, 8s, 10s, 12s)
  // Angular velocity in radians per frame: 2π / period (in sim-frames)
  // Original periods: 80, 120, 160, 200, 240 frames at 50ms each
  function getAngularVel(idx) {
    return (2 * Math.PI) / (80 + idx * 40);
  }

  /* track per-electron angles for exact physics replication */
  const electronAngles = [Math.PI / 2, Math.PI / 2, Math.PI / 2, Math.PI / 2, Math.PI / 2];

  /* ──────────────────────────────────────────
     MAIN RENDER LOOP
     ────────────────────────────────────────── */
  function animate(timestamp) {
    requestAnimationFrame(animate);

    const dt = timestamp - lastTime;
    lastTime = timestamp;
    fpsSmooth = fpsSmooth * 0.92 + (1000 / dt) * 0.08;

    if (!paused) {
      // Smooth camera auto-rotation
      if (CONFIG.rotateCamera) {
        cameraAngle += CONFIG.cameraRotationSpeed * 0.008;
        const camR = 18;
        const camH = 5 + Math.sin(cameraAngle * 0.3) * 3;
        camera.position.set(
          camR * Math.sin(cameraAngle),
          camH,
          camR * Math.cos(cameraAngle)
        );
        camera.lookAt(0, 0, 0);
      }

      // Nucleus pulse
      const pulseScale = 1 + 0.06 * Math.sin(timestamp * 0.003);
      nucleus.scale.setScalar(pulseScale);
      nucleusGlow.scale.setScalar(1 + 0.15 * Math.sin(timestamp * 0.003));
      nucleusGlow.material.opacity = 0.06 + 0.06 * Math.sin(timestamp * 0.003);

      // Animate electrons
      for (let idx = 0; idx < CONFIG.numLevels; idx++) {
        if (idx >= activeN) continue;
        const o = orbits[idx];
        const omega = getAngularVel(idx);
        electronAngles[idx] += omega;

        const theta = electronAngles[idx];
        const pt = orbitPoint(o.r, o.tiltRad, theta);
        o.electron.position.copy(pt);

        // Trail update
        if (CONFIG.showTrails) {
          o.trailBuffer.push(pt.clone());
          if (o.trailBuffer.length > o.maxTrailPoints) o.trailBuffer.shift();

          const pos = o.trailGeo.attributes.position;
          for (let k = 0; k < o.trailBuffer.length; k++) {
            pos.setXYZ(k, o.trailBuffer[k].x, o.trailBuffer[k].y, o.trailBuffer[k].z);
          }
          o.trailGeo.setDrawRange(0, o.trailBuffer.length);
          pos.needsUpdate = true;
        } else {
          o.trailGeo.setDrawRange(0, 0);
          o.trailBuffer = [];
        }
      }

      frame++;
    }

    renderer.render(scene, camera);

    // FPS counter (update every 30 frames)
    if (frame % 30 === 0) {
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) fpsEl.textContent = Math.round(fpsSmooth) + ' fps';
    }
  }

  requestAnimationFrame(animate);

  /* ──────────────────────────────────────────
     RESIZE HANDLING
     ────────────────────────────────────────── */
  function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  window.addEventListener('resize', onResize);

  /* ──────────────────────────────────────────
     CONTROL PANEL WIRING
     ────────────────────────────────────────── */

  // N Levels slider
  const nSlider = document.getElementById('ctrl-n-levels');
  const nDisplay = document.getElementById('val-n-levels');
  if (nSlider) {
    nSlider.addEventListener('input', () => {
      const v = parseInt(nSlider.value);
      nDisplay.textContent = v;
      applyVisibility(v);
      updateSliderTrack(nSlider);
    });
    updateSliderTrack(nSlider);
  }

  // Speed slider
  const speedSlider = document.getElementById('ctrl-speed');
  const speedDisplay = document.getElementById('val-speed');
  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      CONFIG.bohrRadius = parseFloat(speedSlider.value);
      speedDisplay.textContent = speedSlider.value + '×';
      updateSliderTrack(speedSlider);
    });
    updateSliderTrack(speedSlider);
  }

  // Camera rotation toggle
  const camToggle = document.getElementById('ctrl-camera-rotate');
  if (camToggle) {
    camToggle.checked = CONFIG.rotateCamera;
    camToggle.addEventListener('change', () => {
      CONFIG.rotateCamera = camToggle.checked;
    });
  }

  // Trails toggle
  const trailToggle = document.getElementById('ctrl-trails');
  if (trailToggle) {
    trailToggle.addEventListener('change', () => {
      CONFIG.showTrails = trailToggle.checked;
    });
  }

  // Pause/Play button
  const pauseBtn = document.getElementById('ctrl-pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? '▶ Play' : '⏸ Pause';
    });
  }

  // Reset button
  const resetBtn = document.getElementById('ctrl-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Reset to defaults
      activeN = 5;
      if (nSlider) { nSlider.value = 5; nDisplay.textContent = 5; updateSliderTrack(nSlider); }
      if (speedSlider) { speedSlider.value = 1; speedDisplay.textContent = '1×'; updateSliderTrack(speedSlider); }
      CONFIG.bohrRadius = 1.0;
      CONFIG.rotateCamera = true;
      CONFIG.showTrails = false;
      if (camToggle) camToggle.checked = true;
      if (trailToggle) trailToggle.checked = false;
      paused = false;
      if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
      electronAngles.fill(Math.PI / 2);
      applyVisibility(5);
    });
  }

  /* ──────────────────────────────────────────
     SLIDER TRACK FILL (visual feedback)
     ────────────────────────────────────────── */
  function updateSliderTrack(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, var(--accent-cyan) ${pct}%, var(--bg-card) ${pct}%)`;
  }

  /* ──────────────────────────────────────────
     CANVAS INTERACTION (mouse drag to rotate)
     ────────────────────────────────────────── */
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let camPhi = Math.PI / 6;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    CONFIG.rotateCamera = false;
    if (camToggle) camToggle.checked = false;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    cameraAngle += dx * 0.008;
    camPhi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camPhi + dy * 0.008));

    const camR = 18;
    camera.position.set(
      camR * Math.sin(cameraAngle) * Math.cos(camPhi),
      camR * Math.sin(camPhi) + 5,
      camR * Math.cos(cameraAngle) * Math.cos(camPhi)
    );
    camera.lookAt(0, 0, 0);
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    CONFIG.rotateCamera = false;
    if (camToggle) camToggle.checked = false;
  });

  window.addEventListener('touchend', () => { isDragging = false; });

  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastMouseX;
    const dy = e.touches[0].clientY - lastMouseY;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;

    cameraAngle += dx * 0.008;
    camPhi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camPhi + dy * 0.008));

    const camR = 18;
    camera.position.set(
      camR * Math.sin(cameraAngle) * Math.cos(camPhi),
      camR * Math.sin(camPhi) + 5,
      camR * Math.cos(cameraAngle) * Math.cos(camPhi)
    );
    camera.lookAt(0, 0, 0);
  }, { passive: false });

})();
