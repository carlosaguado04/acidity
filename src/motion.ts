export type MotionHandle = {
  goTo: (id: string) => void
  destroy: () => void
}

const RAIL_IDS = ['studio', 'mise', 'orza', 'hilo', 'more', 'contact'] as const
type RailId = (typeof RAIL_IDS)[number]

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n))
}

function coverage(el: HTMLElement): number {
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0)
  if (visible <= 0) return 0
  return Math.min(1, visible / Math.min(Math.max(r.height, 1), vh))
}

export function initMotion(): MotionHandle {
  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const fineMq = window.matchMedia('(pointer: fine)')
  const cleanups: Array<() => void> = []
  const root = document.documentElement
  const railLinks = [...document.querySelectorAll<HTMLAnchorElement>('.rail a[data-rail]')]
  const sheetLinks = [...document.querySelectorAll<HTMLAnchorElement>('.index-sheet a[href^="#"]')]
  const tick = document.getElementById('rail-tick')
  const washLime = document.querySelector<HTMLElement>('[data-wash="mise"]')
  const washCyan = document.querySelector<HTMLElement>('[data-wash="orza"]')
  const washCoral = document.querySelector<HTMLElement>('[data-wash="hilo"]')
  const mise = document.getElementById('mise')
  const orza = document.getElementById('orza')
  const hilo = document.getElementById('hilo')
  const heroInner = document.querySelector<HTMLElement>('.hero-inner')
  const hero = document.getElementById('home')
  const cursor = document.querySelector<HTMLElement>('.cursor')
  const typeEls = [...document.querySelectorAll<HTMLElement>('[data-scroll-type]')]
  const railTargets = RAIL_IDS.map((id) => ({
    id,
    el: document.getElementById(id),
    link: railLinks.find((a) => a.dataset.rail === id),
  })).filter((row): row is { id: RailId; el: HTMLElement; link: HTMLAnchorElement } => {
    return row.el instanceof HTMLElement && row.link instanceof HTMLAnchorElement
  })

  let reduced = motionMq.matches
  let cursorOn = false
  let cursorRaf = 0
  let scrollRaf = 0
  let ptrX = 0
  let ptrY = 0
  let curX = 0
  let curY = 0
  let cursorHot = false
  let cursorArmed = false

  const setReduced = (on: boolean) => {
    reduced = on
    root.classList.toggle('reduced-motion', on)
    if (on) {
      typeEls.forEach((el) => {
        el.style.opacity = '1'
        el.style.filter = 'none'
        el.style.transform = 'none'
        el.classList.add('is-in')
      })
      if (heroInner) {
        heroInner.style.opacity = '1'
        heroInner.style.filter = 'none'
        heroInner.style.transform = 'none'
      }
    }
  }

  const stepCursor = () => {
    if (!cursorOn || !cursor) return
    curX += (ptrX - curX) * 0.22
    curY += (ptrY - curY) * 0.22
    cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`
    cursorRaf = requestAnimationFrame(stepCursor)
  }

  const setCursorMode = () => {
    const next = !reduced && fineMq.matches
    root.classList.toggle('has-cursor', next)
    if (cursorOn && !next) {
      cancelAnimationFrame(cursorRaf)
      cursorRaf = 0
      cursorOn = false
      if (cursor) cursor.style.opacity = '0'
    }
    if (next && !cursorOn) {
      cursorOn = true
      stepCursor()
    }
  }

  const setActive = (id: RailId | 'home') => {
    const href = `#${id}`
    ;[...railLinks, ...sheetLinks].forEach((link) => {
      const on = link.getAttribute('href') === href
      link.classList.toggle('is-active', on)
      if (on) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
  }

  const paintType = () => {
    const vh = window.innerHeight
    typeEls.forEach((el) => {
      if (reduced) return
      const r = el.getBoundingClientRect()
      const i = Number(el.dataset.i ?? 0)
      const enter = clamp((vh * 0.98 - i * 16 - r.top) / (vh * 0.2))
      let leave = 1
      if (r.bottom < vh * 0.14) {
        leave = clamp(0.45 + (r.bottom / (vh * 0.14)) * 0.55)
      }
      const t = Math.min(enter, leave)
      const blur = (1 - enter) * 7
      const y = (1 - enter) * 24
      el.style.opacity = String(t)
      el.style.filter = blur > 0.35 ? `blur(${blur.toFixed(2)}px)` : 'none'
      el.style.transform = y > 0.5 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : 'none'
      el.classList.toggle('is-in', enter > 0.72 && leave > 0.85)
    })
  }

  const paintHero = () => {
    if (!heroInner || !hero) return
    if (reduced) return
    const r = hero.getBoundingClientRect()
    const vh = window.innerHeight
    const vis = clamp(r.bottom / vh)
    const o = vis > 0.58 ? 1 : clamp(vis / 0.58)
    heroInner.style.opacity = String(o)
    heroInner.style.filter = o < 0.98 ? `blur(${((1 - o) * 10).toFixed(2)}px)` : 'none'
    heroInner.style.transform = o < 0.98 ? `translate3d(0, ${((1 - o) * -28).toFixed(1)}px, 0)` : 'none'
  }

  const paintWash = () => {
    const lime = mise instanceof HTMLElement ? coverage(mise) : 0
    const cyan = orza instanceof HTMLElement ? coverage(orza) : 0
    const coral = hilo instanceof HTMLElement ? coverage(hilo) : 0
    const snap = (n: number) => (reduced ? (n > 0.45 ? 1 : 0) : n)
    if (washLime) washLime.style.opacity = String(snap(lime))
    if (washCyan) washCyan.style.opacity = String(snap(cyan))
    if (washCoral) washCoral.style.opacity = String(snap(coral))

    let chapter = 'ink'
    if (coral > lime && coral > cyan && coral > 0.28) chapter = 'hilo'
    else if (cyan > lime && cyan > 0.28) chapter = 'orza'
    else if (lime > 0.28) chapter = 'mise'
    if (root.dataset.chapter !== chapter) root.dataset.chapter = chapter
  }

  const paintRail = () => {
    const mid = window.innerHeight * 0.42
    let current: RailId | 'home' = 'home'
    let idx = 0
    let frac = 0
    for (let i = 0; i < railTargets.length; i++) {
      const row = railTargets[i]
      if (!row) continue
      const top = row.el.getBoundingClientRect().top
      if (top <= mid) {
        current = row.id
        idx = i
        const next = railTargets[i + 1]
        if (next) {
          const span = next.el.getBoundingClientRect().top - top
          frac = span > 1 ? clamp((mid - top) / span) : 0
        } else {
          frac = 0
        }
      }
    }
    setActive(current)

    if (tick && railTargets[idx]?.link) {
      const a = railTargets[idx].link.offsetTop
      const nextLink = railTargets[idx + 1]?.link
      const b = nextLink ? nextLink.offsetTop : a
      tick.style.transform = `translateY(${a + (b - a) * frac}px)`
    }
  }

  const paint = () => {
    paintHero()
    paintType()
    paintWash()
    paintRail()
  }

  const onScroll = () => {
    if (scrollRaf) return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      paint()
    })
  }

  setReduced(reduced)
  setCursorMode()

  motionMq.addEventListener('change', (e) => {
    setReduced(e.matches)
    setCursorMode()
    paint()
  })
  fineMq.addEventListener('change', () => setCursorMode())
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  cleanups.push(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  })

  const onPointerMove = (e: PointerEvent) => {
    if (!cursorOn || e.pointerType === 'touch') return
    ptrX = e.clientX
    ptrY = e.clientY
    if (!cursorArmed) {
      curX = ptrX
      curY = ptrY
      cursorArmed = true
      cursor?.style.setProperty('opacity', '1')
    }
    const hot = !!(e.target instanceof Element && e.target.closest('a, button'))
    if (hot !== cursorHot) {
      cursorHot = hot
      cursor?.classList.toggle('is-hot', hot)
    }
  }

  const onPointerLeave = () => {
    cursorArmed = false
    cursor?.style.setProperty('opacity', '0')
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onPointerLeave)
  cleanups.push(() => {
    window.removeEventListener('pointermove', onPointerMove)
    document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    cancelAnimationFrame(cursorRaf)
  })

  const goTo = (id: string) => {
    const raw = id.replace('#', '')
    const el = document.getElementById(raw)
    if (!el) return
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  paint()

  const start = window.location.hash.replace('#', '')
  if (start) {
    document.getElementById(start)?.scrollIntoView({ behavior: 'auto', block: 'start' })
    paint()
  }

  return {
    goTo,
    destroy() {
      cleanups.forEach((fn) => fn())
    },
  }
}
