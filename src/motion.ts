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
