import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { openDistPage } from './resume-browser.mjs'
import { RESUME_ROUTE } from './resume-source.mjs'

const WIDTH = 1200
const HEIGHT = 630
const DOC_WIDTH = 604
const DOC_HEIGHT = 446

// The blur is deliberate: the card is cached by every site that unfurls the
// link, so it should read as "a resume" without legible details that go stale.
const DOC_BLUR_PX = 4

function dataUrl(bytes, type) {
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
}

function cardHtml({ doc, logo, font }) {
  return `<!doctype html>
<style>
  @font-face { font-family: Fraunces; font-weight: 700; src: url(${font}) format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; position: relative;
    background:
      radial-gradient(circle 480px at 180px 126px, rgb(21 94 99 / 14%), transparent),
      radial-gradient(circle 540px at 960px 63px, rgb(198 93 46 / 12%), transparent),
      #fffaf2;
  }
  .banner {
    position: absolute; inset: 0 0 auto; height: 147px;
    background: linear-gradient(#155e63, #27796e);
    border-bottom: 7px solid #c65d2e;
    display: flex; align-items: center; padding: 0 80px 7px;
  }
  h1 { font: 700 60px Fraunces, serif; color: #fffaf2; }
  .logo {
    position: absolute; top: 13px; right: 16px; width: 60px; height: 60px;
    background: rgb(255 250 242 / 18%); display: grid; place-items: center;
  }
  .logo img { width: 46px; height: 46px; }
  .shadow { position: absolute; left: 290px; top: 164px; width: 620px; height: 468px; background: rgb(17 17 17 / 6%); }
  .frame {
    position: absolute; left: 286px; top: 154px; width: 628px; height: 470px;
    background: rgb(255 250 242 / 92%); border: 2px solid rgb(217 209 195 / 78%);
  }
  .doc { position: absolute; left: ${(WIDTH - DOC_WIDTH) / 2}px; top: 166px; width: ${DOC_WIDTH}px; height: ${DOC_HEIGHT}px; overflow: hidden; }
  .doc img { width: 100%; filter: blur(${DOC_BLUR_PX}px); opacity: 0.9; }
</style>
<div class="shadow"></div>
<div class="frame"></div>
<div class="doc"><img src="${doc}" alt=""></div>
<div class="banner"><h1>David Dangerfield Resume</h1></div>
<div class="logo"><img src="${logo}" alt=""></div>`
}

// Renders images/social/resume-share.png, the link preview for /resume/ and
// /cv, from the top of the resume page as it appears on screen.
export async function renderResumeShare(browser, rootDir, distDir, outputPath) {
  const resumePage = await openDistPage(browser, distDir, RESUME_ROUTE, {
    viewport: { width: 1280, height: 1600 },
    colorScheme: 'light',
  })
  const sheet = await resumePage.locator('.resume').boundingBox()
  const doc = await resumePage.screenshot({
    clip: {
      x: sheet.x,
      y: sheet.y,
      width: sheet.width,
      height: (sheet.width * DOC_HEIGHT) / DOC_WIDTH,
    },
  })
  await resumePage.close()

  const card = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  await card.setContent(
    cardHtml({
      doc: dataUrl(doc, 'image/png'),
      logo: dataUrl(await readFile(join(rootDir, 'favicon-48x48.png')), 'image/png'),
      font: dataUrl(await readFile(join(rootDir, 'fonts/resume/fraunces-700.woff2')), 'font/woff2'),
    }),
  )
  await card.evaluate(() => document.fonts.ready)
  await card.screenshot({ path: outputPath })
  await card.close()
}
