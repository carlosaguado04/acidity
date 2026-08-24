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

function initHeroMascot(cleanups: Array<() => void>, reduced: boolean) {
  const wrap = document.querySelector<HTMLElement>('[data-mascot]')
  const blob = document.querySelector<HTMLElement>('[data-mascot-blob]')
  if (!wrap || !blob) return

  gsap.set([wrap, blob], { transformOrigin: '50% 100%' })

  // Still pose for reduced motion — slight lean so it doesn't look dead flat
  if (reduced) {
    gsap.set(blob, {
      scaleX: 1.04,
      scaleY: 0.96,
      rotate: -4,
      y: 0,
    })
    return
  }

  // Idle jelly: squash-stretch + gentle bob (blob only)
  const idle = gsap.timeline({ repeat: -1, yoyo: true })
  idle
    .to(blob, {
      scaleX: 1.06,
      scaleY: 0.94,
      y: 6,
      duration: 1.35,
      ease: 'sine.inOut',
    })
    .to(blob, {
      scaleX: 0.96,
      scaleY: 1.05,
      y: -4,
      duration: 1.45,
      ease: 'sine.inOut',
    })
  cleanups.push(() => idle.kill())

  // Pointer tilt + mild scroll squash combined on wrap each frame
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const scroll = { p: 0 }
  let raf = 0

  const onPointer = (e: PointerEvent) => {
    const rect = wrap.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    pointer.tx = gsap.utils.clamp(-1, 1, (e.clientX - cx) / (rect.width * 0.65))
    pointer.ty = gsap.utils.clamp(-1, 1, (e.clientY - cy) / (rect.height * 0.65))
  }

  const tick = () => {
    pointer.x += (pointer.tx - pointer.x) * 0.08
    pointer.y += (pointer.ty - pointer.y) * 0.08
    const squash = scroll.p
    gsap.set(wrap, {
      rotateY: pointer.x * 14,
      rotateX: -pointer.y * 10,
      rotate: pointer.x * -3,
      scaleX: 1 + squash * 0.08,
      scaleY: 1 - squash * 0.08,
      transformPerspective: 900,
    })
    raf = requestAnimationFrame(tick)
  }

  window.addEventListener('pointermove', onPointer, { passive: true })
  raf = requestAnimationFrame(tick)
  cleanups.push(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onPointer)
  })

  const hero = document.querySelector('.hero')
  if (hero) {
    const st = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: '+=40vh',
      scrub: 0.45,
      onUpdate: (self) => {
        scroll.p = self.progress
      },
    })
    cleanups.push(() => st.kill())
  }
}

export function initMotion(): MotionHandle {
  const reduced = prefersReducedMotion()
  const cleanups: Array<() => void> = []

  const progressBar = document.getElementById('scroll-progress')

  initHeroMascot(cleanups, reduced)

  if (reduced) {
    document.documentElement.classList.add('reduced-motion')
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('is-visible')
    })
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

  // Progress bar
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const p = max > 0 ? window.scrollY / max : 0
    if (progressBar) {
      progressBar.style.transform = `scaleX(${p})`
    }
  }
  lenis.on('scroll', onScroll)
  onScroll()

  // --- Hero pin: wordmark scales + fades ---
  const hero = document.querySelector('.hero')
  const wordmark = document.querySelector('[data-parallax="wordmark"]')
  const heroInner = document.querySelector('.hero-inner')

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
        productCards.forEach((card, idx) => {
          card.style.setProperty('--stagger', String(idx))
        })
      },
    })
    cleanups.push(() => st.kill())
  }

  // --- Magnetic CTAs ---
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
