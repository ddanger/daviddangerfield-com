export function initMobileNav() {
  const navToggle = document.querySelector('.nav-toggle')
  const navLinks = document.querySelector('.nav-links')

  if (!navToggle || !navLinks) {
    return
  }

  function closeNav() {
    navLinks.classList.remove('open')
    navToggle.setAttribute('aria-expanded', 'false')
  }

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open')
    navToggle.setAttribute('aria-expanded', String(isOpen))
  })

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNav)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) {
      closeNav()
      navToggle.focus()
    }
  })
}
