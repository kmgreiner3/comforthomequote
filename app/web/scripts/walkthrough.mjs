#!/usr/bin/env node
// Playwright walkthrough for the configurator wizard (Task 4 verification).
//
// Builds `app/web`, serves the built `dist/` with `vite preview`, then drives
// the happy path end to end:
//   123 Palm Ave, Tampa, FL -> 2000 sq ft -> Titan XT -> Rustic Black
//   -> peel & stick -> protection continue -> included continue
//   -> drip edge Black -> review
//
// Asserts the review page shows $14,400 and $144/month (fails loudly
// otherwise) and screenshots every step at 390x844 and 1280x800 into
// .superpowers/sdd/screens/.
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

const STEPS = [
  { n: 1, id: 'address' },
  { n: 2, id: 'home' },
  { n: 3, id: 'shingle' },
  { n: 4, id: 'color' },
  { n: 5, id: 'underlayment' },
  { n: 6, id: 'protection' },
  { n: 7, id: 'included' },
  { n: 8, id: 'finishing' },
  { n: 9, id: 'review' },
];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

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

async function screenshotStep(page, step, width) {
  const file = path.join(SCREENS_DIR, `step-${step.n}-${step.id}-${width}.png`);
  await page.screenshot({ path: file });
  console.log(`  screenshot: ${path.relative(REPO_ROOT, file)}`);
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
    const context = await browser.newContext({ viewport: VIEWPORTS[0] });
    await context.clearCookies();
    const page = await context.newPage();
    // Disable motion so screenshots are deterministic (steps render inert
    // under prefers-reduced-motion instead of mid-transition/mid-stagger).
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto(`${BASE_URL}/build`);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`${BASE_URL}/build`);

    // --- Mobile pass: drive the happy path, screenshotting on arrival ---
    console.log('\nMobile pass (390x844): walking the happy path...');

    await waitForStep(page, 'address');
    await screenshotStep(page, STEPS[0], 390);
    await page.getByLabel('Property address').fill('123 Palm Ave, Tampa, FL');
    await page.getByRole('button', { name: 'Build My Roof' }).click();

    await waitForStep(page, 'home');
    await page.getByLabel('Home footprint (sq ft)').fill('2000');
    await page.getByText("Got it. We've sized your roof.").waitFor();
    // Screenshot after the "Got it" confirmation appears, not the empty
    // default state, so the no-per-SQ confirmation moment is verifiable.
    await screenshotStep(page, STEPS[1], 390);
    await page.getByRole('button', { name: 'Continue' }).click();

    await waitForStep(page, 'shingle');
    await screenshotStep(page, STEPS[2], 390);
    await page.getByText('TAMKO Titan XT').click();
    await waitForStep(page, 'color');

    await screenshotStep(page, STEPS[3], 390);
    await page.getByRole('button', { name: 'Rustic Black', exact: true }).click();
    await waitForStep(page, 'underlayment');

    await screenshotStep(page, STEPS[4], 390);
    await page.getByText('Full Peel & Stick').click();
    await waitForStep(page, 'protection');

    await screenshotStep(page, STEPS[5], 390);
    await page.getByRole('button', { name: 'Continue' }).click();
    await waitForStep(page, 'included');

    await screenshotStep(page, STEPS[6], 390);
    await page.getByRole('button', { name: 'Continue' }).click();
    await waitForStep(page, 'finishing');

    await screenshotStep(page, STEPS[7], 390);
    await page.getByRole('button', { name: 'Black', exact: true }).click();
    await waitForStep(page, 'review');

    await screenshotStep(page, STEPS[8], 390);
    await assertReviewPrice(page, '390 mobile');

    // --- Desktop pass: state + progress already earned, just revisit each
    //     hash directly for a clean full-size screenshot of every step ---
    console.log('\nDesktop pass (1280x800): revisiting every step...');
    await page.setViewportSize(VIEWPORTS[1]);
    for (const step of STEPS) {
      await page.evaluate((hash) => {
        window.location.hash = `#${hash}`;
      }, step.id);
      await waitForStep(page, step.id);
      await screenshotStep(page, step, 1280);
    }
    await assertReviewPrice(page, '1280 desktop');

    await browser.close();
    console.log('\nAll assertions passed. Walkthrough complete.');
  } finally {
    server.kill();
  }
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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
