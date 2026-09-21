# PoE2 Build → Trade MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chromium MV3 extension that adds a 🔍 button to every equipment item on
maxroll PoE2 build guides and opens a matching search on the official trade2 site.

**Architecture:** A WXT project with three entrypoints:
- an isolated-world content script for buttons and the popup
- a MAIN-world item reader that pulls paperdoll items from React props
- a background service worker that fetches data and translates items into a model

Everything under `src/core` is pure TypeScript and unit-tested with Vitest against
real captured fixtures. `scripts/build-data.ts` generates the stat and base maps from
RePoE and the trade data API.

**Tech Stack:** WXT 0.21.x, TypeScript, Vitest 5, Playwright 1.63 (manual E2E), and
Node 22. The UI is plain DOM with no framework.

**Spec:** `docs/superpowers/specs/2026-09-21-poe2-build-trade-design.md`

**Execution note:** the user asked for an end-to-end MVP in this session. Tasks give
exact files, interfaces, and test cases. Implementation code is written test-first
during execution instead of being duplicated here.

## Global Constraints

- Chromium MV3 only. Permissions: `storage`. Host permissions:
  `https://planners.maxroll.gg/*` and `https://www.pathofexile.com/api/trade2/data/*`,
  plus GitHub hosts only when `GITHUB_REPO` is set.
- Content scripts match `https://maxroll.gg/poe2/*` only.
- Do not request `tabs`, `<all_urls>`, `scripting`, or `alarms`.
- The extension never calls `/api/trade2/search`. It only opens URLs.
- The trade URL is `https://www.pathofexile.com/trade2/search/poe2/{encodeURIComponent(league)}/{base64url(gzip(JSON(query)))}`
  with no base64 padding.
- The payload is the inner query object (`status`, `stats`, and optionally `name`,
  `type`, `filters`), not `{query, sort}`.
- The default min percentage is 80. The default status is `available`.
- UI strings go through `browser.i18n` with `en` and `th` locales. Mod text stays in
  English.
- The name and icon contain no "Path of Exile" or "Maxroll" branding. The README has
  the non-affiliation disclaimer.
- All console output uses the `[b2t]` prefix.
- No mock data. Fixtures are real captured API responses.

## File Map

| File | Responsibility |
|---|---|
| `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts` | Tooling |
| `src/config.ts` | `GITHUB_REPO`, derived URLs, defaults |
| `src/core/types.ts` | Shared types |
| `src/core/encode.ts` | Query to URL, and URL to query (tests) |
| `src/core/categories.ts` | item_class to trade category |
| `src/core/statmap.ts` | Index a StatMap by game stat id |
| `src/core/translate.ts` | PlannerItem to ItemModel |
| `src/core/query.ts` | Default selections, and ItemModel + selection to TradeQuery |
| `src/core/settings.ts` | Settings type, defaults, and a `storage.local` wrapper |
| `src/core/messages.ts` | Background message request/response types |
| `scripts/lib/build-data-lib.ts` | Pure map builders and coverage |
| `scripts/build-data.ts` | CLI: fetch sources, write `data/*.json`, `--check` gate |
| `data/stat-map.json`, `data/base-map.json` | Bundled snapshot |
| `src/adapters/fiber.ts` | Pure `findItemInFiber` |
| `src/adapters/maxroll.ts` | Target discovery, button injection, item retrieval |
| `entrypoints/item-reader.content.ts` | MAIN-world bridge |
| `entrypoints/background.ts` | Planner fetch, model translation, leagues, data refresh, release check |
| `src/ui/popup.ts`, `src/ui/popup.css` | Mod picker in a Shadow DOM |
| `src/ui/toast.ts` | Inline error toast with Retry |
| `entrypoints/maxroll.content.ts` | Wiring |
| `entrypoints/options/index.html`, `main.ts` | Options page |
| `public/_locales/{en,th}/messages.json` | i18n |
| `public/icon/*.png` | Icons |
| `tests/fixtures/*` | Real captured data |
| `e2e/smoke.mjs` | Manual headed E2E |
| `.github/workflows/{ci,data,release}.yml` | CI, data refresh, releases |
| `README.md` | Install, privacy, disclaimer, smoke checklist |

---

### Task 1: Scaffold + fixtures

**Files:** create `package.json`, `wxt.config.ts`, `tsconfig.json`,
`vitest.config.ts`, `.gitignore`, `src/config.ts`, `tests/fixtures/`

