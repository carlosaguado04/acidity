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
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three'

export type SceneHandle = {
  setScrollProgress: (p: number) => void
  dispose: () => void
}

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
      rim: new Color('#a8c900'),
      bgClear: 0x000000,
    }
  }
  return {
    wire: new Color('#d8ff47'),
    core: new Color('#d8ff47'),
    mist: new Color('#23262c'),
    rim: new Color('#d8ff47'),
    bgClear: 0x000000,
  }
}

/** Low-poly wire crystal with optional explode offsets stored per vertex. */
function buildWireCrystal(): {
  lines: LineSegments
  basePositions: Float32Array
  explodeDirs: Float32Array
} {
  const geo = new SphereGeometry(1.15, 3, 4)
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

  const basePositions = new Float32Array(edges)
  const explodeDirs = new Float32Array(edges.length)
  for (let i = 0; i < edges.length; i += 3) {
    const x = edges[i]
    const y = edges[i + 1]
    const z = edges[i + 2]
    const len = Math.hypot(x, y, z) || 1
    explodeDirs[i] = x / len
    explodeDirs[i + 1] = y / len
    explodeDirs[i + 2] = z / len
  }

  const lineGeo = new BufferGeometry()
  lineGeo.setAttribute('position', new Float32BufferAttribute(edges, 3))

  const mat = new LineBasicMaterial({
    color: themeColors().wire,
    transparent: true,
    opacity: isLightTheme() ? 0.4 : 0.62,
  })

  return {
    lines: new LineSegments(lineGeo, mat),
    basePositions,
    explodeDirs,
  }
}

function buildCore(): Mesh {
  return new Mesh(
    new SphereGeometry(0.26, 32, 32),
    new MeshStandardMaterial({
      color: themeColors().core,
      emissive: themeColors().core,
      emissiveIntensity: isLightTheme() ? 0.2 : 0.45,
      roughness: 0.28,
      metalness: 0.15,
      transparent: true,
      opacity: isLightTheme() ? 0.6 : 0.9,
    }),
  )
}

function buildInnerShell(): Mesh {
  return new Mesh(
    new SphereGeometry(0.72, 24, 24),
    new MeshStandardMaterial({
      color: themeColors().wire,
      emissive: themeColors().rim,
      emissiveIntensity: isLightTheme() ? 0.04 : 0.12,
      roughness: 0.55,
      metalness: 0.05,
      transparent: true,
      opacity: isLightTheme() ? 0.06 : 0.1,
      depthWrite: false,
    }),
  )
}

function buildMist(): Points {
  const count = 72
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 1.5 + Math.random() * 1.8
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
    size: 0.032,
    transparent: true,
    opacity: isLightTheme() ? 0.32 : 0.48,
    depthWrite: false,
  })
  return new Points(geo, mat)
}

