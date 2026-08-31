#!/usr/bin/env node
// Playwright walkthrough for the configurator wizard (feedback round 8's
// 5-step flow), the landing page, About page, and post-acceptance demo
// flow, and the Metal & Tile education page.
//
// Builds `app/web`, serves the built `dist/` with `vite preview`, then:
//
//   0. Reproduces the reported cold-load scroll-jump directly: a fresh
//      browser context (empty storage) loading /build#home at both
//      390x844 and 1280x800 must land with window.scrollY === 0 and the
//      header + step heading visible in the viewport.
//   1. Drives the happy path end to end on a 390x844 context, on the 5-step
//      flow (feedback round 8): Home (address entry -> satellite/manual
//      measurement -> solar question) -> Shingle -> Appearance (color +
//      drip edge) -> Included -> Review. Asserts PriceHero is absent
//      before a shingle is chosen, that the home step's satellite
//      measurement falls back to the plain manual form silently -- no
//      error/loading text left on screen -- since preview has no live
//      /api/measure, that confirming the outline (or using the manual
//      form) never itself navigates -- the solar question appears below,
//      on the SAME step -- and that only answering it and pressing the
//      real Continue advances to Shingle, that the appearance step renders
//      a real <img> swatch grid (not colored divs) with its description
//      panel updating to the selected color's name, and that the review
//      page shows $14,400 and $144/month (Titan XT, 0 solar panels).
//   2. Re-walks every step at 1280x800 via a FRESH full page load per step
//      (a cache-busting query param forces a real navigation rather than
//      an in-document fragment-only jump, since the state is already
//      earned in localStorage from the mobile pass).
//   3. From that same 1280x800 review page, clicks "I'm Ready to Move
//      Forward" and walks the post-acceptance demo flow (partner -> info
//      -> schedule -> confirmation), filling demo values along the way and
//      asserting the confirmation screen shows $14,400 and the scheduled
//      visit date. Screenshots the partner step's documents section
//      (license/insurance cards) separately. Re-walks each /next step at
//      390x844 via fresh page loads (state already earned in localStorage
//      from the 1280 walk), again capturing the documents section.
//   4. On fresh contexts (per width), verifies the landing page's address
//      input navigates to /build with the address pre-filled (landing on
//      the home step, address entry already satisfied), then loads /about.
//   5. On fresh contexts (per width), loads /metal; on the 1280 pass, opens
//      the Lightbox on flyer-1, screenshots it, closes it via Escape, and
//      asserts body scroll (locked while the Lightbox is open) is restored.
//   6. The home step's address entry degrades silently to a plain input in
//      preview (no live /api/address-suggest) -- asserted on both the
//      mobile fill and the 1280 fresh-load pass (no dropdown ever renders,
//      no console/page error). The address chip (current address +
//      "Change") is asserted visible on every step past the address entry
//      state, including Home itself once the address is set (feedback
//      round 8: the chip is now rendered inline on Home too). Since
//      preview also has no live /api/measure, the satellite confirm card
//      (amber accuracy notice, "Adjust outline") is otherwise unreachable
//      -- a dedicated fresh-context check mocks /api/measure (found:true +
//      mapMeta) at both widths to screenshot it directly, and also drives
//      a real pointer drag on one of the outline editor's points.
//   7. The outline editor's confirm card shows a prominent "Outline not
//      covering your whole roof? Adjust it." prompt with a bordered
//      peer-weight button -- asserted on the same mocked found:true
//      confirm card as item 6, and the outline editor there renders 6
//      points (sw, w-mid, nw, ne, e-mid, se), asserted by count before the
//      drag. A dedicated fresh-context check mocks a
//      {found:false, reason:"no-solar-data"} response WITH imagery/
//      seedCorners at both widths, and asserts the trace-the-roof editor
//      renders (heading, body copy, all 6 seeded points, the small
//      manual-entry escape hatch) and that "Use this outline" commits the
//      outline WITHOUT navigating away (the solar question appears next,
//      on the same step), then that answering it and pressing Continue
//      actually advances the wizard.
//
// Screenshots every /build step at 390x844 and 1280x800 (plus the home
// step mid-measurement and post-solar-answer, and the shingle step
// mid-selection, on mobile), every /next step at both widths (plus the
// partner step's documents section separately at both widths), the
// landing/about pages at both widths, and the /metal page at both widths
// (plus the open lightbox at 1280x800), all into .superpowers/sdd/screens/.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');
const SCREENS_DIR = path.join(REPO_ROOT, '.superpowers', 'sdd', 'screens');
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

// Feedback round 8: the 9-step flow collapsed to 5 -- address is absorbed
// into Home, color+finishing merge into Appearance, underlayment and
// protection are gone.
const STEPS = [
  { n: 1, id: 'home' },
  { n: 2, id: 'shingle' },
  { n: 3, id: 'appearance' },
  { n: 4, id: 'included' },
  { n: 5, id: 'review' },
];

const NEXT_STEPS = ['partner', 'info', 'schedule', 'confirm'];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const PRICE_HERO_SELECTOR = '[aria-label="Your roof price"]';

// A disabled -> enabled button flip (e.g. Continue unlocking) still runs a
// plain CSS color transition (duration-200) even under prefers-reduced-
// motion, which only disables Motion's own animations. Screenshotting right
// on the same tick as the flip can catch a mid-transition frame -- wait this
// long past the flip before any screenshot that could show one.
const BUTTON_TRANSITION_SETTLE_MS = 300;