- [ ] `package.json` scripts:
  - `dev`: `wxt`
  - `build`: `wxt build`
  - `zip`: `wxt zip`
  - `postinstall`: `wxt prepare`
  - `typecheck`: `tsc --noEmit`
  - `test`: `vitest run`
  - `build-data`: `node --experimental-strip-types scripts/build-data.ts`
  - devDependencies: `wxt@0.21.4`, `typescript`, `vitest@5`, `@types/node`
- [ ] `wxt.config.ts`:
  - `manifest.name` = `__MSG_extName__`, `default_locale: 'en'`, permissions and host
    permissions per Global Constraints
  - GitHub hosts are added only when `GITHUB_REPO` is non-empty
- [ ] `src/config.ts`:
  - `export const GITHUB_REPO = ''` (format `owner/repo`)
  - `dataBaseUrl()`, which returns `https://{owner}.github.io/{repo}/data` or `null`
  - `releasesApiUrl()`, which returns a URL or `null`
- [ ] Capture fixtures from the real endpoints into `tests/fixtures/`:
  - `planner-z7coxn0y.json`
  - `trade-stats.json`
  - `trade-leagues.json`
  - `stat-descriptions.subset.json` (RePoE entries whose ids appear in the fixture
    build, plus every entry that has `trade_stats` for those ids)
  - `base-items.subset.json` (bases used by the fixture build)
- [ ] Verify: `npm install && npx wxt prepare && npm run typecheck` exits 0.
- [ ] Commit `chore: scaffold WXT project and capture fixtures`.

### Task 2: `core/encode`

**Interfaces (produces):**
```ts
export async function encodeQuery(q: TradeQuery): Promise<string>;   // base64url(gzip(json)), no padding
export async function decodeQuery(payload: string): Promise<unknown>;
export async function tradeUrl(league: string, q: TradeQuery): Promise<string>;
```
Use `CompressionStream('gzip')` and `DecompressionStream('gzip')`. These exist in
both Node 22 and browsers.

**Tests (`tests/encode.test.ts`):**
- Decoding the user's example payload
  `H4sIAAAAAAAAE6tWKi5JLCktVrKqVsovKMnMz1OyUkosS8zMSUzKSVWq1QHLFytZRVcrlVQWpIJk81KUdJTSMnNKUotAErG1sbUA2ikBQEcAAAA`
  equals `{"status":{"option":"available"},"stats":[{"type":"and","filters":[]}]}`.
- A round trip of the spike query (count group, category, rarity, rune_sockets)
  returns the same object.
- The encoded string matches `/^[A-Za-z0-9_-]+$/` (no padding, `+`, or `/`).
- `tradeUrl('Runes of Aldur', q)` starts with
  `https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/`.

Follow the TDD loop: write the tests, run and see them fail, implement, run and see
them pass, then commit `feat(core): trade query URL encoding`.

### Task 3: build-data (maps + coverage gate)

**Interfaces (produces), `scripts/lib/build-data-lib.ts`:**
```ts
export function normalizeTemplate(s: string): string;
//   "[Spirit|Spirit]"→"Spirit", "[Spell]"→"Spell", "{0}"/"{1}"→"#"
export function buildStatMap(translations: RepoeTranslation[], tradeStats: TradeStatsResponse, generatedAt: string): StatMap;
export function buildBaseMap(baseItems: Record<string, RepoeBase>): BaseMap;  // only classes in CATEGORY_BY_CLASS
export function coverage(items: PlannerItem[], statMap: StatMap): { mapped: number; total: number; ratio: number; misses: string[] };
```

`StatMapEntry`:
- `{ ids, text, negText?, trade }`
- `text` is the display template for positive values: the first English variant whose
  condition allows positive values, with `{i}` replaced by `format[i]` (for example
  `+# to maximum Life` or `#% increased Spell Damage`)
- `negText` comes from the variant with a `negate` handler, for example
  `#% reduced Cast Speed`

Resolving trade ids:
1. Use `trade_stats` first. Keep only ids whose prefix is one of the six StatKinds.
2. Otherwise, text-match against trade stats of the same kind: normalized text,
   case-insensitive, trying the variants `s`, `+`-stripped, and `+`-prefixed.
3. For ids starting with `local_`, try `s + " (Local)"` first.

