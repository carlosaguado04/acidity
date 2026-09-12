import './style.css'

const root = document.documentElement
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const fineMq = window.matchMedia('(pointer: fine)')
const hoverMq = window.matchMedia('(hover: hover)')

const home = document.getElementById('main')
const shelf = document.getElementById('shelf')
const scrim = document.querySelector<HTMLElement>('[data-close-shelf].scrim, .scrim')
const openers = [...document.querySelectorAll<HTMLAnchorElement>('[data-open-shelf]')]
const closers = [...document.querySelectorAll('[data-close-shelf]')]
const wash = document.querySelector<HTMLElement>('[data-parallax="wash"]')
const mark = document.querySelector<HTMLElement>('[data-parallax="mark"]')
const cursor = document.querySelector<HTMLElement>('.cursor')

let lastFocus: HTMLElement | null = null
let shelfOpen = false
let cursorOn = false
let cursorRaf = 0
let ptrX = 0
let ptrY = 0
let curX = 0
let curY = 0
let cursorArmed = false
let cursorHot = false
let parX = 0
let parY = 0
let parTX = 0
let parTY = 0
let parRaf = 0

function reduced() {
  return reduceMq.matches
}

function readyType() {
  root.classList.remove('is-pending')
  root.classList.add('is-ready')
}

async function waitForAnurati() {
  if (reduced()) {
    readyType()
    return
  }
  try {
    await Promise.race([
      document.fonts.load('400 8rem "Anurati"').then(() => document.fonts.ready),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1800)
      }),
    ])
  } catch {
    // still show
  }
  readyType()
}

function isWorkPath() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return path === '/work'
}

function setShelf(open: boolean, push = false) {
  if (!shelf) return
  const was = shelfOpen
  shelfOpen = open
  document.body.classList.toggle('is-shelf', open)
  shelf.setAttribute('aria-hidden', String(!open))
  if (scrim) {
    scrim.hidden = !open
  }
  if (home) home.inert = open
  openers.forEach((a) => a.setAttribute('aria-expanded', String(open)))

  if (open) {
    document.title = 'Work — Acidity'
    if (!was) {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openers[0] ?? null
    }
    if (wash) wash.style.transform = 'none'
    if (mark) mark.style.transform = 'none'
    shelf.querySelector<HTMLElement>('a[href], button')?.focus()
    if (push && !isWorkPath()) history.pushState({ shelf: true }, '', '/work')
  } else {
    document.title = 'Acidity'
    lastFocus?.focus()
    lastFocus = null
    if (push && isWorkPath()) history.pushState({ shelf: false }, '', '/')
  }
}

function stepCursor() {
  if (!cursorOn || !cursor) return
  curX += (ptrX - curX) * 0.32
  curY += (ptrY - curY) * 0.32
  cursor.style.transform = `translate3d(${curX}px, ${curY}px, 0)`
  cursorRaf = requestAnimationFrame(stepCursor)
}

function setCursorMode() {
  const next = !reduced() && fineMq.matches && hoverMq.matches
  root.classList.toggle('has-cursor', next)
  if (cursorOn && !next) {
    cancelAnimationFrame(cursorRaf)
    cursorRaf = 0
    cursorOn = false
    if (cursor) cursor.style.opacity = '0'
  }
  if (next && !cursorOn) {
    cursorOn = true
    stepCursor()
  }
}

function stepParallax() {
  if (reduced() || shelfOpen) {
    parRaf = 0
    return
  }
  parX += (parTX - parX) * 0.08
  parY += (parTY - parY) * 0.08
  if (wash) {
    wash.style.transform = `translate3d(${(parX * 18).toFixed(1)}px, ${(parY * 14).toFixed(1)}px, 0)`
  }
  if (mark) {
    mark.style.transform = `translate3d(${(parX * -10).toFixed(1)}px, ${(parY * -8).toFixed(1)}px, 0)`
  }
  if (Math.abs(parTX - parX) > 0.001 || Math.abs(parTY - parY) > 0.001) {
    parRaf = requestAnimationFrame(stepParallax)
  } else {
    parRaf = 0
  }
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  ptrX = e.clientX
  ptrY = e.clientY
  if (cursorOn && cursor) {
    if (!cursorArmed) {
      curX = ptrX
      curY = ptrY
      cursorArmed = true
      cursor.style.opacity = '1'
    }
    const hot = !!(e.target instanceof Element && e.target.closest('a, button'))
    if (hot !== cursorHot) {
      cursorHot = hot
      cursor.classList.toggle('is-hot', hot)
    }
  }
  if (!reduced() && !shelfOpen && fineMq.matches) {
    parTX = e.clientX / window.innerWidth - 0.5
    parTY = e.clientY / window.innerHeight - 0.5
    if (!parRaf) parRaf = requestAnimationFrame(stepParallax)
  }
}

function onPointerLeave() {
  cursorArmed = false
  cursor?.style.setProperty('opacity', '0')
  parTX = 0
  parTY = 0
  if (!parRaf && !reduced()) parRaf = requestAnimationFrame(stepParallax)
}

openers.forEach((a) => {
  a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    e.preventDefault()
    setShelf(true, true)
  })
})

closers.forEach((el) => {
  el.addEventListener('click', () => setShelf(false, true))
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && shelfOpen) {
    e.preventDefault()
    setShelf(false, true)
  }
})

window.addEventListener('popstate', () => setShelf(isWorkPath()))

window.addEventListener('pointermove', onPointerMove, { passive: true })
document.documentElement.addEventListener('pointerleave', onPointerLeave)

reduceMq.addEventListener('change', () => {
  setCursorMode()
  if (reduced()) {
    wash && (wash.style.transform = 'none')
    mark && (mark.style.transform = 'none')
    readyType()
  }
})
fineMq.addEventListener('change', setCursorMode)
hoverMq.addEventListener('change', setCursorMode)

document.querySelectorAll<HTMLImageElement>('.app-mark').forEach((img) => {
  img.addEventListener('error', () => img.remove())
})

setCursorMode()
setShelf(isWorkPath())
void waitForAnurati()