function fail(message) {
  console.error(`\nFAIL: ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

async function waitForServer(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  fail(`vite preview did not become ready at ${url} within ${timeoutMs}ms`);
}

async function waitForStep(page, id, timeoutMs = 3000) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="build-step"]')?.getAttribute('data-step') === expected,
    id,
    { timeout: timeoutMs }
  );
}

async function waitForNextStep(page, id, timeoutMs = 3000) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="next-step"]')?.getAttribute('data-step') === expected,
    id,
    { timeout: timeoutMs }
  );
}

async function screenshotStep(page, step, width, suffix = '') {
  const file = path.join(SCREENS_DIR, `step-${step.n}-${step.id}${suffix}-${width}.png`);
  await page.screenshot({ path: file });
  console.log(`  screenshot: ${path.relative(REPO_ROOT, file)}`);
}

async function screenshotNamed(page, name, width) {
  const file = path.join(SCREENS_DIR, `${name}-${width}.png`);
  await page.screenshot({ path: file });
  console.log(`  screenshot: ${path.relative(REPO_ROOT, file)}`);
}

// Local-date arithmetic (no UTC shifting): mirrors StepSchedule's own
// `toISODate` so the test picks a date the component will actually accept.
// +7 exactly satisfies BOTH the pre-Commit-3 rule ("at least 7 days from
// today") and the post-Commit-3 rule ("tomorrow through today+7
// inclusive") -- deliberately, so this script stays green across both.
function isoDatePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Mirrors StepConfirm's own `formatVisitDate` exactly, so the assertion
// checks for precisely the string the component renders.
function formatVisitDateJS(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function assertColdLoadTop(page, label) {
  // Give the browser a brief moment for any native fragment-scroll to
  // settle before asserting against it -- this is exactly the behavior
  // that regresses if a step element's id ever collides with a step hash.
  await page.waitForTimeout(300);

  const scrollY = await page.evaluate(() => window.scrollY);
  if (scrollY !== 0) fail(`[${label}] expected window.scrollY === 0 on cold load, got ${scrollY}`);

  const viewportHeight = await page.evaluate(() => window.innerHeight);

  const headerBox = await page.locator('header').boundingBox();
  if (!headerBox || headerBox.y < 0 || headerBox.y >= viewportHeight) {
    fail(`[${label}] header not visible in viewport on cold load (box=${JSON.stringify(headerBox)})`);
  }

  const headingBox = await page.locator('main h1').first().boundingBox();
  if (!headingBox || headingBox.y < 0 || headingBox.y >= viewportHeight) {
    fail(`[${label}] step heading not visible in viewport on cold load (box=${JSON.stringify(headingBox)})`);
  }

  console.log(`  [${label}] cold load OK: scrollY=0, header + heading in viewport`);
}

// Deliberate step flow: selecting a card (or committing a measurement, or
// answering the solar question) must never itself navigate. After the
// action, wait a beat and assert the step hasn't changed -- only an
// explicit [Continue] tap may advance.
async function assertStillOnStep(page, stepId, label, waitMs = 600) {
  await page.waitForTimeout(waitMs);
  const actual = await page.locator('[data-testid="build-step"]').getAttribute('data-step');
  if (actual !== stepId) {
    fail(`[${label}] expected to still be on step "${stepId}" after selecting (no auto-advance), got "${actual}"`);
  }
  console.log(`  [${label}] selection did not auto-advance -- still on "${stepId}"`);
}

async function assertNoPriceHero(page, label) {
  const count = await page.locator(PRICE_HERO_SELECTOR).count();
  if (count !== 0) {
    fail(`[${label}] PriceHero should not render before a shingle is selected (found ${count} element(s))`);
  }
  console.log(`  [${label}] PriceHero correctly absent (no shingle selected yet)`);
}

// The home step's satellite measurement call has no live API in preview
// (returns available:false, or errors/404s entirely once the gate has no
// /api/* deploy behind it). Every one of those outcomes must fall back to
// the plain manual footprint form silently -- no spinner stuck forever, no
// error banner, no "couldn't measure" text anywhere on the step.
async function assertNoMeasurementErrorUI(page, label) {
  const homeStep = page.locator('[data-testid="build-step"][data-step="home"]');
  // Preview has no live /api/measure (available:false, a 404, or a network
  // error depending on how it's served) -- StepHome must fall back to the
  // plain manual form on its own, within the 8s measurement timeout, with
  // no error banner ever shown. Wait it out rather than racing it.
  try {
    await homeStep.locator('label[for="footprint"]').waitFor({ timeout: 9000 });
  } catch {
    fail(`[${label}] manual footprint form never appeared -- satellite fallback did not resolve`);
  }
  const text = await homeStep.innerText();
  if (/sizing your roof|error|failed|unable|couldn.t/i.test(text)) {
    fail(`[${label}] unexpected loading/error text still visible on the home step: ${text}`);
  }
  console.log(`  [${label}] no measurement error/loading UI visible; manual form present`);
}

// preview has no live /api/address-suggest either (same as /api/measure
// above) -- AddressCombobox must degrade silently to a plain, fully usable
// text input with no dropdown ever rendered and no console/page error
// surfaced, exactly like StepHome's satellite fallback above.
async function assertNoAddressDropdownError(page, label) {
  const listboxCount = await page.locator('[role="listbox"]').count();
  if (listboxCount !== 0) {
    fail(`[${label}] expected no address suggestion dropdown (preview has no live suggest API), found one`);
  }
  console.log(`  [${label}] no address dropdown rendered (degraded silently, as expected in preview)`);
}

function assertNoConsoleErrors(consoleErrors, label) {
  if (consoleErrors.length > 0) {
    fail(`[${label}] unexpected console/page error(s):\n${consoleErrors.join('\n')}`);
  }
}

// The compact address chip (current address + "Change") must be visible on
// every /build step once an address is set -- including Home itself
// (feedback round 8: Home now renders it inline once past address entry).
async function assertAddressChip(page, label, expectedAddress) {
  const chip = page.locator('[data-testid="address-chip"]');
  await chip.waitFor({ timeout: 2000 });
  const text = await chip.innerText();
  if (!text.includes(expectedAddress)) {
    fail(`[${label}] expected the address chip to show "${expectedAddress}", got "${text}"`);
  }
  console.log(`  [${label}] address chip visible with "${expectedAddress}"`);
}

async function assertReviewPrice(page, label) {
  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('$14,400')) {
    fail(`[${label}] Review page did not show $14,400. Page text:\n${bodyText}`);
  }
  if (!bodyText.includes('$144/month')) {
    fail(`[${label}] Review page did not show $144/month. Page text:\n${bodyText}`);
  }
  console.log(`  [${label}] verified $14,400 and $144/month on review page`);
}

// Appearance step (color half): the grid must render actual <img> swatches
// (real photos), not the old colored-div hex chips.
async function assertColorSwatchGrid(page, label) {
  const imgCount = await page.locator('[data-testid="build-step"][data-step="appearance"] img').count();
  if (imgCount < 10) {
    fail(`[${label}] expected an <img> swatch grid on the appearance step, found ${imgCount} <img> element(s)`);
  }
  console.log(`  [${label}] swatch grid renders ${imgCount} <img> elements (not colored divs)`);
}

// Appearance step: the description panel must update to name the
// just-selected color.
async function assertColorDescription(page, label, expectedColorName) {
  const name = page.locator('[data-testid="color-description-name"]');
  await name.waitFor({ timeout: 2000 });
  const text = (await name.innerText()).trim();
  if (text !== expectedColorName) {
    fail(`[${label}] expected color description panel to show "${expectedColorName}", got "${text}"`);
  }
  console.log(`  [${label}] description panel shows selected color "${expectedColorName}"`);
}

async function assertConfirmation(page, label, expectedDateText) {
  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('$14,400')) {
    fail(`[${label}] Confirmation did not show $14,400. Page text:\n${bodyText}`);
  }
  if (!bodyText.includes(expectedDateText)) {
    fail(`[${label}] Confirmation did not show visit date "${expectedDateText}". Page text:\n${bodyText}`);
  }
  console.log(`  [${label}] verified $14,400 and visit date "${expectedDateText}" on confirmation page`);
}

// Reproduces the reported bug directly: a brand new context (so localStorage
// is empty -- lands on #home) loading a URL that already contains the
// #home fragment, exactly like a bookmark, shared link, or reload would.
async function checkColdHomeLoad(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE_URL}/build#home`);
  await waitForStep(page, 'home');
  await assertColdLoadTop(page, `cold /build#home @ ${width}x${height}`);
  await context.close();
}

