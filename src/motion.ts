import gsap from 'gsap'

export type MotionHandle = {
  goTo: (id: string) => void
  destroy: () => void
}

const WINDOWS = ['home', 'studio', 'apps', 'contact'] as const
const MOVE_EASE = 'expo.inOut'
const MOVE_WINDOW = 1.55
const MOVE_BEHIND = 1.85
type WindowId = (typeof WINDOWS)[number]

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function bindPointerToys(cleanups: Array<() => void>): void {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
    const onMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      gsap.to(btn, {
        x: x * 0.28,
        y: y * 0.28,
        duration: 0.35,
        ease: 'power2.out',
      })
    }
    const onLeave = () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' })
    }
    btn.addEventListener('pointermove', onMove)
    btn.addEventListener('pointerleave', onLeave)
    cleanups.push(() => {
      btn.removeEventListener('pointermove', onMove)
      btn.removeEventListener('pointerleave', onLeave)
    })
  })

  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const onMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      gsap.to(card, {
        rotateY: px * 8,
        rotateX: -py * 6,
        y: -4,
        transformPerspective: 800,
        duration: 0.35,
        ease: 'power2.out',
      })
    }
    const onLeave = () => {
      gsap.to(card, {
        rotateY: 0,
        rotateX: 0,
        y: 0,
        duration: 0.55,
        ease: 'power3.out',
      })
    }
    card.addEventListener('pointermove', onMove)
    card.addEventListener('pointerleave', onLeave)
    cleanups.push(() => {
      card.removeEventListener('pointermove', onMove)
      card.removeEventListener('pointerleave', onLeave)
    })
  })
}

