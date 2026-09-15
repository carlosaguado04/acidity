(() => {
  const canvas = document.querySelector("[data-hero-canvas]");
  if (!canvas || typeof THREE === "undefined") return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flight = document.querySelector("[data-home-flight]") || document.body;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.2, 5.2);

  const group = new THREE.Group();
  scene.add(group);

  const colors = [0xe8ff3d, 0xff3b6b, 0xff7a3d, 0xffffff];
  const balls = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const size = 0.012 + Math.random() * 0.028;
    const geo = new THREE.SphereGeometry(size, 14, 14);
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      transparent: true,
      opacity: 0.5 + Math.random() * 0.4,
      depthWrite: false,
    });
    const s = new THREE.Mesh(geo, mat);
    const a = Math.random() * Math.PI * 2;
    const b = (Math.random() - 0.5) * Math.PI * 0.9;
    const r = 0.7 + Math.random() * 1.9;
    const x = Math.cos(a) * Math.cos(b) * r;
    const y = Math.sin(b) * r * 0.85;
    const z = Math.sin(a) * Math.cos(b) * r * 0.75;
    s.position.set(x, y, z);
    s.userData = {
      homeY: y,
      a,
      b,
      r,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.55,
      scrollAmp: 0.55 + Math.random() * 1.1,
    };
    group.add(s);
    balls.push(s);
  }

  let scrollT = 0;
  let targetScrollT = 0;
  let scrollVel = 0;
  let raf = 0;
  let frozen = reduce;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }

  function measure() {
    const rect = flight.getBoundingClientRect();
    const total = Math.max(rect.height - window.innerHeight, 1);
    targetScrollT = Math.max(0, Math.min(1, -rect.top / total));
    canvas.style.opacity = rect.bottom < 0 ? "0" : "0.95";
  }

  function paint(t) {
    const time = t * 0.001;
    const prev = scrollT;
    scrollT += (targetScrollT - scrollT) * 0.14;
    scrollVel += (scrollT - prev - scrollVel) * 0.35;

    if (!frozen) {
      // Same hero field behavior — scroll only carries / spins it, never collapses it
      group.rotation.y = time * 0.08 + scrollT * 1.35;
      group.rotation.x =
        Math.sin(time * 0.14) * 0.05 + scrollT * 0.4 + scrollVel * 3.2;
      group.rotation.z = scrollVel * 1.4;
      group.position.y = Math.sin(time * 0.18) * 0.04 - scrollT * 0.55;
      group.position.x = Math.sin(scrollT * Math.PI) * 0.22;
      group.scale.setScalar(1 + scrollT * 0.12 + Math.abs(scrollVel) * 0.9);

      balls.forEach((s, i) => {
        const u = s.userData;
        const ang = u.a + time * u.speed + scrollT * u.scrollAmp * 1.6;
        const expand =
          1 +
          scrollT * (0.35 + u.scrollAmp * 0.25) +
          scrollVel * 2.2 * (i % 2 === 0 ? 1 : -1);
        const rr = Math.max(u.r * 0.85, u.r * expand);

        s.position.x = Math.cos(ang) * Math.cos(u.b) * rr;
        s.position.z = Math.sin(ang) * Math.cos(u.b) * rr * 0.75;
        s.position.y =
          u.homeY * (1 + scrollT * 0.25) +
          Math.sin(time * u.speed * 1.6 + u.phase) * 0.05 +
          scrollVel * u.scrollAmp * 1.6;

        const pulse = 1 + scrollT * 0.25 + Math.min(Math.abs(scrollVel) * 5, 0.45);
        s.scale.setScalar(pulse);
        s.material.opacity = Math.min(
          0.95,
          0.4 + scrollT * 0.2 + Math.abs(scrollVel) * 4
        );
      });

      camera.position.z = 5.2 - scrollT * 1.1 - Math.abs(scrollVel) * 2.2;
      camera.position.x = scrollT * 0.35;
      camera.position.y = 0.2 + scrollT * 0.15 + scrollVel * 0.7;
      camera.lookAt(0, -scrollT * 0.25, 0);
    }

    renderer.render(scene, camera);
    if (!frozen) raf = requestAnimationFrame(paint);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", measure, { passive: true });
  measure();

  if (frozen) paint(0);
  else raf = requestAnimationFrame(paint);

  window.__acidityScene = {
    freeze() {
      frozen = true;
      if (raf) cancelAnimationFrame(raf);
      paint(performance.now());
    },
  };
})();
