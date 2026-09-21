// Manual smoke test against the live maxroll site with the built extension loaded.
//   npm run build && npm run e2e            (headless Chromium)
//   HEADED=1 npm run e2e                    (watch it run)
// Not part of `npm test`: it depends on live sites.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const GUIDE = 'https://maxroll.gg/poe2/build-guides/grim-pillars-spell-totem-oracle-build-guide';
const TRADE_PREFIX = 'https://www.pathofexile.com/trade2/search/poe2/';
const ext = resolve('.output/chrome-mv3');
const profile = mkdtempSync(join(tmpdir(), 'b2t-e2e-'));
const results = [];

const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const decodeTradeUrl = (url) => {
  const payload = url.slice(url.lastIndexOf('/') + 1);
  return JSON.parse(gunzipSync(Buffer.from(payload, 'base64url')).toString('utf8'));
};

async function nextTradeTab(ctx, action) {
  const pagePromise = ctx.waitForEvent('page', { timeout: 20000 });
  await action();
  const tab = await pagePromise;
  await tab.waitForURL((u) => u.href.startsWith(TRADE_PREFIX), { timeout: 20000 }).catch(() => {});
  const url = tab.url();
  await tab.close();
  return url;
}

const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: !process.env.HEADED,
  viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

try {
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (m.text().includes('[b2t]')) logs.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(GUIDE, { waitUntil: 'domcontentloaded' });

  // The paperdoll embed renders lazily once scrolled into view.
  const embed = page.locator('[data-poe2-type=plannerEquipment]').first();
  await embed.scrollIntoViewIfNeeded();
  await page.waitForSelector('.poe2-PaperdollSlot .b2t-btn', { timeout: 30000 });
  const slotButtons = await page.locator('.poe2-PaperdollSlot .b2t-btn').count();
  check('buttons injected into paperdoll slots', slotButtons > 0, `${slotButtons} buttons`);

  // Rare weapon: popup, then search.
  await page.locator('.poe2-slot-Weapon .b2t-btn').click();
  await page.waitForSelector('#b2t-popup .panel', { timeout: 15000 });
  const rows = await page.locator('#b2t-popup .row').count();
  check('popup opens with mod rows', rows > 0, `${rows} rows`);
  await page.screenshot({ path: 'e2e/popup.png' });

  const rareUrl = await nextTradeTab(ctx, () => page.locator('#b2t-popup .search').click());
  const rare = rareUrl.startsWith(TRADE_PREFIX) ? decodeTradeUrl(rareUrl) : null;
  check(
    'rare search opens a trade URL with stat filters',
    !!rare && rare.stats?.[0]?.filters?.length > 0 && rare.filters?.type_filters?.filters?.rarity?.option === 'nonunique',
    rare ? JSON.stringify(rare) : rareUrl,
  );
  console.log(`      url: ${rareUrl}`);

  // Inline "New Item" span in the article text (planner API path).
  const inline = page.locator('span.poe2-item[data-poe2-profile] + .b2t-btn').first();
  if (await inline.count()) {
    await inline.scrollIntoViewIfNeeded();
    await inline.click();
    const popup = await page.waitForSelector('#b2t-popup .panel', { timeout: 15000 }).catch(() => null);
    check('inline item opens the popup', !!popup);
    await page.keyboard.press('Escape');
    check('Escape closes the popup', (await page.locator('#b2t-popup').count()) === 0);
  } else {
    check('inline item button present', false);
  }

  if (logs.length) console.log(`[b2t] console:\n  ${logs.join('\n  ')}`);
} finally {
  await ctx.close();
  rmSync(profile, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
