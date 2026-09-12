import './style.css'

const root = document.documentElement
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const fineMq = window.matchMedia('(pointer: fine)')

type ShelfId = 'apps' | 'work'

const home = document.getElementById('main')
const scrim = document.querySelector<HTMLElement>('.scrim')
const shelves = [...document.querySelectorAll<HTMLElement>('[data-shelf]')]
const openers = [...document.querySelectorAll<HTMLAnchorElement>('[data-open]')]
const closers = [...document.querySelectorAll('[data-close]')]
const mark = document.querySelector<HTMLElement>('[data-parallax="mark"]')
const copy = document.querySelector<HTMLElement>('[data-parallax="copy"]')

let lastFocus: HTMLElement | null = null
let openId: ShelfId | null = null
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

function isShelfId(value: string): value is ShelfId {
  return value === 'apps' || value === 'work'
}

function shelfFromPath(): ShelfId | null {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/apps') return 'apps'
  if (path === '/work') return 'work'
  return null
}

function titleFor(id: ShelfId | null) {
  if (id === 'apps') return 'Apps — Acidity'
  if (id === 'work') return 'Work — Acidity'
  return 'Acidity'
}

function setShelf(id: ShelfId | null, push = false) {
  const was = openId
  openId = id
  document.body.classList.toggle('is-shelf', id !== null)
  if (scrim) scrim.hidden = id === null
  if (home) home.inert = id !== null

  shelves.forEach((el) => {
    const on = el.dataset.shelf === id
    el.classList.toggle('is-on', on)
    el.setAttribute('aria-hidden', String(!on))
  })
  openers.forEach((a) => {
    a.setAttribute('aria-expanded', String(a.dataset.open === id))
  })

  document.title = titleFor(id)

  if (id) {
    if (!was) {
      lastFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : openers[0] ?? null
    }
    if (mark) mark.style.transform = 'none'
    if (copy) copy.style.transform = 'none'
    const panel = shelves.find((el) => el.dataset.shelf === id)
    panel?.querySelector<HTMLElement>('a[href], button')?.focus()
    if (push) {
      const href = `/${id}`
      if (window.location.pathname.replace(/\/+$/, '') !== href) {
        history.pushState({ shelf: id }, '', href)
      }
    }
  } else {
    lastFocus?.focus()
    lastFocus = null
    if (push && shelfFromPath()) history.pushState({ shelf: null }, '', '/')
  }
}

function stepParallax() {
  if (reduced() || openId) {
    parRaf = 0
    return
  }
  parX += (parTX - parX) * 0.07
  parY += (parTY - parY) * 0.07
  if (mark) {
    mark.style.transform = `translate3d(${(parX * -10).toFixed(1)}px, ${(parY * -8).toFixed(1)}px, 0)`
  }
  if (copy) {
    copy.style.transform = `translate3d(${(parX * 7).toFixed(1)}px, ${(parY * 5).toFixed(1)}px, 0)`
  }
  if (Math.abs(parTX - parX) > 0.001 || Math.abs(parTY - parY) > 0.001) {
    parRaf = requestAnimationFrame(stepParallax)
  } else {
    parRaf = 0
  }
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch' || reduced() || openId || !fineMq.matches) return
  parTX = e.clientX / window.innerWidth - 0.5
  parTY = e.clientY / window.innerHeight - 0.5
  if (!parRaf) parRaf = requestAnimationFrame(stepParallax)
}

function onPointerLeave() {
  parTX = 0
  parTY = 0
  if (!parRaf && !reduced()) parRaf = requestAnimationFrame(stepParallax)
}

openers.forEach((a) => {
  a.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    const id = a.dataset.open
    if (!id || !isShelfId(id)) return
    e.preventDefault()
    setShelf(id, true)
  })
})

closers.forEach((el) => {
  el.addEventListener('click', () => setShelf(null, true))
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openId) {
    e.preventDefault()
    setShelf(null, true)
  }
})

window.addEventListener('popstate', () => setShelf(shelfFromPath()))
window.addEventListener('pointermove', onPointerMove, { passive: true })
document.documentElement.addEventListener('pointerleave', onPointerLeave)

reduceMq.addEventListener('change', () => {
  if (reduced()) {
    if (mark) mark.style.transform = 'none'
    if (copy) copy.style.transform = 'none'
    readyType()
  }
})

document.querySelectorAll<HTMLImageElement>('.app-mark').forEach((img) => {
  img.addEventListener('error', () => img.remove())
})

setShelf(shelfFromPath())
void waitForAnurati()