export function mountScene(canvas: HTMLCanvasElement): SceneHandle {
  const reduced = prefersReducedMotion()
  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(0.2, 0.12, 4.4)

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(themeColors().bgClear, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const root = new Group()
  root.position.set(0.9, 0.28, 0)
  scene.add(root)

  const { lines: crystal, basePositions, explodeDirs } = buildWireCrystal()
  const core = buildCore()
  const shell = buildInnerShell()
  const mist = buildMist()
  root.add(crystal, shell, core, mist)

  scene.add(new AmbientLight(0xffffff, 0.45))
  const keyLight = new DirectionalLight(0xffffff, 0.7)
  keyLight.position.set(2.2, 3.2, 4)
  scene.add(keyLight)

  const rimLight = new PointLight(themeColors().rim.getHex(), 0.55, 8, 2)
  rimLight.position.set(-1.6, 0.8, 2.2)
  scene.add(rimLight)

  const fillRim = new PointLight(themeColors().rim.getHex(), 0.22, 6, 2)
  fillRim.position.set(1.4, -1.2, -1.5)
  scene.add(fillRim)

  let raf = 0
  let running = true
  let scrollProgress = 0
  let scrollSmooth = 0

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  const onPointer = (e: PointerEvent) => {
    if (reduced) return
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    pointer.tx = nx * 0.28
    pointer.ty = -ny * 0.2
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
    ;(crystal.material as LineBasicMaterial).opacity = isLightTheme() ? 0.4 : 0.62
    const coreMat = core.material as MeshStandardMaterial
    coreMat.color.copy(c.core)
    coreMat.emissive.copy(c.core)
    coreMat.emissiveIntensity = isLightTheme() ? 0.2 : 0.45
    coreMat.opacity = isLightTheme() ? 0.6 : 0.9
    const shellMat = shell.material as MeshStandardMaterial
    shellMat.color.copy(c.wire)
    shellMat.emissive.copy(c.rim)
    shellMat.emissiveIntensity = isLightTheme() ? 0.04 : 0.12
    shellMat.opacity = isLightTheme() ? 0.06 : 0.1
    ;(mist.material as PointsMaterial).color.copy(c.mist)
    ;(mist.material as PointsMaterial).opacity = isLightTheme() ? 0.32 : 0.48
    rimLight.color.copy(c.rim)
    fillRim.color.copy(c.rim)
  }

  const themeObserver = new MutationObserver(applyThemeMaterials)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  const applyExplode = (amount: number) => {
    const attr = crystal.geometry.getAttribute('position')
    const arr = attr.array as Float32Array
    for (let i = 0; i < basePositions.length; i++) {
      arr[i] = basePositions[i] + explodeDirs[i] * amount
    }
    attr.needsUpdate = true
  }

  const t0 = performance.now()

  const frame = (now: number) => {
    if (!running) return
    const t = (now - t0) / 1000

    scrollSmooth += (scrollProgress - scrollSmooth) * 0.06

    pointer.x += (pointer.tx - pointer.x) * 0.045
    pointer.y += (pointer.ty - pointer.y) * 0.045

    if (!reduced) {
      const spinBoost = 1 + scrollSmooth * 0.45
      root.rotation.y = t * 0.14 * spinBoost + pointer.x + scrollSmooth * 0.28
      root.rotation.x =
        Math.sin(t * 0.32) * 0.09 + pointer.y + scrollSmooth * 0.12
      root.rotation.z = scrollSmooth * 0.04

      const scale = 1 + scrollSmooth * 0.1
      root.scale.setScalar(scale)

      // Subtle explode / open as you scroll through the page
      applyExplode(scrollSmooth * 0.08)

      const pulse = 1 + Math.sin(t * 1.15) * 0.045
      core.scale.setScalar(pulse * (1 + scrollSmooth * 0.05))
      shell.scale.setScalar(1 + scrollSmooth * 0.03)
      mist.rotation.y = -t * 0.06 - scrollSmooth * 0.15
      mist.rotation.x = scrollSmooth * 0.08

      // Parallax camera pull
      camera.position.z = 4.4 - scrollSmooth * 0.2
      camera.position.y = 0.12 + scrollSmooth * 0.05
      camera.lookAt(0.5, 0.2, 0)

      rimLight.intensity = 0.45 + scrollSmooth * 0.2
    } else {
      root.rotation.y = 0.45
      root.rotation.x = 0.12
      applyExplode(0)
    }

    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }

  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointer, { passive: true })
  raf = requestAnimationFrame(frame)

  return {
    setScrollProgress(p: number) {
      scrollProgress = Math.min(1, Math.max(0, p))
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      themeObserver.disconnect()
      crystal.geometry.dispose()
      ;(crystal.material as LineBasicMaterial).dispose()
      core.geometry.dispose()
      ;(core.material as MeshStandardMaterial).dispose()
      shell.geometry.dispose()
      ;(shell.material as MeshStandardMaterial).dispose()
      mist.geometry.dispose()
      ;(mist.material as PointsMaterial).dispose()
      renderer.dispose()
    },
  }
}
