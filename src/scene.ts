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

const ACCENT_RGB: Record<string, { dark: string; light: string }> = {
  lime: { dark: '216, 255, 71', light: '168, 201, 0' },
  cyan: { dark: '51, 242, 235', light: '10, 168, 163' },
  coral: { dark: '255, 107, 97', light: '226, 74, 66' },
  violet: { dark: '184, 97, 255', light: '154, 63, 224' },
}

function themePaint() {
  const key = document.documentElement.getAttribute('data-accent') ?? 'lime'
  const rgb = (ACCENT_RGB[key] ?? ACCENT_RGB.lime)!
  if (isLightTheme()) {
    return { rgb: rgb.light, rest: 0.42, near: 0.88, glow: 0.18 }
  }
  return { rgb: rgb.dark, rest: 0.58, near: 1, glow: 0.28 }
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
  let gap = 34
  let rowH = 34 * 0.8660254

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, active: false }
  let armed = false

  const COPY_SEL = '.studio-copy, .contact-note'
  const COPY_DIM = 0.22
  const copyEls = [...document.querySelectorAll<HTMLElement>(COPY_SEL)]
  const copyBoxes: Array<{ l: number; t: number; r: number; b: number }> = []

  const syncCopyBoxes = () => {
    copyBoxes.length = 0
    const cr = canvas.getBoundingClientRect()
    for (const el of copyEls) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      if (r.bottom < cr.top || r.top > cr.bottom || r.right < cr.left || r.left > cr.right) {
        continue
      }
      copyBoxes.push({
        l: r.left - cr.left,
        t: r.top - cr.top,
        r: r.right - cr.left,
        b: r.bottom - cr.top,
      })
    }
  }

  const underCopy = (x: number, y: number) => {
    for (const box of copyBoxes) {
      if (x >= box.l && x <= box.r && y >= box.t && y <= box.b) return true
    }
    return false
  }

  const wrap = (v: number, span: number) => {
    if (span <= 0) return v
    return ((v % span) + span) % span
  }

  const rebuild = () => {
    dots.length = 0
    const short = Math.min(width, height)
    gap = short < 640 ? 42 : 34
    while ((width / gap) * (height / (gap * 0.866)) > 1900) gap += 2

    rowH = gap * 0.8660254
    const minDist = gap * 0.56
    const minDist2 = minDist * minDist
    const lineEps = 5.4
    const lineReach = gap * 1.85
    const cell = minDist
    const cols = Math.ceil(width / gap) + 3
    const rows = Math.ceil(height / rowH) + 3
    const buckets = new Map<string, Array<{ x: number; y: number }>>()

    const cellKey = (x: number, y: number) =>
      `${Math.floor(x / cell)},${Math.floor(y / cell)}`

    const neighbors = (x: number, y: number) => {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const out: Array<{ x: number; y: number }> = []
      for (let iy = -4; iy <= 4; iy++) {
        for (let ix = -4; ix <= 4; ix++) {
          const bucket = buckets.get(`${cx + ix},${cy + iy}`)
          if (bucket) out.push(...bucket)
        }
      }
      return out
    }

    const usable = (x: number, y: number) => {
      for (const p of neighbors(x, y)) {
        const dx = x - p.x
        const dy = y - p.y
        if (dx * dx + dy * dy < minDist2) return false
        const adx = Math.abs(dx)
        const ady = Math.abs(dy)
        if (adx < lineReach && ady < lineEps) return false
        if (ady < lineReach && adx < lineEps) return false
      }
      return true
    }

    const remember = (x: number, y: number) => {
      const key = cellKey(x, y)
      const bucket = buckets.get(key)
      if (bucket) bucket.push({ x, y })
      else buckets.set(key, [{ x, y }])
    }

    for (let row = 0; row < rows; row++) {
      const odd = row & 1
      for (let col = 0; col < cols; col++) {
        const n = row * 97 + col * 13
        const bx = (col - 1) * gap + odd * gap * 0.5
        const by = (row - 1) * rowH
        let hx = 0
        let hy = 0
        let placed = false
        for (let t = 0; t < 28; t++) {
          const ang = hash(n + t * 2.37 + 0.11) * TAU
          const mag = (0.2 + hash(n + t * 5.91 + 4.1) * 0.8) * gap
          const x = bx + Math.cos(ang) * mag
          const y = by + Math.sin(ang) * mag
          if (!usable(x, y)) continue
          hx = x
          hy = y
          placed = true
          break
        }
        if (!placed) continue
        remember(hx, hy)
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
    syncCopyBoxes()

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
      const quiet = underCopy(d.x, d.y)
      const a = (rest + heat * (near - rest)) * (quiet ? COPY_DIM : 1)

      if (heat > 0.28 && !quiet) {
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

    scrollSmooth += (scrollProgress - scrollSmooth) * 0.035
    pointer.x += (pointer.tx - pointer.x) * 0.18
    pointer.y += (pointer.ty - pointer.y) * 0.18
    pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * 0.1

    const radius = radiusFor()
    const radius2 = radius * radius
    const spanX = width + gap * 2
    const spanY = height + rowH * 2
    const ox = scrollSmooth * gap * 4
    const oy = scrollSmooth * height * 0.7
    const pushMax = radius * 0.58 * pointer.strength
    const swirl = 0.2

    for (const d of dots) {
      let tx = wrap(d.hx + ox + gap, spanX) - gap
      let ty = wrap(d.hy + oy + rowH, spanY) - rowH
      if (Math.abs(tx - d.x) > spanX * 0.45) {
        d.x = tx
        d.vx = 0
      }
      if (Math.abs(ty - d.y) > spanY * 0.45) {
        d.y = ty
        d.vy = 0
      }
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
    attributeFilter: ['data-theme', 'data-accent'],
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
