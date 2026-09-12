import './style.css'

const root = document.documentElement
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

function show() {
  root.classList.remove('is-pending')
  root.classList.add('is-ready')
}

async function waitForAnurati() {
  if (reduce.matches) {
    show()
    return
  }
  try {
    await Promise.race([
      document.fonts.load('400 8rem "Anurati"').then(() => document.fonts.ready),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1600)
      }),
    ])
  } catch {
    // still show
  }
  show()
}

void waitForAnurati()
reduce.addEventListener('change', (e) => {
  if (e.matches) show()
})
