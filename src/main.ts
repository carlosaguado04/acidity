import './style.css'
import { mountScene, type SceneHandle } from './scene'
import { initMotion } from './motion'

const year = document.getElementById('year')
if (year) year.textContent = String(new Date().getFullYear())

const themeButtons = document.querySelectorAll<HTMLButtonElement>('[data-theme-set]')
const themeColorMeta = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem('acidity-theme', theme)
  } catch {}
  themeButtons.forEach((btn) => {
    btn.setAttribute(
      'aria-pressed',
      btn.dataset.themeSet === theme ? 'true' : 'false',
    )
  })
  const color = theme === 'light' ? '#FFFFFF' : '#0C0D10'
  themeColorMeta.forEach((meta) => {
    meta.setAttribute('content', color)
    meta.removeAttribute('media')
  })
}

const initialTheme =
  document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
applyTheme(initialTheme)

themeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.themeSet
    if (next === 'light' || next === 'dark') applyTheme(next)
  })
})

let sceneHandle: SceneHandle | null = null
let lastScroll = 0

const canvas = document.getElementById('scene')
if (canvas instanceof HTMLCanvasElement) {
  const start = () => {
    sceneHandle = mountScene(canvas)
    sceneHandle.setScrollProgress(lastScroll)
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 400 })
  } else {
    setTimeout(start, 1)
  }
}

initMotion({
  onScrollProgress(p) {
    lastScroll = p
    sceneHandle?.setScrollProgress(p)
  },
})
