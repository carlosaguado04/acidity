export type SceneHandle = {
  setScrollProgress: (p: number) => void
  dispose: () => void
}

type Dot = {
  x: number
  y: number
  hx: number
  hy: number
  vx: number
  vy: number
  r: number
  seed: number
}

const TAU = Math.PI * 2

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isLightTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light'
}

function themePaint() {
  if (isLightTheme()) {
    return { rgb: '168, 201, 0', rest: 0.42, near: 0.88, glow: 0.18 }
  }
  return { rgb: '216, 255, 71', rest: 0.58, near: 1, glow: 0.28 }
}

function hash(n: number) {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

export function mountScene(canvas: HTMLCanvasElement): SceneHandle {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) {
    return {
      setScrollProgress() {},
      dispose() {},
    }
  }

  const reduced = prefersReducedMotion()
  const dots: Dot[] = []

  let width = 0
  let height = 0
  let raf = 0
  let running = true
  let scrollProgress = 0
  let scrollSmooth = 0
  let lastT = 0
  let paint = themePaint()

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, active: false }
  let armed = false

  const rebuild = () => {
    dots.length = 0
    const short = Math.min(width, height)
    let gap = short < 640 ? 42 : 34
    while ((width / gap) * (height / (gap * 0.866)) > 1900) gap += 2

    const rowH = gap * 0.8660254
    const cols = Math.ceil(width / gap) + 3
    const rows = Math.ceil(height / rowH) + 3

    for (let row = 0; row < rows; row++) {
      const odd = row & 1
      for (let col = 0; col < cols; col++) {
        const n = row * 97 + col * 13
        const jx = (hash(n) - 0.5) * gap * 0.32
        const jy = (hash(n + 4.1) - 0.5) * rowH * 0.32
        const hx = (col - 1) * gap + odd * gap * 0.5 + jx
        const hy = (row - 1) * rowH + jy
        const accent = hash(n + 2.7) > 0.88
        dots.push({
          x: hx,
          y: hy,
          hx,
          hy,
          vx: 0,
          vy: 0,
          r: (accent ? 3.2 : 2.15) + hash(n + 8.3) * 0.9,
          seed: hash(n + 11) * TAU,
        })
      }
    }
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const nextW = canvas.clientWidth || window.innerWidth
    const nextH = canvas.clientHeight || window.innerHeight
    if (nextW === width && nextH === height && canvas.width === Math.round(nextW * dpr)) {
      return
    }
    width = nextW
    height = nextH
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    rebuild()
    draw(reduced ? 0 : performance.now() / 1000)
  }

  const radiusFor = () => Math.min(220, Math.max(140, Math.min(width, height) * 0.22))

  const draw = (t: number) => {
    ctx.clearRect(0, 0, width, height)

    const radius = radiusFor()
    const radius2 = radius * radius
    const { rgb, rest, near, glow } = paint

    for (const d of dots) {
      const dx = d.x - pointer.x
      const dy = d.y - pointer.y
      const d2 = dx * dx + dy * dy
      const falloff = d2 < radius2 && d2 > 0.01 ? 1 - Math.sqrt(d2) / radius : 0
      const heat = falloff * pointer.strength
      const idle = reduced ? 0 : Math.sin(t * 0.7 + d.seed) * 0.35
      const r = d.r * (1 + heat * 1.55) + idle * 0.12
      const a = rest + heat * (near - rest)

      if (heat > 0.28) {
        ctx.beginPath()
        ctx.fillStyle = `rgba(${rgb}, ${heat * glow})`
        ctx.arc(d.x, d.y, r * 3.4, 0, TAU)
        ctx.fill()
      }

      ctx.beginPath()
      ctx.fillStyle = `rgba(${rgb}, ${a})`
      ctx.arc(d.x, d.y, r, 0, TAU)
      ctx.fill()
    }
  }

  const step = (now: number) => {
    if (!running) return
    const dt = lastT ? Math.min(2.2, (now - lastT) / 16.67) : 1
    lastT = now
    const t = now / 1000

    scrollSmooth += (scrollProgress - scrollSmooth) * 0.06
    pointer.x += (pointer.tx - pointer.x) * 0.18
    pointer.y += (pointer.ty - pointer.y) * 0.18
    pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * 0.1

    const radius = radiusFor()
    const radius2 = radius * radius
    const ox = Math.sin(scrollSmooth * Math.PI) * 18
    const oy = scrollSmooth * 28
    const pushMax = radius * 0.58 * pointer.strength
    const swirl = 0.2

    for (const d of dots) {
      let tx = d.hx + ox
      let ty = d.hy + oy
      const dx = d.x - pointer.x
      const dy = d.y - pointer.y
      const d2 = dx * dx + dy * dy

      if (d2 < radius2 && d2 > 0.25 && pointer.strength > 0.01) {
        const dist = Math.sqrt(d2)
        const f = 1 - dist / radius
        const push = f * f * pushMax
        const nx = dx / dist
        const ny = dy / dist
        tx += nx * push - ny * push * swirl
        ty += ny * push + nx * push * swirl
      }

      d.vx += (tx - d.x) * 0.18 * dt
      d.vy += (ty - d.y) * 0.18 * dt
      d.vx *= 0.76
      d.vy *= 0.76
      d.x += d.vx * dt
      d.y += d.vy * dt
    }

    draw(t)
    raf = requestAnimationFrame(step)
  }

  const onPointer = (e: PointerEvent) => {
    if (reduced) return
    const rect = canvas.getBoundingClientRect()
    pointer.tx = e.clientX - rect.left
    pointer.ty = e.clientY - rect.top
    if (!armed) {
      pointer.x = pointer.tx
      pointer.y = pointer.ty
      armed = true
    }
    pointer.active = true
  }

  const onLeave = (e: PointerEvent | Event) => {
    if ('relatedTarget' in e && e.relatedTarget) return
    pointer.active = false
  }

  const applyTheme = () => {
    paint = themePaint()
    if (reduced) draw(0)
  }

  const themeObserver = new MutationObserver(applyTheme)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  const onVisibility = () => {
    if (reduced) return
    if (document.hidden) {
      cancelAnimationFrame(raf)
      lastT = 0
    } else if (running) {
      raf = requestAnimationFrame(step)
    }
  }

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('pointerdown', onPointer, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  document.addEventListener('visibilitychange', onVisibility)

  if (!reduced) {
    raf = requestAnimationFrame(step)
  }

  return {
    setScrollProgress(p: number) {
      scrollProgress = Math.min(1, Math.max(0, p))
    },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      ro.disconnect()
      themeObserver.disconnect()
    },
  }
}
