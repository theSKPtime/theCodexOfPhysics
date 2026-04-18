/**
 * CODEX OF PHYSICS — Bohr Model 3D Simulation (Enhanced)
 * Translated from Python/Matplotlib to Three.js
 * Enhanced with: hover tooltips, zoom, fullscreen, orbit labels, Z parameter
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────
     CONFIGURATION
     ────────────────────────────────────────── */
  const CONFIG = {
    numLevels: 5,
    orbitColors: ['#00d4ff', '#e040fb', '#ffd600', '#00ff78', '#ff6d00'],
    tilts: [0, 30, 60, 90, 120],
    bohrRadius: 1.0,
    electronSpeeds: [1.0, 0.6, 0.45, 0.35, 0.28],
    showGrid: false,
    showTrails: false,
    showLabels: true,
    showQuantumInfo: true,
    rotateCamera: true,
    cameraRotationSpeed: 0.15,
    atomicNumber: 1,     // Z
  };

  const A0_ANGSTROM = 0.529; // Bohr radius in Ångströms

  /* ──────────────────────────────────────────
     SCENE SETUP
     ────────────────────────────────────────── */
  const canvas = document.getElementById('sim-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setClearColor(0x030508, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030508, 0.012);

  const camera = new THREE.PerspectiveCamera(52, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
  camera.position.set(0, 6, 18);
  camera.lookAt(0, 0, 0);

  /* ── Lighting ── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const pointLight = new THREE.PointLight(0xffffff, 0.6, 60);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);

  /* ── Nucleus ── */
  const nucleusGeo = new THREE.SphereGeometry(0.38, 64, 64);
  const nucleusMat = new THREE.MeshPhongMaterial({
    color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 0.6, shininess: 80,
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  scene.add(nucleus);

  const nucleusLight = new THREE.PointLight(0xff4500, 1.2, 8);
  scene.add(nucleusLight);

  const glowGeo = new THREE.SphereGeometry(0.55, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff4500, transparent: true, opacity: 0.12, depthWrite: false,
  });
  const nucleusGlow = new THREE.Mesh(glowGeo, glowMat);
  scene.add(nucleusGlow);

  /* ── Stars ── */
  (function () {
    const geo = new THREE.BufferGeometry();
    const count = 2000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 300;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8899bb, size: 0.18, sizeAttenuation: true })));
  })();

  /* ──────────────────────────────────────────
     ORBITAL MATH
     ────────────────────────────────────────── */
  function getRadius(n) { return 0.8 * n * n * CONFIG.bohrRadius; }

  function orbitPoint(r, tiltRad, theta) {
    return new THREE.Vector3(
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.cos(tiltRad),
      r * Math.sin(theta) * Math.sin(tiltRad)
    );
  }

  function getEnergy(n, Z) { return -13.6 * (Z * Z) / (n * n); }
  function getRadiusAngstrom(n, Z) { return (n * n * A0_ANGSTROM) / Z; }

  /* ──────────────────────────────────────────
     BUILD ORBITS & ELECTRONS
     ────────────────────────────────────────── */
  const orbits = [];
  const THETA_SEGMENTS = 128;

  for (let i = 0; i < CONFIG.numLevels; i++) {
    const n = i + 1;
    const r = getRadius(n);
    const tiltDeg = CONFIG.tilts[i];
    const tiltRad = THREE.MathUtils.degToRad(tiltDeg);
    const colorHex = parseInt(CONFIG.orbitColors[i].replace('#', ''), 16);

    // Orbit ring
    const ringPoints = [];
    for (let j = 0; j <= THETA_SEGMENTS; j++) {
      ringPoints.push(orbitPoint(r, tiltRad, (j / THETA_SEGMENTS) * Math.PI * 2));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineDashedMaterial({
      color: colorHex, opacity: 0.55, transparent: true, dashSize: 0.3, gapSize: 0.15,
    });
    const ring = new THREE.Line(ringGeo, ringMat);
    ring.computeLineDistances();

    // Electron
    const eGeo = new THREE.SphereGeometry(0.14, 20, 20);
    const eMat = new THREE.MeshPhongMaterial({
      color: colorHex, emissive: colorHex, emissiveIntensity: 0.9, shininess: 100,
    });
    const electron = new THREE.Mesh(eGeo, eMat);

    // Electron glow
    const eGlowGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const eGlowMat = new THREE.MeshBasicMaterial({
      color: colorHex, transparent: true, opacity: 0.18, depthWrite: false,
    });
    electron.add(new THREE.Mesh(eGlowGeo, eGlowMat));
    electron.add(new THREE.PointLight(colorHex, 0.5, r * 0.7));

    // Trail
    const maxTrailPoints = 80;
    const trailPos = new Float32Array(maxTrailPoints * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.25 });
    const trailLine = new THREE.Line(trailGeo, trailMat);

    // Group
    const group = new THREE.Group();
    group.add(ring);
    group.add(electron);
    group.add(trailLine);
    scene.add(group);

    orbits.push({ group, ring, electron, r, tiltRad, n, maxTrailPoints, trailGeo, trailLine, trailBuffer: [] });
  }

  /* visibility */
  let activeN = 5;
  function applyVisibility(n) {
    activeN = n;
    orbits.forEach((o, i) => { o.group.visible = i < n; });
  }
  applyVisibility(activeN);

  /* ──────────────────────────────────────────
     RAYCASTER — Hover detection for tooltips
     ────────────────────────────────────────── */
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.5 };
  const mouse = new THREE.Vector2(-999, -999);
  let hoveredOrbitIdx = -1;

  const tooltip = document.getElementById('bohr-tooltip');

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    let closest = -1;
    let closestDist = Infinity;

    for (let i = 0; i < activeN; i++) {
      const o = orbits[i];
      // Check electron sphere
      const hits = raycaster.intersectObject(o.electron, true);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closestDist = hits[0].distance;
        closest = i;
      }
      // Check orbit ring (use proximity to orbit plane)
      const ringHits = raycaster.intersectObject(o.ring, false);
      if (ringHits.length > 0 && ringHits[0].distance < closestDist) {
        closestDist = ringHits[0].distance;
        closest = i;
      }
    }

    hoveredOrbitIdx = closest;

    if (tooltip && closest >= 0 && CONFIG.showQuantumInfo) {
      const n = closest + 1;
      const Z = CONFIG.atomicNumber;
      const energy = getEnergy(n, Z);
      const radius = getRadiusAngstrom(n, Z);
      const angMom = n; // L = nℏ

      tooltip.innerHTML = `
        <div class="tt-header">Shell n = ${n}</div>
        <div class="tt-row"><span class="tt-label">Energy</span><span class="tt-val">${energy.toFixed(3)} eV</span></div>
        <div class="tt-row"><span class="tt-label">Radius</span><span class="tt-val">${radius.toFixed(3)} Å</span></div>
        <div class="tt-row"><span class="tt-label">Angular Mom.</span><span class="tt-val">${angMom}ℏ</span></div>
        <div class="tt-row"><span class="tt-label">Formula</span><span class="tt-val">E = −13.6·Z²/n²</span></div>
      `;
      tooltip.style.opacity = '1';
      tooltip.style.left = (e.clientX - canvas.getBoundingClientRect().left + 16) + 'px';
      tooltip.style.top = (e.clientY - canvas.getBoundingClientRect().top - 20) + 'px';
    } else if (tooltip) {
      tooltip.style.opacity = '0';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredOrbitIdx = -1;
    if (tooltip) tooltip.style.opacity = '0';
  });

  /* ──────────────────────────────────────────
     ANIMATION STATE
     ────────────────────────────────────────── */
  let frame = 0;
  let lastTime = performance.now();
  let fpsSmooth = 60;
  let paused = false;
  let cameraAngle = 0;
  let camDistance = 18;
  let camPhi = Math.PI / 6;

  function getAngularVel(idx) { return (2 * Math.PI) / (80 + idx * 40); }

  const electronAngles = [Math.PI / 2, Math.PI / 2, Math.PI / 2, Math.PI / 2, Math.PI / 2];

  /* ──────────────────────────────────────────
     MAIN RENDER LOOP
     ────────────────────────────────────────── */
  function animate(timestamp) {
    requestAnimationFrame(animate);
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > 0) fpsSmooth = fpsSmooth * 0.92 + (1000 / dt) * 0.08;

    if (!paused) {
      // Camera auto-rotation
      if (CONFIG.rotateCamera) {
        cameraAngle += CONFIG.cameraRotationSpeed * 0.008;
        const camH = 5 + Math.sin(cameraAngle * 0.3) * 3;
        camera.position.set(
          camDistance * Math.sin(cameraAngle), camH, camDistance * Math.cos(cameraAngle)
        );
        camera.lookAt(0, 0, 0);
      }

      // Nucleus pulse
      const pulse = 1 + 0.06 * Math.sin(timestamp * 0.003);
      nucleus.scale.setScalar(pulse);
      nucleusGlow.scale.setScalar(1 + 0.15 * Math.sin(timestamp * 0.003));
      nucleusGlow.material.opacity = 0.06 + 0.06 * Math.sin(timestamp * 0.003);

      // Electrons
      for (let idx = 0; idx < CONFIG.numLevels; idx++) {
        if (idx >= activeN) continue;
        const o = orbits[idx];
        electronAngles[idx] += getAngularVel(idx);
        const pt = orbitPoint(o.r, o.tiltRad, electronAngles[idx]);
        o.electron.position.copy(pt);

        // Hover highlight
        if (hoveredOrbitIdx === idx) {
          o.ring.material.opacity = 0.9;
          o.electron.scale.setScalar(1.5);
        } else {
          o.ring.material.opacity = 0.55;
          o.electron.scale.setScalar(1.0);
        }

        // Trail
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

    if (frame % 30 === 0) {
      const el = document.getElementById('fps-counter');
      if (el) el.textContent = Math.round(fpsSmooth) + ' fps';
    }
  }
  requestAnimationFrame(animate);

  /* ──────────────────────────────────────────
     RESIZE
     ────────────────────────────────────────── */
  function onResize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', onResize);

  /* ──────────────────────────────────────────
     ZOOM (scroll wheel + pinch)
     ────────────────────────────────────────── */
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camDistance = Math.max(6, Math.min(50, camDistance + e.deltaY * 0.02));
    if (!CONFIG.rotateCamera) {
      camera.position.normalize().multiplyScalar(camDistance);
      camera.position.y = Math.max(camera.position.y, 1);
      camera.lookAt(0, 0, 0);
    }
  }, { passive: false });

  // Pinch zoom
  let lastPinchDist = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = lastPinchDist - dist;
      camDistance = Math.max(6, Math.min(50, camDistance + delta * 0.05));
      lastPinchDist = dist;
      if (!CONFIG.rotateCamera) {
        camera.position.normalize().multiplyScalar(camDistance);
        camera.lookAt(0, 0, 0);
      }
    }
  }, { passive: false });

  /* ──────────────────────────────────────────
     MOUSE DRAG
     ────────────────────────────────────────── */
  let isDragging = false;
  let lastMouseX = 0, lastMouseY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    CONFIG.rotateCamera = false;
    const ct = document.getElementById('ctrl-camera-rotate');
    if (ct) ct.checked = false;
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
    camera.position.set(
      camDistance * Math.sin(cameraAngle) * Math.cos(camPhi),
      camDistance * Math.sin(camPhi) + 5,
      camDistance * Math.cos(cameraAngle) * Math.cos(camPhi)
    );
    camera.lookAt(0, 0, 0);
  });

  // Touch drag (single finger)
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      lastMouseX = e.touches[0].clientX;
      lastMouseY = e.touches[0].clientY;
      CONFIG.rotateCamera = false;
    }
  });
  window.addEventListener('touchend', () => { isDragging = false; });
  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastMouseX;
    const dy = e.touches[0].clientY - lastMouseY;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    cameraAngle += dx * 0.008;
    camPhi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, camPhi + dy * 0.008));
    camera.position.set(
      camDistance * Math.sin(cameraAngle) * Math.cos(camPhi),
      camDistance * Math.sin(camPhi) + 5,
      camDistance * Math.cos(cameraAngle) * Math.cos(camPhi)
    );
    camera.lookAt(0, 0, 0);
  }, { passive: false });

  /* ──────────────────────────────────────────
     FULLSCREEN / IMMERSIVE MODE
     ────────────────────────────────────────── */
  const fullscreenBtn = document.getElementById('ctrl-fullscreen');
  const canvasArea = document.querySelector('.lab-canvas-area');
  if (fullscreenBtn && canvasArea) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        canvasArea.requestFullscreen().then(() => {
          fullscreenBtn.textContent = '⛶ Exit Fullscreen';
          setTimeout(onResize, 100);
        }).catch(() => {});
      } else {
        document.exitFullscreen();
        fullscreenBtn.textContent = '⛶ Fullscreen';
        setTimeout(onResize, 100);
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        fullscreenBtn.textContent = '⛶ Fullscreen';
        setTimeout(onResize, 100);
      }
    });
  }

  /* ──────────────────────────────────────────
     CONTROL PANEL WIRING
     ────────────────────────────────────────── */
  function updateSliderTrack(input) {
    const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, var(--accent-cyan) ${pct}%, var(--bg-card) ${pct}%)`;
  }

  // N slider
  const nSlider = document.getElementById('ctrl-n-levels');
  const nDisplay = document.getElementById('val-n-levels');
  if (nSlider) {
    nSlider.addEventListener('input', () => {
      nDisplay.textContent = nSlider.value;
      applyVisibility(parseInt(nSlider.value));
      updateSliderTrack(nSlider);
    });
    updateSliderTrack(nSlider);
  }

  // Orbital Scale slider
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

  // Z slider (Atomic Number)
  const zSlider = document.getElementById('ctrl-z');
  const zDisplay = document.getElementById('val-z');
  if (zSlider) {
    zSlider.addEventListener('input', () => {
      CONFIG.atomicNumber = parseInt(zSlider.value);
      zDisplay.textContent = zSlider.value;
      updateSliderTrack(zSlider);
    });
    updateSliderTrack(zSlider);
  }

  // Toggles
  const camToggle = document.getElementById('ctrl-camera-rotate');
  if (camToggle) {
    camToggle.checked = CONFIG.rotateCamera;
    camToggle.addEventListener('change', () => { CONFIG.rotateCamera = camToggle.checked; });
  }

  const trailToggle = document.getElementById('ctrl-trails');
  if (trailToggle) {
    trailToggle.addEventListener('change', () => { CONFIG.showTrails = trailToggle.checked; });
  }

  const labelToggle = document.getElementById('ctrl-labels');
  if (labelToggle) {
    labelToggle.checked = CONFIG.showLabels;
    labelToggle.addEventListener('change', () => { CONFIG.showLabels = labelToggle.checked; });
  }

  const qInfoToggle = document.getElementById('ctrl-quantum-info');
  if (qInfoToggle) {
    qInfoToggle.checked = CONFIG.showQuantumInfo;
    qInfoToggle.addEventListener('change', () => { CONFIG.showQuantumInfo = qInfoToggle.checked; });
  }

  // Pause
  const pauseBtn = document.getElementById('ctrl-pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? '▶ Play' : '⏸ Pause';
    });
  }

  // Reset
  const resetBtn = document.getElementById('ctrl-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeN = 5;
      CONFIG.bohrRadius = 1.0;
      CONFIG.rotateCamera = true;
      CONFIG.showTrails = false;
      CONFIG.showLabels = true;
      CONFIG.showQuantumInfo = true;
      CONFIG.atomicNumber = 1;
      camDistance = 18;
      paused = false;
      electronAngles.fill(Math.PI / 2);
      if (nSlider) { nSlider.value = 5; nDisplay.textContent = 5; updateSliderTrack(nSlider); }
      if (speedSlider) { speedSlider.value = 1; speedDisplay.textContent = '1×'; updateSliderTrack(speedSlider); }
      if (zSlider) { zSlider.value = 1; zDisplay.textContent = 1; updateSliderTrack(zSlider); }
      if (camToggle) camToggle.checked = true;
      if (trailToggle) trailToggle.checked = false;
      if (labelToggle) labelToggle.checked = true;
      if (qInfoToggle) qInfoToggle.checked = true;
      if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
      applyVisibility(5);
    });
  }

})();