// Fresh context per width (no earned config from the main wizard walk):
// verifies the landing page's single address input stores the address and
// navigates to /build landing on the home step (address entry already
// satisfied), not a separate address step. Also screenshots landing and
// About.
async function checkLandingAndAbout(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto(BASE_URL);
  await page.waitForSelector('#landing-address');
  await screenshotNamed(page, 'landing', width);

  await page.getByLabel('Property address').fill('123 Palm Ave, Tampa, FL');
  await page.getByRole('button', { name: 'Build My Roof' }).click();
  await page
    .getByText('Include your ZIP code so we find the right home.')
    .waitFor({ timeout: 2000 });
  const pathAfterInvalidSubmit = new URL(page.url()).pathname;
  if (pathAfterInvalidSubmit !== '/') {
    fail(
      `[landing @ ${width}x${height}] expected to stay on landing ("/") after a missing-ZIP submit, got "${pathAfterInvalidSubmit}"`
    );
  }
  console.log(`  [landing @ ${width}x${height}] missing-ZIP validation error verified, no navigation`);

  const testAddress = '456 Ocean Dr, Miami, FL 33139';
  await page.getByLabel('Property address').fill(testAddress);
  await page.getByRole('button', { name: 'Build My Roof' }).click();
  await waitForStep(page, 'home');

  const storedAddress = await page.evaluate(() => {
    const raw = window.localStorage.getItem('chq-build-v1');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.address ?? null;
  });
  if (storedAddress !== testAddress) {
    fail(
      `[landing @ ${width}x${height}] expected /build to land on 'home' with address "${testAddress}" prefilled, got stored address "${storedAddress}"`
    );
  }
  console.log(`  [landing @ ${width}x${height}] address prefill -> /build (home step) verified`);

  await page.goto(`${BASE_URL}/about`);
  await page.waitForSelector('article');
  await screenshotNamed(page, 'about', width);

  await context.close();
}

