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

const ACCENTS = ['lime', 'cyan', 'coral', 'violet'] as const
type Accent = (typeof ACCENTS)[number]
const storedAccent = localStorage.getItem('acidity-accent')
const initialAccent: Accent = ACCENTS.includes(storedAccent as Accent)
  ? (storedAccent as Accent)
  : 'lime'
root.setAttribute('data-accent', initialAccent)

const setAccent = (accent: Accent) => {
  root.setAttribute('data-accent', accent)
  localStorage.setItem('acidity-accent', accent)
  document.querySelectorAll<HTMLButtonElement>('.accent-pick').forEach((btn) => {
    const on = btn.dataset.accent === accent
    btn.setAttribute('aria-checked', String(on))
  })
}

setAccent(initialAccent)

document.querySelectorAll<HTMLButtonElement>('.accent-pick').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.accent
    if (next && ACCENTS.includes(next as Accent)) setAccent(next as Accent)
  })
})

const toggle = document.getElementById('theme-toggle')
toggle?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'
  root.setAttribute('data-theme', next)
  localStorage.setItem('acidity-theme', next)
})

const header = document.querySelector('.site-header')
const nav = document.getElementById('site-nav')
const navToggle = document.getElementById('nav-toggle')
const navLabel = navToggle?.querySelector('[data-nav-label]')
let lastNavFocus: HTMLElement | null = null

const setNavOpen = (open: boolean) => {
  const wasOpen = document.body.classList.contains('is-nav-open')
  document.body.classList.toggle('is-nav-open', open)
  header?.classList.toggle('is-nav-open', open)
  navToggle?.setAttribute('aria-expanded', String(open))
  navToggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
  if (navLabel) navLabel.textContent = open ? 'Close' : 'Menu'
  if (nav instanceof HTMLElement) {
    nav.classList.toggle('is-open', open)
    nav.inert = !open
    if (open) nav.removeAttribute('inert')
    else nav.setAttribute('inert', '')
    nav.setAttribute('aria-hidden', String(!open))
  }
  if (open) {
    lastNavFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : navToggle
    const first = nav?.querySelector<HTMLElement>('a[href]')
    first?.focus()
  } else if (wasOpen) {
    lastNavFocus?.focus()
    lastNavFocus = null
  }
}

if (nav instanceof HTMLElement) {
  nav.inert = true
  nav.setAttribute('inert', '')
  nav.setAttribute('aria-hidden', 'true')
}

navToggle?.addEventListener('click', () => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true'
  setNavOpen(open)
})

header?.addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest?.('a[href^="#"]')) setNavOpen(false)
})

nav?.addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest?.('a[href^="#"]')) setNavOpen(false)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setNavOpen(false)
  if (e.key !== 'Tab' || !document.body.classList.contains('is-nav-open')) return
  const roots = [header, nav].filter((el): el is HTMLElement => el instanceof HTMLElement)
  const nodes = roots.flatMap((root) =>
    [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
      (el) => !el.closest('[inert]') && el.tabIndex !== -1,
    ),
  )
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (!first || !last) return
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
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
