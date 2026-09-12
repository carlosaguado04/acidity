import './style.css'

const root = document.documentElement
const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')

type ShelfId = 'apps' | 'work'

const home = document.getElementById('main')
const scrim = document.querySelector<HTMLElement>('.scrim')
const shelves = [...document.querySelectorAll<HTMLElement>('[data-shelf]')]
const openers = [...document.querySelectorAll<HTMLAnchorElement>('[data-open]')]
const closers = [...document.querySelectorAll('[data-close]')]
const wash = document.querySelector<HTMLElement>('[data-scroll-wash]')

let lastFocus: HTMLElement | null = null
let openId: ShelfId | null = null
let washRaf = 0

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

function paintWash() {
  washRaf = 0
  if (!wash || reduced()) return
  const y = window.scrollY
  wash.style.transform = `translate3d(0, ${(y * 0.16).toFixed(1)}px, 0)`
}

function onScroll() {
  if (reduced() || washRaf) return
  washRaf = requestAnimationFrame(paintWash)
}

function watchEnter() {
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-enter]')]
  if (reduced()) {
    nodes.forEach((el) => el.classList.add('is-in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { threshold: 0.22, rootMargin: '0px 0px -10% 0px' },
  )
  nodes.forEach((el) => io.observe(el))
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
window.addEventListener('scroll', onScroll, { passive: true })

reduceMq.addEventListener('change', () => {
  if (reduced()) {
    if (wash) wash.style.transform = 'none'
    document.querySelectorAll('[data-enter]').forEach((el) => el.classList.add('is-in'))
    readyType()
  }
})

document.querySelectorAll<HTMLImageElement>('.app-mark').forEach((img) => {
  img.addEventListener('error', () => img.remove())
})

setShelf(shelfFromPath())
watchEnter()
void waitForAnurati()