**CLI (`scripts/build-data.ts`):**
- Fetches RePoE `stat_translations/stat_descriptions.min.json`, RePoE
  `base_items.min.json`, and trade `/api/trade2/data/stats`. Sends the header
  `User-Agent: poe2-build-trade/<version> (+github)`.
- Writes `data/stat-map.json` and `data/base-map.json` as minified JSON. `--out <dir>`
  overrides the output directory.
- Always prints coverage for `tests/fixtures/planner-z7coxn0y.json`.
- With `--check`, exits 1 if coverage is below 0.95.

**Tests (`tests/build-data.test.ts`), using the subset fixtures:**
- `normalizeTemplate('{0} to [Spirit|Spirit]') === '# to Spirit'`.
- The `base_maximum_life` entry has trade
  `explicit === 'explicit.stat_3299347043'` and text `+# to maximum Life`.
- `spell_damage_+%` maps by text to `explicit.stat_2974417149`.
- `base_cast_speed_+%` has a `negText` containing `reduced Cast Speed`.
- `buildBaseMap` maps `Metadata/Items/Weapons/OneHandWeapons/Wands/FourWand3` to
  `{name:'Attuned Wand', itemClass:'Wand'}`.
- Coverage over the fixture build is at least 0.95.

After the tests pass, run `npm run build-data -- --check` against the live sources.
Expect coverage ≥ 0.95. Commit the generated `data/*.json`.

Commit `feat(data): stat/base map builder with coverage gate`.

### Task 4: `core/categories`, `core/statmap`, `core/translate`

**Interfaces:**
```ts
// categories.ts
export const CATEGORY_BY_CLASS: Record<string, string>;
export function categoryFor(itemClass: string | null): string | null;
// statmap.ts
export type StatIndex = Map<string, StatMapEntry>;           // game stat id → entry (first wins)
export function indexStatMap(m: StatMap): StatIndex;
// translate.ts
export function toItemModel(item: PlannerItem, stats: StatIndex, bases: BaseMap): ItemModel;
```

`CATEGORY_BY_CLASS` covers: Claw, Dagger, One Hand Sword, One Hand Axe, One Hand
Mace, Spear, Flail, Two Hand Sword, Two Hand Axe, Two Hand Mace, Warstaff, Talisman,
Bow, Crossbow, Wand, Sceptre, Staff, Helmet, Body Armour (`armour.chest`), Gloves,
Boots, Quiver, Shield, Focus, Buckler, Amulet, Belt, Ring, Jewel, LifeFlask
(`flask.life`), ManaFlask (`flask.mana`), and UtilityFlask (`flask.charm`).

`ModRow`:
- `{ kind, text, value, tradeId }`
- `text` is the display template with each `#` filled in order by the component values.
  A negative value uses `negText` and the absolute values.
- `value` is the mean of the component values. It is used for trade.
- `tradeId` is `entry.trade[kind] ?? null`.
- Stats with no entry get `text` = the raw game stat id and `tradeId` = `null`.
- Components of a multi-id entry are grouped once per kind.
- Kind order in `mods`: explicit, fractured, crafted, implicit, enchant, rune.

**Tests (`tests/translate.test.ts`), using real fixture items and the real bundled
`data/*.json`:**
- Item 32 (wand): baseName `Attuned Wand`, category `weapon.wand`, and 3 explicit
  rows. The row with `tradeId === 'explicit.stat_2974417149'` has value 64 and text
  `64% increased Spell Damage`. The rune row has kind `rune`.
- Item 178 (amulet): the enchant row for `mod_granted_passive_hash` has
  `tradeId === null`.
- Item 316 (Mageblood): rarity `unique`, name `Mageblood`, baseName `Utility Belt`.
- Any fixture item with `attack_minimum_added_physical_damage` gives exactly one row
  for the min/max pair, whose value is the mean. If no fixture item has it, the test
  builds a PlannerItem by cloning fixture item 32 and replacing its explicit stats
  with `{attack_minimum_added_physical_damage: 5, attack_maximum_added_physical_damage: 10}`,
  and expects value 7.5 and text containing `5` and `10`.

Commit `feat(core): translate planner items to ItemModel`.

### Task 5: `core/query`

**Interfaces:**
```ts
export interface RowState { row: ModRow; checked: boolean; min: number | null; max: number | null }
export function defaultRowStates(model: ItemModel, minPct: number): RowState[];
export function buildQuery(model: ItemModel, sel: SearchSelection): TradeQuery;   // rare/magic
export function buildDirectQuery(model: ItemModel, status: TradeStatus): TradeQuery; // unique/normal
```

