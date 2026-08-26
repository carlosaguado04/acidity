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
  "Vela’s still in the pan. I’m already plated.",
  "Few apps. High heat. One judgmental fruit.",
  "You clicked a citrus. Peak productivity.",
]

const mascotBtn = document.querySelector<HTMLButtonElement>('[data-mascot]')
const mascotBubble = document.querySelector<HTMLElement>('[data-mascot-bubble]')
let mascotLine = 0
let mascotHide: number | undefined

function speakMascot(e: Event) {
  e.preventDefault()
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
}

mascotBtn?.addEventListener('click', speakMascot)
mascotBtn?.addEventListener('pointerdown', (e) => e.stopPropagation())
