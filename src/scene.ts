import {
  AmbientLight,
  BufferAttribute,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
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

/** Cheap hash noise in [-1, 1] — no extra deps. */
function hashNoise(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

function softNoise(x: number, y: number, z: number): number {
  const i = Math.floor(x)
  const j = Math.floor(y)
  const k = Math.floor(z)
  const fx = x - i
  const fy = y - j
  const fz = z - k
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const uz = fz * fz * (3 - 2 * fz)

  const n000 = hashNoise(i, j, k)
  const n100 = hashNoise(i + 1, j, k)
  const n010 = hashNoise(i, j + 1, k)
  const n110 = hashNoise(i + 1, j + 1, k)
  const n001 = hashNoise(i, j, k + 1)
  const n101 = hashNoise(i + 1, j, k + 1)
  const n011 = hashNoise(i, j + 1, k + 1)
  const n111 = hashNoise(i + 1, j + 1, k + 1)

  const nx00 = n000 * (1 - ux) + n100 * ux
  const nx10 = n010 * (1 - ux) + n110 * ux
  const nx01 = n001 * (1 - ux) + n101 * ux
  const nx11 = n011 * (1 - ux) + n111 * ux
  const nxy0 = nx00 * (1 - uy) + nx10 * uy
  const nxy1 = nx01 * (1 - uy) + nx11 * uy
  return nxy0 * (1 - uz) + nxy1 * uz
}

function themePalette() {
  if (isLightTheme()) {
    return {
      blob: new Color('#0C0D10'),
      blobRough: 0.92,
      eye: new Color('#F4F4F2'),
      pupil: new Color('#0C0D10'),
      brow: new Color('#050506'),
      rim: new Color('#D8FF47'),
      rimIntensity: 0.16,
      keyIntensity: 1.05,
      ambient: 0.58,
    }
  }
  // Lifted charcoal so the form reads on ink #0C0D10
  return {
    blob: new Color('#1B1D24'),
    blobRough: 0.88,
    eye: new Color('#F4F4F2'),
    pupil: new Color('#0C0D10'),
    brow: new Color('#090A0C'),
    rim: new Color('#D8FF47'),
    rimIntensity: 0.26,
    keyIntensity: 0.8,
    ambient: 0.4,
  }
}

type BlobBits = {
  body: Mesh
  basePositions: Float32Array
  face: Group
  leftPupil: Mesh
  rightPupil: Mesh
  materials: MeshStandardMaterial[]
}

function buildBlob(): BlobBits {
  const geo = new SphereGeometry(1.05, 48, 48)
  const pos = geo.attributes.position as BufferAttribute
  const basePositions = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    // Soft gumdrop: wider mid, gentle top taper
    const ny = (y + 1.05) / 2.1
    const waist = 1 + 0.14 * Math.sin(ny * Math.PI)
    const taper = 1 - 0.2 * Math.pow(Math.max(0, ny - 0.32), 1.55)
    x *= waist * taper
    z *= waist * taper
    y *= 0.9
    const lump = 1 + softNoise(x * 1.35, y * 1.35, z * 1.35) * 0.05
    x *= lump
    y *= lump
    z *= lump
    pos.setXYZ(i, x, y, z)
    basePositions[i * 3] = x
    basePositions[i * 3 + 1] = y
    basePositions[i * 3 + 2] = z
  }
  geo.computeVertexNormals()

  const pal = themePalette()
  const bodyMat = new MeshStandardMaterial({
    color: pal.blob,
    roughness: pal.blobRough,
    metalness: 0.02,
  })
  const body = new Mesh(geo, bodyMat)

  const face = new Group()
  face.position.set(0, 0.16, 0.82)

  // Semi-ish eye discs (arc) — grumpy inward tilt lives in group rotation
  const eyeGeo = new CircleGeometry(0.26, 28, 0.2, Math.PI * 1.05)
  const pupilGeo = new CircleGeometry(0.05, 14)
  const browGeo = new SphereGeometry(0.032, 8, 8)

  const eyeMat = new MeshStandardMaterial({
    color: pal.eye,
    roughness: 0.42,
    metalness: 0,
    emissive: pal.eye,
    emissiveIntensity: 0.18,
  })
  const pupilMat = new MeshStandardMaterial({
    color: pal.pupil,
    roughness: 0.75,
    metalness: 0,
  })
  const browMat = new MeshStandardMaterial({
    color: pal.brow,
    roughness: 0.95,
    metalness: 0,
  })

  const materials = [bodyMat, eyeMat, pupilMat, browMat]

  function makeEye(side: 1 | -1): { group: Group; pupil: Mesh } {
    const group = new Group()
    group.position.set(side * 0.3, 0.04, 0.01)
    // Inward furrow angle
    group.rotation.z = side * 0.35

    const white = new Mesh(eyeGeo, eyeMat)
    white.scale.set(0.95, 0.72, 1)
    group.add(white)

    const pupil = new Mesh(pupilGeo, pupilMat)
    // Pupils tucked toward center-bottom (grumpy)
    pupil.position.set(side * -0.06, -0.05, 0.025)
    group.add(pupil)

    // Furrowed brow — short chain of soft blobs above the eye
    for (let b = 0; b < 5; b++) {
      const t = b / 4
      const brow = new Mesh(browGeo, browMat)
      brow.position.set(
        side * (0.05 + t * 0.26),
        0.18 - t * 0.05 + (side === 1 ? t * 0.03 : 0),
        0.05,
      )
      brow.scale.set(1.6 - t * 0.2, 0.65, 0.65)
      group.add(brow)
    }

    return { group, pupil }
  }

  const left = makeEye(-1)
  const right = makeEye(1)
  // Right brow sits a touch higher — skeptical cousin energy
  right.group.children.forEach((child, idx) => {
    if (idx === 0 || idx === 1) return // eye + pupil
    child.position.y += 0.025
  })
  face.add(left.group, right.group)
  body.add(face)

  return {
    body,
    basePositions,
    face,
    leftPupil: left.pupil,
    rightPupil: right.pupil,
    materials,
  }
}

export function mountScene(canvas: HTMLCanvasElement): SceneHandle {
  const reduced = prefersReducedMotion()
  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(0.15, 0.1, 4.2)

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const root = new Group()
  root.position.set(1.05, 0.05, 0)
  scene.add(root)

  const blob = buildBlob()
  root.add(blob.body)

  let pal = themePalette()
  const ambient = new AmbientLight(0xffffff, pal.ambient)
  scene.add(ambient)

  const keyLight = new DirectionalLight(0xffffff, pal.keyIntensity)
  keyLight.position.set(2.4, 3.4, 4.2)
  scene.add(keyLight)

  const fill = new DirectionalLight(0xffffff, 0.28)
  fill.position.set(-2.2, 0.6, 2)
  scene.add(fill)

  // Sparse acid rim — brand accent only
  const rimLight = new PointLight(pal.rim.getHex(), pal.rimIntensity, 7, 2)
  rimLight.position.set(-1.5, 0.6, 2.4)
  scene.add(rimLight)

  const topKiss = new PointLight(0xffffff, 0.38, 6, 2)
  topKiss.position.set(0.35, 2.15, 1.6)
  scene.add(topKiss)

  let raf = 0
  let running = true
  let scrollProgress = 0
  let scrollSmooth = 0
  let frameCount = 0
  const baseRootScale = { current: 1 }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  const onPointer = (e: PointerEvent) => {
    if (reduced) return
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    pointer.tx = nx
    pointer.ty = -ny
  }

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)

    if (width < 720) {
      root.position.set(0.15, -0.35, -0.4)
      baseRootScale.current = 0.78
    } else if (width < 980) {
      root.position.set(0.75, -0.05, 0)
      baseRootScale.current = 0.9
    } else {
      root.position.set(1.05, 0.05, 0)
      baseRootScale.current = 1
    }
    root.scale.setScalar(baseRootScale.current)
  }

  const applyThemeMaterials = () => {
    pal = themePalette()
    const [bodyMat, eyeMat, pupilMat, browMat] = blob.materials
    bodyMat.color.copy(pal.blob)
    bodyMat.roughness = pal.blobRough
    eyeMat.color.copy(pal.eye)
    eyeMat.emissive.copy(pal.eye)
    pupilMat.color.copy(pal.pupil)
    browMat.color.copy(pal.brow)
    ambient.intensity = pal.ambient
    keyLight.intensity = pal.keyIntensity
    rimLight.color.copy(pal.rim)
    rimLight.intensity = pal.rimIntensity
  }

  const themeObserver = new MutationObserver(applyThemeMaterials)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  const displaceBlob = (
    t: number,
    breathe: number,
    leanX: number,
    leanY: number,
    updateNormals: boolean,
  ) => {
    const attr = blob.body.geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    const base = blob.basePositions
    for (let i = 0; i < base.length; i += 3) {
      const bx = base[i]
      const by = base[i + 1]
      const bz = base[i + 2]
      const n =
        softNoise(bx * 1.1 + t * 0.35, by * 1.1, bz * 1.1 + t * 0.28) * 0.05 +
        softNoise(bx * 2.1 - t * 0.2, by * 2.1 + t * 0.22, bz * 2.1) * 0.02
      const lean = leanX * bx * 0.035 + leanY * by * 0.025
      const pulse = 1 + breathe * 0.028 + n + lean
      arr[i] = bx * pulse
      arr[i + 1] = by * (1 + breathe * 0.04 + n * 0.55)
      arr[i + 2] = bz * pulse
    }
    attr.needsUpdate = true
    if (updateNormals) blob.body.geometry.computeVertexNormals()
  }

  const t0 = performance.now()

  const frame = (now: number) => {
    if (!running) return
    const t = (now - t0) / 1000
    frameCount += 1

    scrollSmooth += (scrollProgress - scrollSmooth) * 0.08
    pointer.x += (pointer.tx - pointer.x) * 0.06
    pointer.y += (pointer.ty - pointer.y) * 0.06

    if (!reduced) {
      const breathe = Math.sin(t * 1.35)
      const wobble = Math.sin(t * 0.9) * 0.045

      // Mild scroll squash — short travel, not a long pin journey
      const scrollSquash = scrollSmooth * 0.12
      const bounce = Math.sin(scrollSmooth * Math.PI) * 0.04

      const sx = 1.05 + scrollSquash * 0.35 + breathe * -0.02
      const sy = 0.95 - scrollSquash * 0.45 + breathe * 0.035 + bounce
      const sz = 1.05 + scrollSquash * 0.25 + breathe * -0.02
      blob.body.scale.set(sx, sy, sz)

      root.rotation.y = wobble + pointer.x * 0.22
      root.rotation.x = Math.sin(t * 0.7) * 0.04 + pointer.y * 0.14
      root.rotation.z = -pointer.x * 0.06 + scrollSmooth * 0.03

      blob.face.rotation.y = pointer.x * 0.28
      blob.face.rotation.x = -pointer.y * 0.18

      const pupilX = pointer.x * 0.055
      const pupilY = pointer.y * 0.045
      blob.leftPupil.position.x = 0.06 + pupilX
      blob.leftPupil.position.y = -0.05 + pupilY
      blob.rightPupil.position.x = -0.06 + pupilX
      blob.rightPupil.position.y = -0.05 + pupilY

      displaceBlob(t, breathe, pointer.x, pointer.y, frameCount % 2 === 0)

      camera.position.z = 4.2 - scrollSmooth * 0.12
      camera.lookAt(0.55, 0.1, 0)
      rimLight.intensity = pal.rimIntensity + scrollSmooth * 0.05
    } else {
      blob.body.scale.set(1.05, 0.96, 1.05)
      root.rotation.set(0.08, 0.35, -0.04)
      blob.face.rotation.set(-0.05, 0.12, 0)
      if (frameCount === 1) displaceBlob(0, 0.2, 0.15, -0.05, true)
      camera.lookAt(0.55, 0.1, 0)
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
      blob.body.geometry.dispose()
      blob.face.traverse((child) => {
        if (child instanceof Mesh) child.geometry.dispose()
      })
      for (const mat of blob.materials) mat.dispose()
      renderer.dispose()
    },
  }
}
