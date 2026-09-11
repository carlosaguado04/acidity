import Lenis from 'lenis'
import Snap from 'lenis/snap'

export type MotionHandle = {
  goTo: (id: string) => void
  setPaused: (paused: boolean) => void
  destroy: () => void
}

const RAIL_IDS = ['studio', 'mise', 'orza', 'hilo', 'more', 'contact'] as const
type RailId = (typeof RAIL_IDS)[number]

const SNAP_DURATION = 1.05
const SNAP_EASE = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n))
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 2
}

function coverage(el: HTMLElement): number {
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0)
  if (visible <= 0) return 0
  return Math.min(1, visible / Math.min(Math.max(r.height, 1), vh))
}

function sectionIdFromHref(href: string): string | null {
  if (!href.startsWith('#')) return null
  const id = href.slice(1)
  return id || null
}

export function initMotion(): MotionHandle {
  const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const fineMq = window.matchMedia('(pointer: fine)')
  const hoverMq = window.matchMedia('(hover: hover)')
  const snapMq = window.matchMedia('(pointer: fine) and (hover: hover) and (min-width: 900px)')
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
  const wordmark = document.querySelector<HTMLElement>('.wordmark')
  const heroLine = document.querySelector<HTMLElement>('.hero-line')
  const hero = document.getElementById('home')
  const cursor = document.querySelector<HTMLElement>('.cursor')
  const typeEls = [...document.querySelectorAll<HTMLElement>('[data-scroll-type]')]
  const sections = [...document.querySelectorAll<HTMLElement>('.hero, .stage')]
  const visuals = [...document.querySelectorAll<HTMLElement>('[data-visual]')].map((el) => ({
    el,
    stage: el.closest<HTMLElement>('.stage'),
    img: el.querySelector<HTMLElement>('img'),
  }))
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
  let lenis: Lenis | null = null
  let snap: Snap | null = null
  let paused = false

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
      if (wordmark) {
        wordmark.style.opacity = '1'
        wordmark.style.filter = 'none'
      }
      if (heroLine) {
        heroLine.style.opacity = '1'
        heroLine.style.filter = 'none'
      }
      visuals.forEach(({ el, img }) => {
        el.style.transform = 'none'
        if (img) img.style.transform = 'none'
      })
      stopSmooth()
    } else {
      startSmooth()
    }
  }

  const stepCursor = () => {
    if (!cursorOn || !cursor) return
    curX += (ptrX - curX) * 0.075
    curY += (ptrY - curY) * 0.075
    cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`
    cursorRaf = requestAnimationFrame(stepCursor)
  }

  const setCursorMode = () => {
    const next = !reduced && fineMq.matches && hoverMq.matches
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
      const enter = easeOut(clamp((vh * 1.0 - i * 14 - r.top) / (vh * 0.22)))
      let leave = 1
      if (r.bottom < vh * 0.16) {
        leave = clamp(0.4 + (r.bottom / (vh * 0.16)) * 0.6)
      }
      const t = Math.min(enter, leave)
      const blur = (1 - enter) * 8
      const y = (1 - enter) * 18
      el.style.opacity = String(t)
      el.style.filter = blur > 0.35 ? `blur(${blur.toFixed(2)}px)` : 'none'
      el.style.transform = y > 0.5 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : 'none'
      el.classList.toggle('is-in', enter > 0.72 && leave > 0.85)
    })
  }

  const paintVisuals = () => {
    const vh = window.innerHeight
    visuals.forEach(({ stage, img }) => {
      if (!stage || !img) return
      if (reduced) {
        img.style.transform = 'none'
        return
      }
      const r = stage.getBoundingClientRect()
      const c = coverage(stage)
      const through = clamp((vh * 0.5 - (r.top + r.height * 0.35)) / vh)
      const y = through * -22
      const scale = 1 + 0.02 * c
      img.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`
    })
  }

  const paintHero = () => {
    if (!heroInner || !hero) return
    if (reduced) return
    const r = hero.getBoundingClientRect()
    const vh = window.innerHeight
    const vis = clamp(r.bottom / vh)
    const o = vis > 0.58 ? 1 : clamp(vis / 0.58)
    heroInner.style.transform = o < 0.98 ? `translate3d(0, ${((1 - o) * -20).toFixed(1)}px, 0)` : 'none'
    if (wordmark) {
      wordmark.style.opacity = String(o)
      wordmark.style.filter = 'none'
    }
    if (heroLine) {
      heroLine.style.opacity = String(o)
      heroLine.style.filter = o < 0.96 ? `blur(${((1 - o) * 6).toFixed(2)}px)` : 'none'
    }
  }

  const paintWash = () => {
    const lime = mise instanceof HTMLElement ? coverage(mise) : 0
    const cyan = orza instanceof HTMLElement ? coverage(orza) : 0
    const coral = hilo instanceof HTMLElement ? coverage(hilo) : 0
    const snapWash = (n: number) => (reduced ? (n > 0.45 ? 1 : 0) : n)
    if (washLime) washLime.style.opacity = String(snapWash(lime))
    if (washCyan) washCyan.style.opacity = String(snapWash(cyan))
    if (washCoral) washCoral.style.opacity = String(snapWash(coral))

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
    paintVisuals()
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

  const bindSnap = () => {
    snap?.destroy()
    snap = null
    if (!lenis || reduced) return
    const chapterSnap = snapMq.matches
    snap = new Snap(lenis, {
      type: chapterSnap ? 'mandatory' : 'proximity',
      duration: SNAP_DURATION,
      easing: SNAP_EASE,
      debounce: chapterSnap ? 140 : 200,
      distanceThreshold: '40%',
    })
    snap.addElements(sections, { align: 'start' })
  }

  const startSmooth = () => {
    if (lenis || reduced) return
    lenis = new Lenis({
      autoRaf: true,
      lerp: 0.075,
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.1,
      syncTouch: false,
      anchors: false,
      autoToggle: false,
      stopInertiaOnNavigate: true,
      prevent: (node) => !!node.closest('[data-lenis-prevent]'),
    })
    lenis.on('scroll', onScroll)
    bindSnap()
    if (paused) lenis.stop()
  }

  const stopSmooth = () => {
    snap?.destroy()
    snap = null
    if (!lenis) return
    lenis.destroy()
    lenis = null
  }

  const goTo = (id: string, immediate = false) => {
    const raw = id.replace('#', '')
    const el = document.getElementById(raw)
    if (!el) return
    if (lenis && !reduced) {
      lenis.scrollTo(el, {
        immediate,
        duration: immediate ? 0 : SNAP_DURATION,
        easing: SNAP_EASE,
        lock: !immediate,
      })
      return
    }
    el.scrollIntoView({ behavior: reduced || immediate ? 'auto' : 'smooth', block: 'start' })
  }

  const setPaused = (on: boolean) => {
    paused = on
    if (!lenis) return
    if (on) lenis.stop()
    else lenis.start()
  }

  setReduced(reduced)
  setCursorMode()

  motionMq.addEventListener('change', (e) => {
    setReduced(e.matches)
    setCursorMode()
    paint()
  })
  fineMq.addEventListener('change', () => setCursorMode())
  hoverMq.addEventListener('change', () => setCursorMode())
  snapMq.addEventListener('change', () => bindSnap())
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  cleanups.push(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    stopSmooth()
  })

  const onAnchorClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]')
    if (!(a instanceof HTMLAnchorElement)) return
    if (a.classList.contains('skip')) return
    const id = sectionIdFromHref(a.getAttribute('href') ?? '')
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    goTo(id)
    const hash = `#${id}`
    if (location.hash !== hash) history.pushState(null, '', hash)
  }

  document.addEventListener('click', onAnchorClick)
  cleanups.push(() => document.removeEventListener('click', onAnchorClick))

  const onHashChange = () => {
    const id = location.hash.replace('#', '')
    if (id) goTo(id)
  }
  window.addEventListener('hashchange', onHashChange)
  cleanups.push(() => window.removeEventListener('hashchange', onHashChange))

  const onKeys = (e: KeyboardEvent) => {
    if (reduced || !snap || paused) return
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target
    if (target instanceof HTMLElement) {
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault()
      snap.next()
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault()
      snap.previous()
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo('home')
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo('contact')
    }
  }
  window.addEventListener('keydown', onKeys)
  cleanups.push(() => window.removeEventListener('keydown', onKeys))

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

  paint()

  const start = window.location.hash.replace('#', '')
  if (start) goTo(start, true)
  else paint()

  return {
    goTo,
    setPaused,
    destroy() {
      cleanups.forEach((fn) => fn())
    },
  }
}
