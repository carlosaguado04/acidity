import gsap from 'gsap'
import './style.css'
import { mountScene, type SceneHandle } from './scene'
import { initMotion } from './motion'

const year = document.getElementById('year')
if (year) year.textContent = String(new Date().getFullYear())

const root = document.documentElement
const stored = localStorage.getItem('acidity-theme')
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
const initial =
  stored === 'light' || stored === 'dark'
    ? stored
    : prefersLight
      ? 'light'
      : 'dark'
root.setAttribute('data-theme', initial)

const toggle = document.getElementById('theme-toggle')
toggle?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
  root.setAttribute('data-theme', next)
  localStorage.setItem('acidity-theme', next)
})

const header = document.querySelector('.site-header')
const navToggle = document.getElementById('nav-toggle')

const setNavOpen = (open: boolean) => {
  header?.classList.toggle('is-nav-open', open)
  navToggle?.setAttribute('aria-expanded', String(open))
  navToggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
}

navToggle?.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true'
  setNavOpen(open)
})

header?.addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest?.('a[href^="#"]')) setNavOpen(false)
})

document.addEventListener('click', (e) => {
  if (!header?.classList.contains('is-nav-open')) return
  if (header.contains(e.target as Node)) return
  setNavOpen(false)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setNavOpen(false)
})

window.addEventListener('resize', () => {
  if (window.matchMedia('(min-width: 720px)').matches) setNavOpen(false)
})

let sceneHandle: SceneHandle | null = null
let lastScroll = 0

const canvas = document.getElementById('scene')
if (canvas instanceof HTMLCanvasElement) {
  sceneHandle = mountScene(canvas)
  sceneHandle.setScrollProgress(lastScroll)
}

initMotion({
  onScrollProgress(p) {
    lastScroll = p
    sceneHandle?.setScrollProgress(p)
  },
})

const frostRoot = document.querySelector('.copy-frost')
const frostSources = [
  ...document.querySelectorAll<HTMLElement>('.lede, .studio-copy, .contact-note'),
]
if (frostRoot instanceof HTMLElement && frostSources.length) {
  const frostPanes = frostSources.map(() => {
    const pane = document.createElement('div')
    pane.className = 'copy-frost-pane'
    pane.hidden = true
    frostRoot.appendChild(pane)
    return pane
  })
  const headingBottom = (src: HTMLElement, textTop: number) => {
    const root = src.closest('.window-inner')
    if (!root) return -Infinity
    let max = -Infinity
    root.querySelectorAll('h1, h2, .eyebrow').forEach((el) => {
      const b = el.getBoundingClientRect().bottom
      if (b <= textTop + 1) max = Math.max(max, b)
    })
    return max
  }
  const syncFrost = () => {
    const vh = window.innerHeight
    const vw = window.innerWidth
    frostSources.forEach((src, i) => {
      const pane = frostPanes[i]
      if (!pane) return
      const r = src.getBoundingClientRect()
      const padX = Math.round(Math.max(40, Math.min(108, r.width * 0.2)))
      const padTop = Math.round(Math.max(8, Math.min(16, r.height * 0.18)))
      const padBottom = Math.round(Math.max(22, Math.min(52, r.height * 0.55)))
      const visible =
        r.bottom > -padBottom && r.top < vh + padTop && r.right > 0 && r.left < vw
      if (!visible || r.width < 2 || r.height < 2) {
        pane.hidden = true
        return
      }
      const top = Math.max(r.top - padTop, headingBottom(src, r.top) + 6)
      pane.hidden = false
      pane.style.left = `${Math.round(r.left - padX)}px`
      pane.style.top = `${Math.round(top)}px`
      pane.style.width = `${Math.round(r.width + padX * 2)}px`
      pane.style.height = `${Math.round(r.bottom + padBottom - top)}px`
    })
  }
  gsap.ticker.add(syncFrost)
  syncFrost()
}

const mascotLines = [
  "Don’t lick the mascot. We put that on the site for a reason.",
  "I’m the lime. Carlos is the kitchen.",
  "Decorative until you click me. Now I’m tart.",
  "Orza’s still in the pan. I’m already plated.",
  "Few apps. High heat. One judgmental fruit.",
  "You clicked a citrus. Peak productivity.",
]

const mascotBtn = document.querySelector<HTMLButtonElement>('[data-mascot]')
const mascotBubble = document.querySelector<HTMLElement>('[data-mascot-bubble]')
let mascotLine = 0
let mascotHide: number | undefined

mascotBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  if (!mascotBubble) return
  mascotBubble.hidden = false
  mascotBubble.textContent = mascotLines[mascotLine % mascotLines.length] ?? ''
  mascotLine += 1
  mascotBubble.style.animation = 'none'
  void mascotBubble.offsetWidth
  mascotBubble.style.animation = ''
  window.clearTimeout(mascotHide)
  mascotHide = window.setTimeout(() => {
    mascotBubble.hidden = true
  }, 3200)
})