Default rules:
- A row is checked when `kind === 'explicit' && tradeId !== null`.
- If `|value| <= 5`, the bound is the exact rounded value.
- Otherwise, a positive value gets `min = floor(value × minPct)`, and a negative value
  gets `max = ceil(value × minPct)`.

`buildQuery`:
- `stats: [{type:'and', filters}]`, or `{type:'count', value:{min:N}, filters}`
- A filter is `{id, value:{min?,max?}}`, and bounds that are `null` are omitted.
- Base mode `category`, when a category exists, sets
  `filters.type_filters.filters.category.option`. Otherwise it sets
  `type = baseName`.
- Rarity `nonunique` is always set.
- `runeSockets` sets `filters.equipment_filters.filters.rune_sockets.min`.

`buildDirectQuery`:
- Unique: `{status, name, type: baseName, stats:[{type:'and',filters:[]}]}`
- Normal: `{status, type: baseName, stats:[{type:'and',filters:[]}]}`

**Tests (`tests/query.test.ts`):** built from real fixture items through
`toItemModel`:
- Wand defaults: 3 explicit rows are checked with min 51 for Spell Damage (64 × 0.8
  floored), min 2 for +2 levels (exact, because ≤ 5), and min 11 for Cast Speed; the
  rune row is unchecked.
- `buildQuery` in category mode produces exactly the spike JSON shape (category
  `weapon.wand`, rarity `nonunique`, and an `and` group with 3 filters).
- Exact mode sets `type: 'Attuned Wand'` and has no category.
- `count` with N = 2 produces `{type:'count', value:{min:2}}`.
- A negative value of -20 produces `max: -16` and no `min`.
- Mageblood's direct query equals
  `{status:{option:'available'},name:'Mageblood',type:'Utility Belt',stats:[{type:'and',filters:[]}]}`.

Commit `feat(core): trade query builder`.

### Task 6: Settings, messages, background

**Interfaces:**
```ts
// settings.ts
export type TradeStatus = 'online' | 'available' | 'any';
export interface Settings { league: string | null; minPct: number; status: TradeStatus }
export const DEFAULT_SETTINGS: Settings; // { league: null, minPct: 0.8, status: 'available' }
export async function getSettings(): Promise<Settings>;
export async function saveSettings(p: Partial<Settings>): Promise<void>;
export function pickDefaultLeague(leagues: {id: string; text: string}[]): string | null;
//  first id not matching /^(HC |Hardcore|Standard|SSF)/ and not containing "SSF";
//  falls back to 'Standard'

// messages.ts
export type Request =
  | { type: 'plannerItem'; profileId: string; itemId: string }
  | { type: 'toModel'; item: PlannerItem }
  | { type: 'context' };
export type Response<T> = { ok: true; data: T } | { ok: false; error: 'network' | 'format' | 'notFound' };
export interface Context { league: string; leagueChanged: boolean; update: { version: string; url: string } | null; dataGeneratedAt: string }
export function sendMessage<T>(req: Request): Promise<Response<T>>;
export function isPlannerItem(x: unknown): x is PlannerItem; // validates base, rarity, stats object
```

Background behaviour:
- **Planner:** fetches `https://planners.maxroll.gg/profiles/poe2/{profileId}`, then
  `JSON.parse(data)`, then `items[itemId]`, and validates it with `isPlannerItem`.
  Caches the parsed `items` in `storage.session` under the key
  `planner:{profileId}`.
- **Maps:** loads the bundled `data/*.json` through `import`. If `dataBaseUrl()` is set
  and the cached remote copy is older than 24h, it fetches `stat-map.json` and
  `base-map.json`, validates `entries` as an array, and stores them in
  `storage.local` under `remoteMaps`. It uses the newer `generatedAt` of the bundled
  and remote copies.
- **Context:**
  - Leagues are cached for 24h in `storage.local` under `leagues`.
  - If the saved league is null, the extension uses `pickDefaultLeague`.
  - If the saved league is missing from the fetched list, it falls back to
    `pickDefaultLeague` and sets `leagueChanged: true`.
  - If leagues cannot be fetched, it uses the saved league, or `Standard`.
  - The update field comes from `releasesApiUrl()` (cached for 24h), comparing
    `tag_name` without the leading `v` against `browser.runtime.getManifest().version`
    with a semver compare.