export function initMotion(opts: {
  onScrollProgress?: (p: number) => void
}): MotionHandle {
  const reduced = prefersReducedMotion()
  const cleanups: Array<() => void> = []
  const track = document.querySelector('.windows-track')
  const panes = [
    ...document.querySelectorAll<HTMLElement>('.window[data-window]'),
  ]
  const nav = document.querySelector('.nav')
  const line = nav?.querySelector('.nav-line')
  const navLinks = [
    ...document.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]'),
  ]
  const pagerLinks = [
    ...document.querySelectorAll<HTMLAnchorElement>('.pager a[href^="#"]'),
  ]
  const progressBar = document.getElementById('scroll-progress')

  let index = 0
  let locked = false
  let touchY = 0

  const idAt = (i: number): WindowId => WINDOWS[i] ?? 'home'

  const indexOf = (id: string): number => {
    const key = id === 'products' ? 'apps' : id
    const i = WINDOWS.indexOf(key as WindowId)
    return i === -1 ? 0 : i
  }

  const placeLine = (link: HTMLAnchorElement, animate: boolean) => {
    if (!(line instanceof HTMLElement) || !(nav instanceof HTMLElement)) return
    if (getComputedStyle(nav).display === 'none') return
    const navRect = nav.getBoundingClientRect()
    const rect = link.getBoundingClientRect()
    gsap.to(line, {
      x: rect.left - navRect.left + nav.scrollLeft,
      width: rect.width,
      opacity: 1,
      duration: animate && !reduced ? 0.45 : 0,
      ease: 'power3.out',
      overwrite: true,
    })
  }

  const setActive = (id: WindowId, animate = true) => {
    const href = `#${id}`
    navLinks.forEach((link) => {
      const on = link.getAttribute('href') === href
      link.classList.toggle('is-active', on)
      if (on) {
        link.setAttribute('aria-current', 'location')
        placeLine(link, animate)
      } else {
        link.removeAttribute('aria-current')
      }
    })
    if (id === 'home' && line instanceof HTMLElement) {
      gsap.to(line, {
        opacity: 0,
        duration: animate && !reduced ? 0.2 : 0,
        overwrite: true,
      })
    }
    pagerLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === href)
    })
  }

  const applyTransform = (i: number, animate: boolean) => {
    if (!(track instanceof HTMLElement)) return
    const shell = track.parentElement
    const h = shell instanceof HTMLElement ? shell.clientHeight : window.innerHeight
    const y = -i * h
    const dur = animate && !reduced
    const canvas = document.querySelector('.canvas-wrap')
    const layers = document.querySelectorAll<HTMLElement>('.bg-layer')

    if (canvas) gsap.set(canvas, { y: 0, scale: 1 })

    if (!dur) {
      gsap.set(track, { y })
      layers.forEach((layer, n) => {
        gsap.set(layer, { y: -i * h * (0.06 + n * 0.04) })
      })
      panes.forEach((pane, n) => {
        const inner = pane.querySelector('.window-inner')
        if (inner) gsap.set(inner, { y: (n - i) * 70 })
      })
      return
    }

    locked = true
    gsap.to(track, {
      y,
      duration: MOVE_WINDOW,
      ease: MOVE_EASE,
      overwrite: true,
      onComplete: () => {
        locked = false
      },
    })
    layers.forEach((layer, n) => {
      gsap.to(layer, {
        y: -i * h * (0.06 + n * 0.04),
        duration: MOVE_BEHIND + n * 0.08,
        ease: MOVE_EASE,
        overwrite: true,
      })
    })
    panes.forEach((pane, n) => {
      const inner = pane.querySelector('.window-inner')
      if (!inner) return
      gsap.to(inner, {
        y: (n - i) * 70,
        duration: MOVE_WINDOW,
        ease: MOVE_EASE,
        overwrite: true,
      })
    })
  }

  const goToIndex = (next: number, animate = true) => {
    const i = Math.max(0, Math.min(WINDOWS.length - 1, next))
    if (i === index && animate) return
    index = i
    const id = idAt(i)
    applyTransform(i, animate)
    setActive(id, animate)
    const p = WINDOWS.length > 1 ? i / (WINDOWS.length - 1) : 0
    if (progressBar) progressBar.style.transform = `scaleX(${p})`
    opts.onScrollProgress?.(p)
    const hash = id === 'home' ? '/' : `#${id}`
    if (animate) history.replaceState(null, '', hash)
  }

  const goTo = (id: string) => {
    const key = id.replace('#', '')
    goToIndex(key === '' || key === 'top' || key === 'main' ? 0 : indexOf(key))
  }

  const step = (dir: number) => {
    if (locked && !reduced) return
    goToIndex(index + dir)
  }

  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
    e.preventDefault()
    if (locked) return
    if (Math.abs(e.deltaY) < 8) return
    step(e.deltaY > 0 ? 1 : -1)
  }

  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches[0]?.clientY ?? 0
  }

  const onTouchEnd = (e: TouchEvent) => {
    const y = e.changedTouches[0]?.clientY ?? touchY
    const dy = touchY - y
    if (Math.abs(dy) < 56) return
    const dir = dy > 0 ? 1 : -1
    step(dir)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goToIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      goToIndex(WINDOWS.length - 1)
    }
  }

  const onClick = (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.('a')
    if (!(link instanceof HTMLAnchorElement)) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank') {
      return
    }
    const href = link.getAttribute('href')
    if (!href) return
    if (link.classList.contains('mark') || href.startsWith('#')) {
      const url = href.startsWith('#') ? new URL(link.href) : null
      if (url && url.pathname !== window.location.pathname) return
      const id = href.startsWith('#') ? href.slice(1) : 'home'
      if (
        id === 'home' ||
        id === 'main' ||
        WINDOWS.includes(id as WindowId) ||
        id === 'products' ||
        href === '/'
      ) {
        e.preventDefault()
        goTo(id === '' || id === 'main' ? 'home' : id)
      }
    }
  }

  const onResize = () => applyTransform(index, false)

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('keydown', onKey)
  document.addEventListener('click', onClick)
  window.addEventListener('resize', onResize)
  cleanups.push(() => {
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('click', onClick)
    window.removeEventListener('resize', onResize)
  })

  navLinks.forEach((link) => {
    link.style.cursor = 'pointer'
    const onEnter = () => placeLine(link, true)
    const onLeave = () => setActive(idAt(index), true)
    link.addEventListener('pointerenter', onEnter)
    link.addEventListener('pointerleave', onLeave)
    cleanups.push(() => {
      link.removeEventListener('pointerenter', onEnter)
      link.removeEventListener('pointerleave', onLeave)
    })
  })

  bindPointerToys(cleanups)

  if (reduced) {
    document.documentElement.classList.add('reduced-motion')
  }

  const startHash = window.location.hash.replace('#', '')
  goToIndex(indexOf(startHash || 'home'), false)

  return {
    goTo,
    destroy() {
      cleanups.forEach((fn) => fn())
    },
  }
}