// /metal (Task 6): fresh context per width. Screenshots the page, then on
// the 1280 pass opens the Lightbox on flyer-1, screenshots it, closes via
// Escape, and asserts body scroll (locked while open) is restored after.
async function checkMetal(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto(`${BASE_URL}/metal`);
  await page.waitForSelector('[data-testid="metal-page"]');
  await screenshotNamed(page, 'metal', width);

  if (width === 1280) {
    const overflowBefore = await page.evaluate(() => document.body.style.overflow);

    await page.locator('[data-testid="flyer-1"]').click();
    await page.waitForSelector('[data-testid="lightbox"]');
    await screenshotNamed(page, 'metal-lightbox', width);

    const overflowLocked = await page.evaluate(() => document.body.style.overflow);
    if (overflowLocked !== 'hidden') {
      fail(
        `[metal @ ${width}x${height}] expected body scroll locked (overflow: hidden) while lightbox open, got "${overflowLocked}"`
      );
    }

    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="lightbox"]', { state: 'detached' });

    const overflowAfter = await page.evaluate(() => document.body.style.overflow);
    if (overflowAfter !== overflowBefore) {
      fail(
        `[metal @ ${width}x${height}] expected body scroll restored after Escape (was "${overflowBefore}"), got "${overflowAfter}"`
      );
    }
    console.log(`  [metal @ ${width}x${height}] lightbox open (flyer-1) -> Escape close -> body scroll restored`);
  }

  await context.close();
}

// 1x1 transparent PNG, used to fulfill the mocked aerial-image request
// below without any real network egress.
const BLANK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// preview has no live /api/measure, so the main happy-path walk above only
// ever exercises the manual-fallback form -- the satellite confirm card
// (amber accuracy notice, "Adjust outline" entry point) is otherwise
// unreachable in this environment. Mocks /api/measure with a `found:true`
// response (mapMeta + imageUrl included) on a fresh, isolated context so
// that card can actually be screenshotted, at both widths.
async function checkSatelliteConfirmAmberNotice(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const mockImageUrl = `${BASE_URL}/mock-aerial.png`;
  await page.route('**/mock-aerial.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(BLANK_PNG_BASE64, 'base64') })
  );
  await page.route('**/api/measure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        outlineSqft: 2308.32,
        imageUrl: mockImageUrl,
        mapMeta: {
          centerLat: 27.336230049999998,
          centerLng: -82.539976,
          zoom: 20,
          sw: { lat: 27.3360897, lng: -82.5400199 },
          ne: { lat: 27.3363704, lng: -82.5399321 },
          imgW: 1280,
          imgH: 800,
        },
      }),
    })
  );

  await page.goto(`${BASE_URL}/build`);
  await waitForStep(page, 'home');
  await page.getByLabel('Property address').fill('1530 Main St, Sarasota, FL 34236');
  await page.getByRole('button', { name: 'Build My Roof' }).click();

  await page.getByText('We found your roof.').waitFor({ timeout: 5000 });

  const amberNotice = page.getByText(
    'The automated measurement may not be exact. A licensed professional reviews every roof and makes any needed adjustments before final pricing.'
  );
  await amberNotice.waitFor({ timeout: 2000 });
  await page.getByRole('button', { name: 'Adjust outline' }).waitFor({ timeout: 2000 });
  console.log(`  [satellite confirm @ ${width}x${height}] amber accuracy notice + Adjust outline both visible`);

  // "Adjust outline" must read as a real peer action, not a quiet ghost
  // link. Asserts the prompt text renders, and that the button itself has
  // real visual weight (a solid navy border), not a quiet pill style.
  await page
    .getByText('Outline not covering your whole roof?')
    .waitFor({ timeout: 2000 });
  await page.getByText('Adjust it.').waitFor({ timeout: 2000 });
  const adjustOutlineClass = await page.getByRole('button', { name: 'Adjust outline' }).getAttribute('class');
  if (!adjustOutlineClass || !adjustOutlineClass.includes('border-2') || !adjustOutlineClass.includes('border-navy-950')) {
    fail(
      `[satellite confirm @ ${width}x${height}] expected "Adjust outline" to have a prominent bordered style (border-2 border-navy-950), got class="${adjustOutlineClass}"`
    );
  }
  console.log(`  [satellite confirm @ ${width}x${height}] "Adjust it." prompt + prominent Adjust outline button verified`);

  // The mocked aerial image pushes the notice below the fold on shorter
  // viewports -- scroll it into view so the screenshot actually shows the
  // thing it exists to capture, not just the image above it. Taken BEFORE
  // confirming: the confirm card (and its notice) collapses on confirm.
  await amberNotice.scrollIntoViewIfNeeded();
  await screenshotNamed(page, 'home-confirm-amber', width);

  // Confirming must NOT navigate away -- it collapses the confirm card to
  // the confirmed row and reveals the solar question, on the same step
  // (client feedback 2026-08-31: no second live primary button remains).
  await page.getByRole('button', { name: 'Use this outline' }).click();
  await page.getByText('Roof size confirmed.').waitFor({ timeout: 2000 });
  await page.getByText('Do you have solar panels on your roof?').waitFor({ timeout: 2000 });
  await assertStillOnStep(page, 'home', `satellite confirm @ ${width}x${height}: confirming stays on Home`);
  const staleConfirm = await page.getByRole('button', { name: 'Use this outline' }).count();
  if (staleConfirm !== 0) {
    fail(`[satellite confirm @ ${width}x${height}] confirm card did not collapse after "Use this outline"`);
  }
  await screenshotNamed(page, 'home-confirmed-questions', width);

  await context.close();
}

