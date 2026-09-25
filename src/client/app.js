import { initActiveNav } from './components/active-nav.js'
import { initFooterYear } from './components/footer-year.js'
import { initMobileNav } from './components/mobile-nav.js'
import { initRevealAnimations } from './components/reveal.js'

export function bootSite() {
  initActiveNav()
  initMobileNav()
  initRevealAnimations()
  initFooterYear()
}
