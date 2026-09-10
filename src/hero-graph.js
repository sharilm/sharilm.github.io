import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  LineBasicMaterial,
  LineSegments,
  Group,
} from 'three';

// Minimal "systems network" scene: a sparse node graph that drifts slowly and
// tilts toward the pointer. Kept deliberately small (points + line segments
// only, no loaders/materials/lights beyond what's used) so the bundle stays
// lean, and paused whenever off-screen or the tab is hidden.
function init() {
  const canvas = document.getElementById('hero-scene');
  if (!canvas) return;
  const container = canvas.parentElement;

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    return;
  }

  const NODE_COUNT = 32;
  const CONNECT_DIST = 2.6;
  const MAX_LINES = NODE_COUNT * 6;

  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const group = new Group();
  scene.add(group);

  const positions = new Float32Array(NODE_COUNT * 3);
  const seeds = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const r = 3.3 * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi) * 0.6;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds.push({ ox: x, oy: y, oz: z, t: Math.random() * Math.PI * 2 });
  }

  const pointsGeo = new BufferGeometry();
  pointsGeo.setAttribute('position', new BufferAttribute(positions, 3));
  const pointsMat = new PointsMaterial({
    color: 0x1d4ed8,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });
  group.add(new Points(pointsGeo, pointsMat));

  const linePositions = new Float32Array(MAX_LINES * 2 * 3);
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(linePositions, 3));
  const lineMat = new LineBasicMaterial({ color: 0x15181f, transparent: true, opacity: 0.14 });
  const lines = new LineSegments(lineGeo, lineMat);
  group.add(lines);

  function updateLines() {
    const arr = pointsGeo.attributes.position.array;
    let idx = 0;
    for (let i = 0; i < NODE_COUNT && idx < MAX_LINES; i++) {
      for (let j = i + 1; j < NODE_COUNT && idx < MAX_LINES; j++) {
        const dx = arr[i * 3] - arr[j * 3];
        const dy = arr[i * 3 + 1] - arr[j * 3 + 1];
        const dz = arr[i * 3 + 2] - arr[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < CONNECT_DIST * CONNECT_DIST) {
          linePositions[idx * 3] = arr[i * 3];
          linePositions[idx * 3 + 1] = arr[i * 3 + 1];
          linePositions[idx * 3 + 2] = arr[i * 3 + 2];
          idx++;
          linePositions[idx * 3] = arr[j * 3];
          linePositions[idx * 3 + 1] = arr[j * 3 + 1];
          linePositions[idx * 3 + 2] = arr[j * 3 + 2];
          idx++;
        }
      }
    }
    lineGeo.setDrawRange(0, idx);
    lineGeo.attributes.position.needsUpdate = true;
  }
  updateLines();

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight || w;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  let targetRotX = 0;
  let targetRotY = 0;
  let curRotX = 0;
  let curRotY = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      targetRotY = ((e.clientX / window.innerWidth) * 2 - 1) * 0.25;
      targetRotX = ((e.clientY / window.innerHeight) * 2 - 1) * 0.15;
    },
    { passive: true }
  );

  let raf = null;
  let visible = true;
  let t = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    t += 0.004;
    const arr = pointsGeo.attributes.position.array;
    for (let i = 0; i < NODE_COUNT; i++) {
      const s = seeds[i];
      arr[i * 3] = s.ox + Math.sin(t + s.t) * 0.25;
      arr[i * 3 + 1] = s.oy + Math.cos(t * 0.8 + s.t) * 0.25;
      arr[i * 3 + 2] = s.oz + Math.sin(t * 0.6 + s.t) * 0.2;
    }
    pointsGeo.attributes.position.needsUpdate = true;
    updateLines();

    curRotX += (targetRotX - curRotX) * 0.05;
    curRotY += (targetRotY - curRotY) * 0.05;
    group.rotation.x = curRotX;
    group.rotation.y = t * 0.15 + curRotY;

    renderer.render(scene, camera);
  }

  function play() {
    if (!raf) frame();
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (visible) play();
  });

  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) play();
      else pause();
    },
    { threshold: 0.01 }
  ).observe(canvas);

  play();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
