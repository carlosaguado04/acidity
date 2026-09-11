import 'lenis/dist/lenis.css'
import './style.css'
import { initMotion } from './motion'

const year = document.getElementById('year')
if (year) year.textContent = String(new Date().getFullYear())

document.querySelectorAll<HTMLImageElement>('img[data-mockup]').forEach((img) => {
  const stem = img.dataset.mockup
  if (!stem) return
  const candidates = stem.match(/\.(webp|png)$/i)
    ? [stem, stem.replace(/\.webp$/i, '.png').replace(/\.png$/i, '.webp')]
    : [`${stem}.webp`, `${stem}.png`]
  const tryNext = (i: number) => {
    const src = candidates[i]
    if (!src || src === img.src) {
      if (i + 1 < candidates.length) tryNext(i + 1)
      return
    }
    const probe = new Image()
    probe.onload = () => {
      img.src = src
      img.closest('.stage-visual')?.classList.add('is-mockup')
    }
    probe.onerror = () => tryNext(i + 1)
    probe.src = src
  }
  tryNext(0)
})

localStorage.removeItem('acidity-theme')
localStorage.removeItem('acidity-accent')

const toggle = document.getElementById('index-toggle')
const sheet = document.getElementById('index-sheet')
const layer = document.getElementById('index-layer')
let lastFocus: HTMLElement | null = null

const motion = initMotion()

const setOpen = (open: boolean) => {
  const was = document.body.classList.contains('is-index-open')
  document.body.classList.toggle('is-index-open', open)
  motion.setPaused(open)
  toggle?.setAttribute('aria-expanded', String(open))
  toggle?.setAttribute('aria-label', open ? 'Close index' : 'Open index')
  if (toggle) toggle.textContent = open ? 'Close' : 'Index'
  if (sheet instanceof HTMLElement) {
    sheet.inert = !open
    if (open) sheet.removeAttribute('inert')
    else sheet.setAttribute('inert', '')
  }
  if (open) {
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : toggle
    sheet?.querySelector<HTMLElement>('a[href]')?.focus()
  } else if (was) {
    lastFocus?.focus()
    lastFocus = null
  }
}

if (sheet instanceof HTMLElement) {
  sheet.inert = true
  sheet.setAttribute('inert', '')
}

toggle?.addEventListener('click', () => {
  setOpen(toggle.getAttribute('aria-expanded') !== 'true')
})

sheet?.addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest?.('a[href^="#"]')) setOpen(false)
})

layer?.addEventListener('click', (e) => {
  if (e.target === layer) setOpen(false)
})

const wide = window.matchMedia('(min-width: 960px)')
wide.addEventListener('change', (e) => {
  if (e.matches) setOpen(false)
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpen(false)
  if (e.key !== 'Tab' || !document.body.classList.contains('is-index-open')) return
  const nodes = [
    ...[toggle, sheet].filter((el): el is HTMLElement => el instanceof HTMLElement),
  ].flatMap((rootEl) =>
    [...rootEl.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
      (el) => !el.closest('[inert]') && el.tabIndex !== -1,
    ),
  )
  if (toggle instanceof HTMLElement && !nodes.includes(toggle)) nodes.unshift(toggle)
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

const mascotLines = [
  "Don’t lick the mascot. We put that on the site for a reason.",
  "I’m the lime. Carlos is the kitchen.",
  "Decorative until you click me. Now I’m tart.",
  "Orza’s still in the pan. I’m already plated.",
  "Hilo stole the minutes. I’m keeping the rind.",
  "Few apps. High heat. One judgmental fruit.",
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
