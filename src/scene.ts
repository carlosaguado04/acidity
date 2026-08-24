import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isLightTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light'
}

function themeColors() {
  if (isLightTheme()) {
    return {
      wire: new Color('#556600'),
      core: new Color('#a8c900'),
      mist: new Color('#9aa0aa'),
      bgClear: 0x000000,
    }
  }
  return {
    wire: new Color('#d8ff47'),
    core: new Color('#d8ff47'),
    mist: new Color('#23262c'),
    bgClear: 0x000000,
  }
}

/** Icosahedron-like wire crystal — quiet craft, not spectacle. */
function buildWireCrystal(): LineSegments {
  const geo = new SphereGeometry(1.15, 2, 3)
  const pos = geo.getAttribute('position')
  const edges: number[] = []
  const seen = new Set<string>()

  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)

  const index = geo.index
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i)
      const b = index.getX(i + 1)
      const c = index.getX(i + 2)
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const) {
        const k = key(u, v)
        if (seen.has(k)) continue
        seen.add(k)
        edges.push(
          pos.getX(u),
          pos.getY(u),
          pos.getZ(u),
          pos.getX(v),
          pos.getY(v),
          pos.getZ(v),
        )
      }
    }
  }

  const lineGeo = new BufferGeometry()
  lineGeo.setAttribute('position', new Float32BufferAttribute(edges, 3))

  const mat = new LineBasicMaterial({
    color: themeColors().wire,
    transparent: true,
    opacity: isLightTheme() ? 0.35 : 0.55,
  })

  return new LineSegments(lineGeo, mat)
}

function buildCore(): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(0.28, 32, 32),
    new MeshStandardMaterial({
      color: themeColors().core,
      emissive: themeColors().core,
      emissiveIntensity: isLightTheme() ? 0.15 : 0.35,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: isLightTheme() ? 0.55 : 0.85,
    }),
  )
  return mesh
}

function buildMist(): Points {
  const count = 48
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 1.6 + Math.random() * 1.4
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const mat = new PointsMaterial({
    color: themeColors().mist,
    size: 0.035,
    transparent: true,
    opacity: isLightTheme() ? 0.35 : 0.5,
    depthWrite: false,
  })
  return new Points(geo, mat)
}

export function mountScene(canvas: HTMLCanvasElement): () => void {
  const reduced = prefersReducedMotion()
  const scene = new Scene()
  const camera = new PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0.15, 0.1, 4.2)

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(themeColors().bgClear, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const root = new Group()
  root.position.set(0.85, 0.35, 0)
  scene.add(root)

  const crystal = buildWireCrystal()
  const core = buildCore()
  const mist = buildMist()
  root.add(crystal, core, mist)

  scene.add(new AmbientLight(0xffffff, 0.55))
  const keyLight = new DirectionalLight(0xffffff, 0.65)
  keyLight.position.set(2, 3, 4)
  scene.add(keyLight)

  let raf = 0
  let running = true

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  const onPointer = (e: PointerEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    pointer.tx = nx * 0.25
    pointer.ty = -ny * 0.18
  }

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  const applyThemeMaterials = () => {
    const c = themeColors()
    ;(crystal.material as LineBasicMaterial).color.copy(c.wire)
    ;(crystal.material as LineBasicMaterial).opacity = isLightTheme() ? 0.35 : 0.55
    const coreMat = core.material as MeshStandardMaterial
    coreMat.color.copy(c.core)
    coreMat.emissive.copy(c.core)
    coreMat.emissiveIntensity = isLightTheme() ? 0.15 : 0.35
    coreMat.opacity = isLightTheme() ? 0.55 : 0.85
    ;(mist.material as PointsMaterial).color.copy(c.mist)
    ;(mist.material as PointsMaterial).opacity = isLightTheme() ? 0.35 : 0.5
  }

  const themeObserver = new MutationObserver(applyThemeMaterials)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  const t0 = performance.now()

  const frame = (now: number) => {
    if (!running) return
    const t = (now - t0) / 1000

    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04

    if (!reduced) {
      root.rotation.y = t * 0.12 + pointer.x
      root.rotation.x = Math.sin(t * 0.35) * 0.08 + pointer.y
      core.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04)
      mist.rotation.y = -t * 0.05
    } else {
      root.rotation.y = 0.4
      root.rotation.x = 0.1
    }

    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointer, { passive: true })
  raf = requestAnimationFrame(frame)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointer)
    themeObserver.disconnect()
    crystal.geometry.dispose()
    ;(crystal.material as LineBasicMaterial).dispose()
    core.geometry.dispose()
    ;(core.material as MeshStandardMaterial).dispose()
    mist.geometry.dispose()
    ;(mist.material as PointsMaterial).dispose()
    renderer.dispose()
  }
}