**Tests (`tests/settings.test.ts`):** runs `pickDefaultLeague` on
`tests/fixtures/trade-leagues.json` and expects `'Forbidden Rites'`. A second case
filters that fixture down to Standard/Hardcore only and expects `'Standard'`.
`isPlannerItem` accepts fixture item 32 and rejects `{}` and `{base:1}`.

Verify: `npm run typecheck && npm test`. Commit `feat: background data services`.

### Task 7: Maxroll adapter + MAIN-world item reader

**Interfaces:**
```ts
// adapters/fiber.ts
export function findItemInFiber(el: object, maxDepth?: number): PlannerItem | null;
//  finds the own key starting with "__reactFiber$", walks .return up to maxDepth (6),
//  returns the first memoizedProps.item that passes isPlannerItem

// adapters/maxroll.ts
export type Target =
  | { kind: 'slot'; el: HTMLElement }
  | { kind: 'inline'; el: HTMLElement; profileId: string; itemId: string };
export function findTargets(root: ParentNode): Target[];
//  slots: .poe2-PaperdollSlot having a class /^poe2-item-(normal|magic|rare|unique)$/
//  inline: span.poe2-item[data-poe2-profile] whose data-poe2-id is /^\d+$/
//  skips elements already marked data-b2t-injected
export function readSlotItem(el: HTMLElement, timeoutMs?: number): Promise<PlannerItem | null>;
//  sets data-b2t-key (random), dispatches 'b2t:read-item' (detail = key),
//  awaits 'b2t:item' whose JSON detail has the same key; resolves null on timeout (1500 ms)
export function getItem(t: Target): Promise<Response<PlannerItem>>;
```

`entrypoints/item-reader.content.ts` uses `world: 'MAIN'` and
`matches: ['https://maxroll.gg/poe2/*']`. It listens for `b2t:read-item`, calls
`findItemInFiber`, and dispatches `b2t:item` with
`JSON.stringify({key, item})`.

**Tests (`tests/fiber.test.ts`):** build a real fixture item and wrap it in a
fiber-shaped chain,
`{ ['__reactFiber$x']: { memoizedProps: {}, return: { memoizedProps: {}, return: { memoizedProps: { item } } } } }`.
Expect the item to be found at depth 2, `null` when `maxDepth` is 1, and `null` when
the item fails validation.

Commit `feat(adapter): maxroll targets and paperdoll item reader`.

### Task 8: Popup, toast, content wiring, i18n

**Interfaces:**
```ts
// ui/popup.ts
export function openPopup(opts: {
  anchor: HTMLElement; model: ItemModel; settings: Settings; context: Context;
  onSearch: (sel: SearchSelection) => void;
}): void;             // single instance; Esc/outside click closes; Shadow DOM host id "b2t-popup"
export function closePopup(): void;
// ui/toast.ts
export function showToast(anchor: HTMLElement, message: string, retry?: () => void): void;
```

Content script `entrypoints/maxroll.content.ts`:
1. Runs `inject(document)` and watches `document.body` with a debounced (200 ms)
   `MutationObserver`.
2. Each target gets a `<button class="b2t-btn" data-b2t-injected>` with the text 🔍
   and the title `__MSG_searchOnTrade__`.
   - Slot buttons are absolutely positioned at the top-right. If the slot is
     `position: static`, the script sets `position: relative`.
   - Inline buttons are inserted after the span.
   - The button stops `click`, `mousedown`, `pointerdown`, and `mouseup` propagation.
3. On click, the script:
   1. calls `getItem`
   2. sends `toModel` and `context`
   3. searches directly for unique and normal items with
      `window.open(await tradeUrl(ctx.league, buildDirectQuery(...)), '_blank', 'noopener')`
   4. otherwise calls `openPopup`, whose `onSearch` builds the query and opens the
      same URL
4. On error, it shows a toast: `network` gives loadError with Retry, `format` gives
   formatChanged, and a null slot read gives readError.

Popup rows and controls:
- **Header:** `{Rarity} · {baseName}` and a close ✕.
- **Base radio:** "Any {class}" and the base name. The first option is hidden when the
  category is null.
- **Explicit section**, then an **Other** section (implicit, enchant, rune, crafted,
  fractured).
- **Each row:** a checkbox, the text, and a number input (min, or max when the value
  is negative). Rows with `tradeId === null` are disabled and labelled
  `__MSG_notOnTrade__`.
- **Match select:** "All" or "At least N", with a number input from 1 to the checked
  count. N defaults to the checked count minus 1, with a minimum of 1.
