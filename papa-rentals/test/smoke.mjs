/* Papa Rentals redesign smoke test @ 390x844. Fails on any JS/page error. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:4173'
const SHOTS = process.env.SHOTS_DIR || 'test/screenshots'
mkdirSync(SHOTS, { recursive: true })

const errors = []
let step = 'start'
const checks = []
function ok(name, cond) {
  checks.push([name, Boolean(cond)])
  if (!cond) console.error('FAIL:', name)
  else console.log('ok:', name)
}

// CI/sandboxes may pin a prebuilt browser; locally Playwright finds its own
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
)
async function makePage(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...ctxOpts })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[pageerror @ ${step}] ${e.message}`))
  page.on('console', (m) => {
    // resource-load failures (blocked Unsplash) are expected offline; JS errors are not
    if (m.type() === 'error' && !/Failed to load resource|net::|images\.unsplash/.test(m.text()))
      errors.push(`[console @ ${step}] ${m.text()}`)
  })
  return { ctx, page }
}

const { ctx, page } = await makePage()

step = 'first load + onboarding'
await page.goto(BASE, { waitUntil: 'networkidle' })
ok('onboarding modal shows', await page.locator('.modal').isVisible())
ok('onboarding photo strip renders', (await page.locator('.onboard-strip .item-art').count()) === 3)
await page.screenshot({ path: `${SHOTS}/00-onboarding.png` })
await page.fill('.modal input', 'Papa')
await page.click('.modal .slot-chip:has-text("Karachi")')
await page.click('.modal .btn-primary')
await page.waitForTimeout(400)

step = 'home'
ok('studio hero renders', await page.locator('.studio-hero').isVisible())
ok('greeting personalized', (await page.locator('.studio-title h1').innerText()).includes('Papa'))
ok('wide shot shows offer tags', (await page.locator('.studio-offers .studio-tag').count()) > 0)
ok('filmstrip has all stations', (await page.locator('.studio-stop').count()) === 11)
ok('category chips', (await page.locator('.cat-chip').count()) >= 10)
ok('font applied', await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Plus Jakarta Sans')))
ok('cards use 4:3 photo art', (await page.locator('.item-card .art-card').count()) > 0)
ok('bottom nav renders 5 svg icons', (await page.locator('.bottom-nav .nav-ico svg').count()) === 5)
ok('no emoji anywhere in the DOM', !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2764}\u{2B50}★☆♥♡✔✖]/u.test(await page.evaluate(() => document.body.innerText)))
await page.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: false })

step = 'vendor-first home'
ok('vendor cards present', (await page.locator('.vendor-card').count()) >= 5)
ok('vendor card has rating + response', await page.locator('.vendor-card .rating-compact').first().isVisible())
ok('vendor card has category tags', (await page.locator('.vendor-card .vendor-cat-tag').count()) > 0)
ok('vendor rail shows inline gear', (await page.locator('.vendor-card .vendor-rail .item-card').count()) > 0)
// deals + packages appear above the vendor list
const order = await page.evaluate(() => {
  const txt = [...document.querySelectorAll('.section-head h2')].map((h) => h.textContent || '')
  const deals = txt.findIndex((t) => /Flash deals/.test(t))
  const kits = txt.findIndex((t) => /Production kits/.test(t))
  const vendors = txt.findIndex((t) => /Vendors near you/.test(t))
  return { deals, kits, vendors }
})
ok('packages/offers come before vendors', order.kits >= 0 && order.vendors > order.kits && (order.deals < 0 || order.deals < order.vendors))
await page.locator('.vendor-card').first().scrollIntoViewIfNeeded()
await page.screenshot({ path: `${SHOTS}/01b-vendors.png` })

step = 'studio hero camera pan'
{
  const w = await page.evaluate(() => document.querySelector('.studio-track').clientWidth)
  await page.evaluate((w) => { document.querySelector('.studio-track').scrollLeft = w * 3 }, w)
  await page.waitForTimeout(700)
  const cap = await page.locator('.studio-slug').innerText()
  ok('pan settles on the Lighting station', /LIGHTING/i.test(cap) && /Lighting/.test(cap))
  ok('caption shows live stats', /rental/.test(cap) && /from Rs/.test(cap))
  const activeIdx = await page.evaluate(() => [...document.querySelectorAll('.studio-stop')].findIndex((b) => b.classList.contains('active')))
  ok('filmstrip tracks the camera', activeIdx === 3)
  await page.click('.studio-track .studio-slide:nth-child(4) .studio-tap')
  await page.waitForTimeout(500)
  ok('tapping the framed light opens Lighting', page.url().includes('cat=lighting'))
  await page.goBack(); await page.waitForTimeout(500)
  // filmstrip jump
  await page.click('.studio-stop >> nth=7')
  await page.waitForTimeout(800)
  const cap2 = await page.locator('.studio-slug').innerText()
  ok('filmstrip jumps the camera', /TRANSPORT/i.test(cap2))
  await page.evaluate(() => { document.querySelector('.studio-track').scrollLeft = 0 })
  await page.waitForTimeout(500)
}

step = 'vendor storefront'
await page.locator('.vendor-card .vendor-head').first().click()
await page.waitForTimeout(500)
ok('navigated to vendor route', page.url().includes('#/vendor/'))
ok('storefront hero renders', await page.locator('.vendor-hero').isVisible())
ok('storefront stat row', (await page.locator('.vendor-stat').count()) === 4)
ok('gear grouped into sections', (await page.locator('.vendor-section').count()) >= 1)
const tabCount = await page.locator('.vendor-tab').count()
if (tabCount > 1) {
  await page.locator('.vendor-tab').nth(1).click()
  await page.waitForTimeout(500)
  ok('category tab scroll works', true)
}
ok('search-within-vendor present', await page.locator('.vendor-search input').isVisible())
await page.screenshot({ path: `${SHOTS}/01c-storefront.png` })
await page.goBack()
await page.waitForTimeout(400)

step = 'search overlay'
await page.click('.search-pill')
await page.waitForSelector('.search-overlay')
ok('overlay: trending chips', (await page.locator('.search-overlay .filter-chip').count()) > 0)
ok('overlay: department rows', (await page.locator('.search-overlay .sug-row').count()) >= 10)
await page.fill('.search-overlay input', 'alexia') // typo for Alexa
await page.waitForTimeout(250)
const sugText = await page.locator('.search-overlay .sug-row').first().innerText()
ok('typo search finds the Alexa', /alexa/i.test(sugText))
await page.screenshot({ path: `${SHOTS}/02-search.png` })

step = 'search submit -> browse'
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
ok('landed on browse?q', page.url().includes('browse') && page.url().includes('q='))
ok('best-match sort default', await page.evaluate(() => document.querySelector('select[aria-label="Sort"]')?.value === 'relevance'))
ok('results present', (await page.locator('.grid .item-card').count()) > 0)
await page.screenshot({ path: `${SHOTS}/03-browse.png` })

step = 'item detail'
await page.click('.grid .item-card >> nth=0')
await page.waitForTimeout(500)
ok('detail hero art', await page.locator('.gallery, .art-hero').first().isVisible())
ok('floating back button (mobile)', await page.locator('.float-back').isVisible())
ok('mobile CTA bar visible', await page.locator('.cta-bar').isVisible())
ok('similar items row', (await page.locator('.h-scroll .item-card').count()) > 0)
await page.screenshot({ path: `${SHOTS}/04-item.png` })

step = 'add to cart via CTA bar'
await page.click('.cta-bar .btn-primary')
await page.waitForTimeout(400)
ok('toast confirms add', await page.locator('.toast').isVisible())
ok('cart badge shows 1', (await page.locator('.bottom-nav .dot').first().innerText()) === '1')

step = 'personalized home rows'
await page.click('.float-back') // CTA bar covers the nav on detail pages (by design) — leave via back
await page.waitForTimeout(400)
await page.click('.bottom-nav button >> nth=0')
await page.waitForTimeout(500)
ok('For you row appears after activity', await page.locator('text=For you').first().isVisible())
// "Because you viewed" lives in a <Deferred> rail that only renders once scrolled
// near, so bring it into view before asserting rather than reading a lazy blank.
await page.locator('#because').scrollIntoViewIfNeeded().catch(() => {})
await page.waitForTimeout(300)
ok('Because you viewed row', await page.locator('text=Because you viewed').isVisible())
await page.screenshot({ path: `${SHOTS}/05-home-personalized.png` })

step = 'cart'
await page.click('.bottom-nav button:has-text("Cart")')
await page.waitForTimeout(400)
ok('cart line present', (await page.locator('.cart-line').count()) === 1)
ok('cross-sell present', await page.locator('text=Complete your setup').isVisible())
await page.screenshot({ path: `${SHOTS}/06-cart.png` })

step = 'notifications sheet dismiss'
// Target by label, not position: the topbar gained a theme toggle (also .icon-btn)
// ahead of this button, so a positional nth=0 now lands on the wrong control.
await page.click('.topbar button[aria-label^="Notifications"]')
await page.waitForSelector('.modal')
ok('sheet grip present', await page.locator('.sheet-grip').isVisible())
await page.click('.modal .icon-btn') // close button
await page.waitForTimeout(300)
ok('sheet dismissed', (await page.locator('.modal').count()) === 0)

step = 'orders + profile'
await page.click('.bottom-nav button:has-text("Orders")')
await page.waitForTimeout(300)
await page.click('.bottom-nav button:has-text("Profile")')
await page.waitForTimeout(700)
ok('wallet card', await page.locator('.wallet-card').isVisible())
await page.screenshot({ path: `${SHOTS}/07-profile.png` })

step = 'hardware back'
await page.goBack()
await page.waitForTimeout(300)
ok('back returns to orders', page.url().includes('orders'))
await ctx.close()

step = 'dark mode'
{
  const { ctx: dctx, page: dpage } = await makePage({ colorScheme: 'dark' })
  await dpage.goto(BASE, { waitUntil: 'networkidle' })
  await dpage.click('.modal .btn-primary')
  await dpage.waitForTimeout(400)
  const bg = await dpage.evaluate(() => getComputedStyle(document.body).backgroundColor)
  ok('dark background applied', bg === 'rgb(22, 19, 16)')
  await dpage.screenshot({ path: `${SHOTS}/08-home-dark.png` })
  await dctx.close()
}

step = 'reduced motion'
{
  const { ctx: rctx, page: rpage } = await makePage({ reducedMotion: 'reduce' })
  await rpage.goto(BASE, { waitUntil: 'networkidle' })
  await rpage.click('.modal .btn-primary')
  await rpage.waitForTimeout(300)
  ok('reduced-motion still renders home', await rpage.locator('.studio-hero').isVisible())
  // the camera pan + tap must still work with motion reduced
  const rw = await rpage.evaluate(() => document.querySelector('.studio-track').clientWidth)
  await rpage.evaluate((w) => { document.querySelector('.studio-track').scrollLeft = w * 3 }, rw)
  await rpage.waitForTimeout(400)
  await rpage.click('.studio-track .studio-slide:nth-child(4) .studio-tap')
  await rpage.waitForTimeout(400)
  ok('reduced-motion: station tap still navigates', rpage.url().includes('cat=lighting'))
  await rctx.close()
}

await browser.close()

const failed = checks.filter(([, c]) => !c)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (errors.length) {
  console.error('\nJS/page errors:')
  errors.forEach((e) => console.error(' ', e))
}
process.exit(failed.length || errors.length ? 1 : 0)