const HOME_MAP_META = {
  centerLat: 27.336230049999998,
  centerLng: -82.539976,
  zoom: 20,
  sw: { lat: 27.3360897, lng: -82.5400199 },
  ne: { lat: 27.3363704, lng: -82.5399321 },
  imgW: 1280,
  imgH: 800,
};

// Feedback round 6: the reported bug was that adjusting the outline updated
// the footprint number but the confirm card kept showing the ORIGINAL
// rectangle. Drives a REAL pointer drag on one of the adjust-outline
// editor's handles via Playwright's mouse API, applies it, and screenshots
// the confirm card showing the outline has actually changed. The editor
// renders 6 corners (sw, w-mid, nw, ne, e-mid, se) -- asserts all 6 render,
// then drags one of them.
async function checkAdjustedOutlineOverlay(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const mockImageUrl = `${BASE_URL}/mock-aerial-2.png`;
  await page.route('**/mock-aerial-2.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(BLANK_PNG_BASE64, 'base64') })
  );
  await page.route('**/api/measure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        outlineSqft: 2308.32,
        imageUrl: mockImageUrl,
        mapMeta: HOME_MAP_META,
      }),
    })
  );

  await page.goto(`${BASE_URL}/build`);
  await waitForStep(page, 'home');
  await page.getByLabel('Property address').fill('1530 Main St, Sarasota, FL 34236');
  await page.getByRole('button', { name: 'Build My Roof' }).click();

  await page.getByText('We found your roof.').waitFor({ timeout: 5000 });
  const originalPolygonPoints = await page.locator('svg polygon').getAttribute('points');

  await page.getByRole('button', { name: 'Adjust outline' }).click();
  await page.getByText('Adjust the roof outline').waitFor({ timeout: 2000 });

  // Exactly 6 draggable points now (sw, w-mid, nw, ne, e-mid, se), not 4.
  const handleCount = await page.locator('[data-testid^="roof-outline-corner-"]').count();
  if (handleCount !== 6) {
    fail(`[adjusted overlay @ ${width}x${height}] expected 6 outline handles, found ${handleCount}`);
  }

  // Drags the sw corner (index 0) -- this real captured mapMeta's building
  // footprint is narrow east-west, so a drag sized to comfortably clear
  // both guards on a CORNER would send a MIDPOINT straight across to the
  // opposite edge. Midpoint-specific dragging is exercised precisely,
  // against controlled fixtures, by RoofOutlineEditor.test.tsx and
  // StepHome.test.tsx instead.
  const handle = page.getByTestId('roof-outline-corner-0');
  const box = await handle.boundingBox();
  if (!box) fail(`[adjusted overlay @ ${width}x${height}] could not locate corner handle 0's bounding box`);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const endX = startX + 40;
  const endY = startY + 30;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();

  const applyButton = page.getByRole('button', { name: 'Use this outline' });
  if (await applyButton.isDisabled()) {
    fail(`[adjusted overlay @ ${width}x${height}] "Use this outline" unexpectedly disabled after a modest one-point drag`);
  }
  await applyButton.click();

  await page.getByText('We found your roof.').waitFor({ timeout: 5000 });
  // Feedback round 8: applying stays on Home -- no navigation.
  await assertStillOnStep(page, 'home', `adjusted overlay @ ${width}x${height}: applying stays on Home`);
  const polygon = page.locator('svg polygon');
  await polygon.waitFor({ timeout: 2000 });
  const adjustedPolygonPoints = await polygon.getAttribute('points');
  if (adjustedPolygonPoints === originalPolygonPoints) {
    fail(`[adjusted overlay @ ${width}x${height}] confirm card polygon did not change after the drag+apply -- this is exactly the reported bug`);
  }
  console.log(
    `  [adjusted overlay @ ${width}x${height}] confirm card polygon changed after drag+apply (${originalPolygonPoints} -> ${adjustedPolygonPoints})`
  );

  await polygon.scrollIntoViewIfNeeded();
  await screenshotNamed(page, 'home-confirm-adjusted', width);

  await context.close();
}

// Same bbox as HOME_MAP_META above, but expressed as the no-solar-data
// response's own seedCorners: sw, w-mid, nw, ne, e-mid, se -- the 4
// rectangle corners plus the midpoints of the west/east edges.
const SEED_MAP_META = HOME_MAP_META;
const SEED_CORNERS = [
  { lat: 27.3360897, lng: -82.5400199 }, // sw
  { lat: 27.33623005, lng: -82.5400199 }, // w-mid
  { lat: 27.3363704, lng: -82.5400199 }, // nw
  { lat: 27.3363704, lng: -82.5399321 }, // ne
  { lat: 27.33623005, lng: -82.5399321 }, // e-mid
  { lat: 27.3360897, lng: -82.5399321 }, // se
];