- **Rune sockets checkbox:** shown only when `sockets > 0`. It reads
  "Rune sockets ≥ {n}".
- **Banners:** `update` shows updateAvailable with a link, and `leagueChanged` shows a
  leagueChanged notice.
- **Search button.**

Locales `public/_locales/{en,th}/messages.json` contain these keys:
- extension: `extName`, `extDescription`
- popup: `searchOnTrade`, `anyClass` (with `$1`), `exactBase`, `explicitMods`,
  `otherMods`, `notOnTrade`, `match`, `matchAll`, `matchAtLeast`, `runeSockets`
  (with `$1`)
- errors: `loadError`, `retry`, `formatChanged`, `readError`
- banners: `updateAvailable` (with `$1`), `leagueChanged` (with `$1`)
- options: `optLeague`, `optMinPct`, `optStatus`, `statusOnline`, `statusAvailable`,
  `statusAny`, `optData`, `optVersion`, `saved`

Verify:
- `npm run build` produces `.output/chrome-mv3/manifest.json` with both content
  scripts, and the item reader has `"world": "MAIN"`.
- `npm run typecheck` passes.

Commit `feat(ui): search buttons, mod picker popup, i18n`.

### Task 9: Options page + icons

- `entrypoints/options/index.html` + `main.ts`:
  - The league select is filled from `/api/trade2/data/leagues`. If that fails, a text
    input is shown instead.
  - The minPct number input accepts 50–100, shown as a percentage.
  - The status select offers online, available, and any.
  - Each field saves on change and shows "saved".
  - The page shows the data `generatedAt` (from the `context` message) and the
    manifest version.
- Icons: generate 16, 32, 48, and 128 px PNGs in `public/icon/` with ImageMagick. The
  design is a magnifier glyph on a dark rounded square, with no game branding.
- Verify: `npm run build` passes, and the manifest has `options_ui` and `icons`.
- Commit `feat: options page and icons`.

### Task 10: CI/data/release workflows + README

- `ci.yml` runs on push/PR: `npm ci`, `npm run typecheck`, `npm test`,
  `npm run build`.
- `data.yml` runs on a daily cron and on `workflow_dispatch`:
  1. `npm ci`
  2. `npm run build-data -- --check --out site/data`
  3. `actions/upload-pages-artifact@v3` with path `site`
  4. `actions/deploy-pages@v4`
  It needs the permissions `pages: write` and `id-token: write`. A failed `--check`
  stops the deploy.
- `release.yml` runs on tag `v*`: `npm ci`, `npm test`, `npm run zip`, then
  `softprops/action-gh-release@v2` with `.output/*-chrome.zip`.
- `README.md` in English with a Thai section covering:
  - what the extension does
  - install (download the zip, unzip, `chrome://extensions`, Developer mode, Load
    unpacked)
  - usage
  - options
  - privacy (no data collected; the only requests go to maxroll planner, GGG trade
    data, and GitHub)
  - the disclaimer
  - maintainer steps (set `GITHUB_REPO`, enable Pages, tag a release)
  - the release smoke checklist
- Verify: `npx --yes yaml-lint`, or parse each workflow file with Node's `yaml`
  package, and confirm all three parse.
- Commit `ci: workflows and README`.

### Task 11: Manual E2E + live verification

- `e2e/smoke.mjs` (Playwright, headed Chromium, not part of `npm test`):
  1. Launch a persistent context with `--disable-extensions-except` and
     `--load-extension` pointing at `.output/chrome-mv3`.
  2. Open the maxroll guide and scroll the `plannerEquipment` embed into view.
  3. Wait for a `.poe2-PaperdollSlot .b2t-btn`.
  4. Click the Weapon slot button and wait for the `#b2t-popup` shadow root.
  5. Click Search and capture the popup page URL.
  6. Decode the payload and assert that it has an `and` or `count` stat group with
     ≥ 1 filter, and `filters.type_filters.filters.rarity.option === 'nonunique'`.
  7. Also click an inline `span.poe2-item` button and assert a popup or new tab
     appears.
  8. Log a PASS/FAIL summary.
- Run it: `npm run build && node e2e/smoke.mjs`. Expect PASS.
- Open the URL printed by the run in the user's real Chrome through claude-in-chrome,
  then decode the page's rewritten URL and confirm the filters survived.
- Commit `test: manual headed E2E smoke script`.
