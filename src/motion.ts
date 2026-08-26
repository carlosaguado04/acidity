import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

gsap.registerPlugin(ScrollTrigger)

export type MotionHandle = {
  lenis: Lenis | null
  destroy: () => void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const SECTION_IDS = ['studio', 'products', 'contact'] as const

function bindAnchors(
  lenis: Lenis | null,
  cleanups: Array<() => void>,
): void {
  const nav = document.querySelector('.nav')
  const line = nav?.querySelector('.nav-line')
  const navLinks = [
    ...document.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]'),
  ]

  const placeLine = (link: HTMLAnchorElement, animate: boolean) => {
    if (!(line instanceof HTMLElement) || !(nav instanceof HTMLElement)) return
    if (getComputedStyle(nav).display === 'none') return
    const navRect = nav.getBoundingClientRect()
    const rect = link.getBoundingClientRect()
    const x = rect.left - navRect.left + nav.scrollLeft
    gsap.to(line, {
      x,
      width: rect.width,
      opacity: 1,
      duration: animate ? 0.45 : 0,
      ease: 'power3.out',
      overwrite: true,
    })
  }

  const hideLine = (animate: boolean) => {
    if (!(line instanceof HTMLElement)) return
    gsap.to(line, {
      opacity: 0,
      duration: animate ? 0.2 : 0,
      overwrite: true,
    })
  }

  const setActive = (id: string | null, animate = true) => {
    navLinks.forEach((link) => {
      const on = link.getAttribute('href') === `#${id}`
      link.classList.toggle('is-active', on)
      if (on) {
        link.setAttribute('aria-current', 'location')
        placeLine(link, animate)
      } else {
        link.removeAttribute('aria-current')
      }
    })
    if (!id) hideLine(animate)
  }

  const currentSection = (): string | null => {
    const probe = Math.max(
      96,
      (document.querySelector('.site-header')?.getBoundingClientRect().height ?? 64) + 80,
    )
    let id: string | null = null
    for (const hid of SECTION_IDS) {
      const el = document.getElementById(hid)
      if (!el) continue
      if (el.getBoundingClientRect().top <= probe) id = hid
    }
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (max > 0 && window.scrollY >= max - 12) id = 'contact'
    return id
  }

  const flash = (target: Element) => {
    const heading =
      target.querySelector('h2') ??
      target.querySelector('.footer-mark') ??
      target
    heading.classList.remove('arrive-flash')
    void (heading as HTMLElement).offsetWidth
    heading.classList.add('arrive-flash')
    const clear = () => heading.classList.remove('arrive-flash')
    heading.addEventListener('animationend', clear, { once: true })
  }

  const goTo = (href: string) => {
    if (href === '#' || href === '#top') {
      if (lenis) lenis.scrollTo(0, { duration: 1.15 })
      else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      setActive(null, true)
      return
    }
    const target = document.querySelector(href)
    if (!(target instanceof HTMLElement)) return
    const id = href.slice(1)
    setActive(SECTION_IDS.includes(id as (typeof SECTION_IDS)[number]) ? id : currentSection(), true)

    const done = () => flash(target)
    if (lenis) {
      lenis.scrollTo(target, {
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        onComplete: done,
      })
    } else {
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
      window.setTimeout(done, prefersReducedMotion() ? 0 : 450)
    }
  }

  const onClick = (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.('a')
    if (!(link instanceof HTMLAnchorElement)) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank') return

    const hrefAttr = link.getAttribute('href')
    if (!hrefAttr) return

    if (link.classList.contains('mark')) {
      const path = window.location.pathname
      if (path === '/' || path === '' || path.endsWith('/index.html')) {
        e.preventDefault()
        goTo('#')
        history.replaceState(null, '', '/')
      }
      return
    }

    if (!hrefAttr.startsWith('#') || hrefAttr === '#') return
    const url = new URL(link.href)
    if (url.pathname !== window.location.pathname) return
    const target = document.querySelector(hrefAttr)
    if (!target) return
    e.preventDefault()
    goTo(hrefAttr)
    history.replaceState(null, '', hrefAttr)
  }

  document.addEventListener('click', onClick)
  cleanups.push(() => document.removeEventListener('click', onClick))

  navLinks.forEach((link) => {
    link.style.cursor = 'pointer'
    const onEnter = () => placeLine(link, true)
    const onLeave = () => setActive(currentSection(), true)
    link.addEventListener('pointerenter', onEnter)
    link.addEventListener('pointerleave', onLeave)
    cleanups.push(() => {
      link.removeEventListener('pointerenter', onEnter)
      link.removeEventListener('pointerleave', onLeave)
    })
  })

  const onScroll = () => setActive(currentSection(), true)
  const onResize = () => setActive(currentSection(), false)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  cleanups.push(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
  })
  if (lenis) {
    lenis.on('scroll', onScroll)
    cleanups.push(() => lenis.off('scroll', onScroll))
  }

  requestAnimationFrame(() => setActive(currentSection(), false))
}