// The no-solar-data trace flow. Mocks /api/measure returning
// {found:false, reason:"no-solar-data"} WITH imagery/mapMeta/seedCorners,
// and asserts the trace editor renders instead of the old manual dead-end:
// the "Draw your roof outline" heading, the body copy, all 6 seeded
// points, and the small manual-entry escape hatch -- then drives "Use this
// outline" and confirms it commits WITHOUT navigating (feedback round 8:
// the solar question appears next, on the same step), then that answering
// it and pressing Continue actually advances the wizard.
async function checkTraceMode(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const mockImageUrl = `${BASE_URL}/mock-aerial-seed.png`;
  await page.route('**/mock-aerial-seed.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(BLANK_PNG_BASE64, 'base64') })
  );
  await page.route('**/api/measure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: false,
        reason: 'no-solar-data',
        formattedAddress: '1530 Main St, Sarasota, FL 34236, USA',
        imageUrl: mockImageUrl,
        mapMeta: SEED_MAP_META,
        seedCorners: SEED_CORNERS,
      }),
    })
  );

  await page.goto(`${BASE_URL}/build`);
  await waitForStep(page, 'home');
  await page.getByLabel('Property address').fill('1530 Main St, Sarasota, FL 34236');
  await page.getByRole('button', { name: 'Build My Roof' }).click();

  await page.getByText('Draw your roof outline').waitFor({ timeout: 5000 });
  await page
    .getByText('We could not measure this roof automatically. Drag the points so the outline covers your roof.')
    .waitFor({ timeout: 2000 });

  const handleCount = await page.locator('[data-testid^="roof-outline-corner-"]').count();
  if (handleCount !== 6) {
    fail(`[trace mode @ ${width}x${height}] expected 6 seeded outline points, found ${handleCount}`);
  }
  await page.getByRole('button', { name: "Enter your home's footprint instead" }).waitFor({ timeout: 2000 });
  console.log(
    `  [trace mode @ ${width}x${height}] trace editor renders with 6 seeded points + manual-entry escape hatch`
  );

  await screenshotNamed(page, 'home-trace', width);

  await page.getByRole('button', { name: 'Use this outline' }).click();
  await page.getByText('Roof size confirmed.').waitFor({ timeout: 2000 });
  await page.getByText('Do you have solar panels on your roof?').waitFor({ timeout: 2000 });
  await assertStillOnStep(page, 'home', `trace mode @ ${width}x${height}: using the outline stays on Home`);
  console.log(`  [trace mode @ ${width}x${height}] "Use this outline" collapses to confirmed without navigating`);

  await page.getByRole('button', { name: 'No solar panels' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await waitForStep(page, 'shingle');
  console.log(`  [trace mode @ ${width}x${height}] answering solar + Continue advances the wizard past Home`);

  await context.close();
}

async function main() {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });

  console.log('Starting vite preview server...');
  // In this npm workspace, vite's binary is hoisted to the repo root
  // node_modules rather than app/web's own (which may not have a .bin dir).
  const viteBin = fs.existsSync(path.join(APP_DIR, 'node_modules', '.bin', 'vite'))
    ? path.join(APP_DIR, 'node_modules', '.bin', 'vite')
    : path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const server = spawn(viteBin, ['preview', '--port', String(PORT), '--strictPort'], {
    cwd: APP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write(`[vite] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));

  let browser;
  try {
    await waitForServer(BASE_URL);
    console.log('Server ready. Launching chromium...');
    browser = await chromium.launch();

    // --- Step 0: cold-load regression check, both widths, fresh storage ---
    console.log('\nCold-load check (fresh #home, empty storage)...');
    await checkColdHomeLoad(browser, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await checkColdHomeLoad(browser, VIEWPORTS[1].width, VIEWPORTS[1].height);

    const context = await browser.newContext({ viewport: VIEWPORTS[0] });
    await context.clearCookies();
    const page = await context.newPage();
    // Disable motion so screenshots are deterministic (steps render inert
    // under prefers-reduced-motion instead of mid-transition/mid-stagger).
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // preview has no live /api/address-suggest (nor /api/measure), so those
    // two fetches will fail/404 -- track console/page errors so a
    // regression that surfaces as a thrown JS error (rather than being
    // silently swallowed, as the relevant catch blocks are supposed to do)
    // actually fails the run. The browser itself always logs a
    // "Failed to load resource: 404" console error for a failed network
    // request regardless of whether application code handled it --
    // expected noise for exactly those two known-absent-in-preview
    // endpoints, so it's filtered out ONLY for them (verified via
    // msg.location().url, not the message text, so it can't accidentally
    // swallow a "Failed to load resource" for anything else, e.g. a real
    // asset 404 that would be a genuine bug).
    const KNOWN_ABSENT_PREVIEW_APIS = ['/api/address-suggest', '/api/measure'];
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      const failedResourceUrl = /Failed to load resource/.test(text) ? msg.location()?.url ?? '' : '';
      const isKnownAbsentApi404 = KNOWN_ABSENT_PREVIEW_APIS.some((p) => failedResourceUrl.includes(p));
      if (isKnownAbsentApi404) return;
      consoleErrors.push(text);
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(`${BASE_URL}/build`);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`${BASE_URL}/build`);

    // --- Mobile pass: drive the happy path, screenshotting on arrival ---
    console.log('\nMobile pass (390x844): walking the happy path...');

    await waitForStep(page, 'home');
    await assertColdLoadTop(page, '390 mobile pass: bare /build cold load');
    await assertNoPriceHero(page, '390 home (address entry)');
    await page.getByLabel('Property address').fill('123 Palm Ave, Tampa, FL 33602');
    // Debounce (250ms) + a failed fetch round-trip to a domain with no live
    // suggest API -- give it time to settle before asserting the dropdown
    // never appeared, then screenshot the home step with the address
    // filled in and the plain-input degrade path confirmed.
    await page.waitForTimeout(600);
    await assertNoAddressDropdownError(page, '390 home (address entry)');
    assertNoConsoleErrors(consoleErrors, '390 home (address entry)');
    await screenshotStep(page, STEPS[0], 390);
    await page.getByRole('button', { name: 'Build My Roof' }).click();

    // Still the SAME step (home) -- address absorbed it, no route change.
    await assertNoPriceHero(page, '390 home (measuring)');
    await assertAddressChip(page, '390 home (measuring)', '123 Palm Ave, Tampa, FL 33602');
    await assertNoMeasurementErrorUI(page, '390 home (measuring)');
    await page.getByLabel('Home footprint (sq ft)').fill('2000');
    await page.getByText("Got it. We've sized your roof.").waitFor();
    await page.waitForTimeout(BUTTON_TRANSITION_SETTLE_MS);
    await screenshotStep(page, STEPS[0], 390, '-measured');
    await page.getByRole('button', { name: 'Use this footprint' }).click();

    // Confirming/using the footprint must not navigate -- the solar
    // question appears below, still on Home.
    await page.getByText('Do you have solar panels on your roof?').waitFor({ timeout: 2000 });
    await assertStillOnStep(page, 'home', '390 home: committing the footprint');
    await page.getByRole('button', { name: 'No solar panels' }).click();
    await page.waitForTimeout(BUTTON_TRANSITION_SETTLE_MS);
    await screenshotStep(page, STEPS[0], 390, '-solar');
    await page.getByRole('button', { name: 'Continue' }).click();

    await waitForStep(page, 'shingle');
    await assertAddressChip(page, '390 shingle', '123 Palm Ave, Tampa, FL 33602');
    await screenshotStep(page, STEPS[1], 390);
    const titanCard = page.getByText('TAMKO Titan XT');
    await titanCard.click();
    // Selecting only selects: highlight + price update, no navigation.
    await titanCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(BUTTON_TRANSITION_SETTLE_MS);
    await screenshotStep(page, STEPS[1], 390, '-selected');
    await assertStillOnStep(page, 'shingle', '390 shingle: card selection');
    await page.getByRole('button', { name: 'Continue' }).click();

    await waitForStep(page, 'appearance');
    await assertColorSwatchGrid(page, '390 appearance');
    await screenshotStep(page, STEPS[2], 390);
    await page.getByRole('button', { name: 'Rustic Black', exact: true }).click();
    await assertColorDescription(page, '390 appearance', 'Rustic Black');
    await assertStillOnStep(page, 'appearance', '390 appearance: swatch selection');
    await page.getByRole('button', { name: 'Black', exact: true }).click();
    await assertStillOnStep(page, 'appearance', '390 appearance: drip edge selection');
    await page.getByRole('button', { name: 'Continue' }).click();

    await waitForStep(page, 'included');
    await screenshotStep(page, STEPS[3], 390);
    await page.getByRole('button', { name: 'Why not synthetic?' }).click();
    await page.getByText(/self-adhered directly to your decking/i).waitFor({ timeout: 2000 });
    await assertStillOnStep(page, 'included', '390 included: why-not-synthetic expand');
    await page.getByRole('button', { name: 'Continue' }).click();

    await waitForStep(page, 'review');
    await screenshotStep(page, STEPS[4], 390);
    await assertReviewPrice(page, '390 mobile');

    // --- Desktop pass: state + progress already earned from the mobile
    //     pass, but each step gets a genuine FRESH page load (not a warm
    //     in-document hash swap): a cache-busting query param forces the
    //     browser to treat every navigation as a distinct URL, so it does
    //     a real document reload/JS re-execution rather than the browser's
    //     same-document "scroll to fragment" shortcut. ---
    console.log('\nDesktop pass (1280x800): fresh full page load per step...');
    await page.setViewportSize(VIEWPORTS[1]);
    for (const step of STEPS) {
      await page.goto(`${BASE_URL}/build?cb=${Date.now()}-${step.id}#${step.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForStep(page, step.id);
      if (step.id === 'home') {
        await assertColdLoadTop(page, '1280 desktop pass: fresh #home load');
        // Address/sq/solar already earned -- home renders its resolved
        // summary (manual form's leak guard: blank, not prefilled) plus
        // the already-answered solar question, not the entry form. Its
        // own fetch/degrade effects still fire on mount; let them settle
        // before screenshotting so the capture is deterministic.
        await page.waitForTimeout(600);
        await assertNoAddressDropdownError(page, '1280 home');
        assertNoConsoleErrors(consoleErrors, '1280 home');
      }
      await assertAddressChip(page, `1280 ${step.id}`, '123 Palm Ave, Tampa, FL 33602');
      await screenshotStep(page, step, 1280);
    }
    await assertReviewPrice(page, '1280 desktop (fresh loads)');

    // --- Step rail navigation: earned steps are directly clickable from
    //     the desktop rail, not just reachable via URL hash. Jump back to
    //     an earlier earned step and forward again. ---
    console.log('\nStep rail (1280x800): earned steps are directly clickable...');
    await page.getByRole('button', { name: 'Go to Shingle step' }).click();
    await waitForStep(page, 'shingle');
    await page.getByRole('button', { name: 'Go to Review step' }).click();
    await waitForStep(page, 'review');
    console.log('  [rail] earned-step click navigation verified (Review -> Shingle -> Review)');

    // --- Post-acceptance demo flow: continue on the same 1280x800 page,
    //     which is already sitting on /build#review. Walking partner -> info
    //     -> schedule -> confirmation, screenshotting each step on arrival. ---
    console.log("\nPost-acceptance flow (1280x800): I'm Ready -> partner -> info -> schedule -> confirmation...");
    await page.getByRole('button', { name: "I'm Ready to Move Forward" }).click();

    await waitForNextStep(page, 'partner');
    await screenshotNamed(page, 'next-partner', 1280);
    await page.locator('[data-testid="partner-doc-1"]').scrollIntoViewIfNeeded();
    await screenshotNamed(page, 'next-partner-docs', 1280);
    await page.getByRole('button', { name: 'Continue My Project' }).click();

    await waitForNextStep(page, 'info');
    await screenshotNamed(page, 'next-info', 1280);
    await page.locator('#info-name').fill('Jamie Homeowner');
    await page.locator('#info-phone').fill('8135550100');
    await page.locator('#info-email').fill('jamie@example.com');
    await page.locator('#info-billing').fill('789 Bay St, Tampa, FL');
    await page.selectOption('#info-method', 'Phone');
    await page.getByRole('button', { name: 'Continue' }).click();

    await waitForNextStep(page, 'schedule');
    await screenshotNamed(page, 'next-schedule', 1280);
    const visitDateISO = isoDatePlusDays(7);
    await page.locator('#visit-date').fill(visitDateISO);
    await page.getByText('Morning', { exact: true }).click();
    await page.getByRole('button', { name: 'Schedule My Visit' }).click();

    await waitForNextStep(page, 'confirm');
    await screenshotNamed(page, 'next-confirm', 1280);
    const expectedVisitDateText = formatVisitDateJS(visitDateISO);
    await assertConfirmation(page, '1280 confirmation', expectedVisitDateText);

    // --- 390 pass over /next: state (contact, visit, accepted) is already
    //     earned in localStorage, so each step gets a genuine fresh page
    //     load, same cache-busting technique as the /build desktop pass. ---
    console.log('\n/next 390x844 pass: fresh full page load per step...');
    await page.setViewportSize(VIEWPORTS[0]);
    for (const id of NEXT_STEPS) {
      await page.goto(`${BASE_URL}/next?cb=${Date.now()}-${id}#${id}`, { waitUntil: 'domcontentloaded' });
      await waitForNextStep(page, id);
      await screenshotNamed(page, `next-${id}`, 390);
      if (id === 'partner') {
        await page.locator('[data-testid="partner-doc-1"]').scrollIntoViewIfNeeded();
        await screenshotNamed(page, 'next-partner-docs', 390);
      }
    }
    await assertConfirmation(page, '390 confirmation (fresh load)', expectedVisitDateText);

    // --- Start over: a completed quote's confirmation page can reset
    //     straight away, no confirm step (the quote is already done).
    //     Lands back on a pristine /build#home: empty input, no price. ---
    console.log('\nStart over (390x844): START A NEW QUOTE from confirmation...');
    await page.getByRole('button', { name: 'Start a New Quote' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Start a New Quote' }).click();
    await waitForStep(page, 'home');

    const addressValueAfterReset = await page.getByLabel('Property address').inputValue();
    if (addressValueAfterReset !== '') {
      fail(`[start-over] expected an empty address input after Start a New Quote, got "${addressValueAfterReset}"`);
    }
    await assertNoPriceHero(page, 'start-over: back at home step');
    console.log('  [start-over] confirmed: back at home step (address entry), empty input, no price hero');

    // --- Landing + About: fresh contexts (no earned config), both widths ---
    console.log('\nLanding + About: fresh-context address prefill and screenshots...');
    await checkLandingAndAbout(browser, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await checkLandingAndAbout(browser, VIEWPORTS[1].width, VIEWPORTS[1].height);

    // --- Metal & Tile education page: fresh contexts, both widths, plus the
    //     Lightbox open/close + scroll-lock check on the 1280 pass ---
    console.log('\nMetal & Tile: /metal screenshots + Lightbox open/close check...');
    await checkMetal(browser, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await checkMetal(browser, VIEWPORTS[1].width, VIEWPORTS[1].height);

    // --- Satellite confirm card (amber accuracy notice + "Adjust outline"):
    //     fresh contexts with /api/measure mocked, both widths -- otherwise
    //     unreachable in preview, which has no live measure API. ---
    console.log('\nSatellite confirm card: amber notice + Adjust outline (mocked /api/measure)...');
    await checkSatelliteConfirmAmberNotice(browser, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await checkSatelliteConfirmAmberNotice(browser, VIEWPORTS[1].width, VIEWPORTS[1].height);

    // --- Drive a real drag on the adjust-outline editor and prove the
    //     confirm card's overlay actually changes, and that applying it
    //     does not navigate away from Home. ---
    console.log('\nAdjusted roof outline: real pointer drag, confirm card overlay changes...');
    await checkAdjustedOutlineOverlay(browser, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await checkAdjustedOutlineOverlay(browser, VIEWPORTS[1].width, VIEWPORTS[1].height);

    // --- The no-solar-data trace flow replaces the old manual dead-end
    //     whenever there's imagery to trace from. ---
    console.log('\nTrace mode: no-solar-data response with imagery (mocked /api/measure)...');
    await checkTraceMode(browser, VIEWPORTS[0].width, VIEWPORTS[0].height);
    await checkTraceMode(browser, VIEWPORTS[1].width, VIEWPORTS[1].height);

    await browser.close();
    console.log('\nAll assertions passed. Walkthrough complete.');
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
