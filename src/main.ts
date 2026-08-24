import './style.css'
import { mountScene } from './scene'

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

const canvas = document.getElementById('scene')
if (canvas instanceof HTMLCanvasElement) {
  const start = () => {
    mountScene(canvas)
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 400 })
  } else {
    setTimeout(start, 1)
  }
}