export function initMotion(opts: {
  onScrollProgress?: (p: number) => void
}): MotionHandle {
  const reduced = prefersReducedMotion()
  const cleanups: Array<() => void> = []

  const progressBar = document.getElementById('scroll-progress')

  if (reduced) {
    document.documentElement.classList.add('reduced-motion')
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('is-visible')
    })
    opts.onScrollProgress?.(0)
    bindAnchors(null, cleanups)
    return {
      lenis: null,
      destroy() {
        cleanups.forEach((fn) => fn())
      },
    }
  }

  // --- Lenis smooth scroll ---
  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })

  lenis.on('scroll', ScrollTrigger.update)

  const ticker = (time: number) => {
    lenis.raf(time * 1000)
  }
  gsap.ticker.add(ticker)
  gsap.ticker.lagSmoothing(0)
  cleanups.push(() => {
    gsap.ticker.remove(ticker)
    lenis.destroy()
  })

  // Progress + scene callback
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? window.scrollY / max : 0
    if (progressBar) {
      progressBar.style.transform = `scaleX(${p})`
    }
    opts.onScrollProgress?.(p)
  }
  lenis.on('scroll', onScroll)
  onScroll()
  bindAnchors(lenis, cleanups)

  // --- Hero pin: wordmark scales + fades ---
  const hero = document.querySelector('.hero')
  const wordmark = document.querySelector('[data-parallax="wordmark"]')
  const heroInner = document.querySelector('.hero-inner')
  const canvasWrap = document.querySelector('[data-parallax="canvas"]')

  if (hero && wordmark && heroInner) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=40vh',
        scrub: 0.45,
        pin: '.hero-sticky',
        pinSpacing: true,
        anticipatePin: 1,
      },
    })

    tl.to(
      wordmark,
      {
        scale: 1.03,
        opacity: 0.75,
        y: -12,
        letterSpacing: '-0.045em',
        ease: 'none',
      },
      0,
    )
    tl.to(
      heroInner,
      {
        opacity: 0.7,
        y: -14,
        ease: 'none',
      },
      0,
    )

    cleanups.push(() => {
      tl.scrollTrigger?.kill()
      tl.kill()
    })
  }

  // Canvas parallax (different speed)
  if (canvasWrap) {
    const st = gsap.to(canvasWrap, {
      y: 70,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.8,
      },
    })
    cleanups.push(() => {
      st.scrollTrigger?.kill()
      st.kill()
    })
  }

  // Background layers — staggered parallax speeds
  document.querySelectorAll<HTMLElement>('.bg-layer').forEach((layer) => {
    const speed = Number(layer.dataset.speed ?? 0.15)
    const st = gsap.to(layer, {
      y: () => window.innerHeight * speed * 0.7,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      },
    })
    cleanups.push(() => {
      st.scrollTrigger?.kill()
      st.kill()
    })
  })

  // --- Scroll reveals (opacity + translate + blur) ---
  const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]')
  reveals.forEach((el, i) => {
    const isCard = el.classList.contains('product-card')
    gsap.set(el, {
      opacity: 0,
      y: isCard ? 48 : 28,
      filter: 'blur(8px)',
    })
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.85,
          delay: isCard ? (i % 3) * 0.1 : 0.02,
          ease: 'power3.out',
          clearProps: 'filter',
          onComplete: () => el.classList.add('is-visible'),
        })
      },
    })
    cleanups.push(() => st.kill())
  })

  // Product cards stagger when the products section enters
  const productCards = gsap.utils.toArray<HTMLElement>('.product-card')
  if (productCards.length) {
    const st = ScrollTrigger.create({
      trigger: '#products',
      start: 'top 75%',
      once: true,
      onEnter: () => {
        // Already handled per-card; this reinforces stagger via class
        productCards.forEach((card, idx) => {
          card.style.setProperty('--stagger', String(idx))
        })
      },
    })
    cleanups.push(() => st.kill())
  }

  // --- Magnetic CTAs ---
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((btn) => {
    const strength = 18
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
      void strength
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

  // --- Product card mouse tilt ---
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

  // Refresh after fonts/layout settle
  requestAnimationFrame(() => ScrollTrigger.refresh())

  cleanups.push(() => ScrollTrigger.getAll().forEach((t) => t.kill()))

  return {
    lenis,
    destroy() {
      cleanups.forEach((fn) => fn())
    },
  }
}
