# PoE2 Build → Trade Extension — Design

- **Date:** 2026-09-21
- **Status:** Approved in brainstorming, pending spec review
- **Working name:** `poe2-build-trade` (display name "Build → Trade (PoE2)")

## 1. Problem

When following a Path of Exile 2 build guide on maxroll.gg, the player has to rebuild
each recommended item by hand on the official trade site
(`pathofexile.com/trade2`): pick the base or category, find every mod in the stat
dropdown, and type in minimum values. This is slow and easy to get wrong.

## 2. Goal

A browser extension that adds a search button to each equipment item on a maxroll
PoE2 build guide. Clicking it opens the official trade site in a new tab with a
search that matches the item.

### Success criteria

- Every planner equipment item on a maxroll PoE2 build guide gets a 🔍 button.
- Unique and normal items open a trade search with one click.
- Rare and magic items open a mod picker. After the user confirms, a trade search
  opens with the chosen mods and minimum values.
- At least 95% of mods on the reference build (`z7coxn0y`) map to a trade stat id.
  The measured baseline is 571/583 (97.9%).
- The mod mapping stays current after game patches without users reinstalling the
  extension.

### Non-goals (v1)

- Build sites other than maxroll (poe.ninja, mobalytics, etc.). The site adapter
  boundary keeps this possible later.
- Chrome Web Store or Firefox listing.
- Pseudo stats (for example total resistance), max-value inputs, and roll-range
  filters for uniques.
- Calling the GGG trade search API or showing prices inside the extension.
- Skill gems and passive tree nodes.
- A language switcher inside the UI.

## 3. Decisions log

| # | Decision | Reason |
|---|---|---|
| D1 | Rare and magic items open a mod-picker popup before searching | The user chooses which mods matter, as in Awakened PoE Trade |
| D2 | Maxroll is the only site in v1, behind an adapter | Keeps scope small without blocking other sites later |
| D3 | Distributed as a GitHub Release zip, installed with "Load unpacked" | Chosen by the user. No store review. |
| D4 | Chromium browsers only (Chrome, Edge, Brave, Opera) | Release Firefox cannot permanently install unsigned extensions |
| D5 | The search trigger is a small 🔍 button on each item | Easy to find and does not conflict with maxroll's own click handlers |
| D6 | The stat map is bundled as a snapshot and refreshed from GitHub Pages | Keeps mappings current after patches, which matters because unpacked installs do not auto-update |
| D7 | UI in English and Thai through `chrome.i18n` | The audience is both Thai and international players. Mod text stays in English because trade uses English. |
| D8 | Built with WXT (TypeScript + Vite) | Good developer experience and manifest generation, and keeps a Firefox build possible |
| D9 | The extension only builds a URL and opens a tab. It never calls the trade search API. | Avoids GGG rate limits and User-Agent requirements |

## 4. Verified facts (from investigation on 2026-09-21)

- **Maxroll DOM:** each planner item renders as
  `<span class="poe2-item" data-poe2-id="<numeric item id>" data-poe2-profile="<profile id>">`.
  Skill gems also use `span.poe2-item`, but their `data-poe2-id` is a hex hash with
  no `data-poe2-profile`.
- **Maxroll planner API:** `GET https://planners.maxroll.gg/profiles/poe2/{profileId}`
  returns `{ id, date, name, class, data }`, where `data` is a JSON *string*. Its
  parsed `items` object maps item id to item.
- **Planner item shape:** `base` (game metadata path, for example
  `Metadata/Items/Weapons/OneHandWeapons/Wands/FourWand3`), `rarity`
  (`normal|magic|rare|unique`), `name`, `sockets[]`, and
  `stats.{implicit,explicit,enchant,crafted,fractured,rune}`. Each of those is a
  `{ gameStatId: value }` map, for example `{"spell_damage_+%": 64}`.
- **Trade URL:** `https://www.pathofexile.com/trade2/search/poe2/{league}/{payload}`,
  where `payload = base64url(gzip(JSON(query)))`. The user's example decodes to
  `{"status":{"option":"available"},"stats":[{"type":"and","filters":[]}]}`, which is
  the inner `query` object with no `sort`.
- **Trade data endpoints:** `/api/trade2/data/stats` groups stats by kind
  (`explicit`, `implicit`, `enchant`, `crafted`, `fractured`, `rune`, `desecrated`,
  `pseudo`, …) with ids such as `explicit.stat_3299347043`.
  `/api/trade2/data/filters` lists category options (`weapon.wand`,
  `accessory.ring`, `flask.charm`, `jewel`, …), rarity options (`nonunique`, …), and
  `equipment_filters.rune_sockets`.
- **RePoE (PoE2 fork):**
  `https://repoe-fork.github.io/poe2/stat_translations/stat_descriptions.min.json`
  holds translation entries `{ ids[], English[{string, format, condition}], trade_stats? }`.
  `https://repoe-fork.github.io/poe2/base_items.min.json` maps metadata path to
  `{ name, item_class }`, for example `FourWand3` to "Attuned Wand" / `Wand`.
- **Mapping coverage on the reference build:** 571 of 583 stats map to a trade id
  (152 through `trade_stats`, 419 through normalized text match). The misses are the
  amulet enchant `Allocates {passive}`, unique-only "Legacy of" stats, and one
  implicit.
- **Multi-id stats exist.** For example, `attack_minimum_added_physical_damage` and
  `attack_maximum_added_physical_damage` share one translation ("Adds # to #"). Trade
  represents them as one stat whose value is the average of the two.
- **Paperdoll embed (verified live in Chrome):** the `plannerEquipment` embed renders
  lazily when scrolled into view. Each slot is
  `div.poe2-PaperdollSlot.poe2-slot-<Slot>.poe2-item-<rarity>`, with slots such as
  Weapon, Offhand, Helm, BodyArmour, Gloves, Boots, Belt, Amulet, Ring, Ring2,
  Flask1–2, and Charm1–3. The slot DOM has **no item id**. Its React fiber (the
  `__reactFiber$*` key, 2 levels up) has `memoizedProps.item`, which is the full
  planner item object with the same shape as the API. The item reflects the currently
  selected set and Act tab.
- **Trade URL spike (verified live in Chrome):** the trade page accepted an inner-query
  payload containing `type`, a `count` stat group with `value.min`, `min` and `max` stat
  values, `filters.type_filters.filters.{category,rarity}`, and
  `filters.equipment_filters.filters.rune_sockets.min`. After loading, it re-encoded
  the URL with the same query. `status: available` shows as "Instant Buyout and In
  Person". Headless Chromium is blocked by Cloudflare, so any E2E test must use a
  headed browser.
- **Leagues:** `GET /api/trade2/data/leagues` returns
  `{ result: [{ id, realm, text }] }`. On 2026-09-21 it listed Forbidden Rites,
  HC Forbidden Rites, Runes of Aldur, HC Runes of Aldur, Standard, and Hardcore.

## 5. Architecture

```
poe2-build-trade/
├─ entrypoints/
│  ├─ maxroll.content.ts   content script on https://maxroll.gg/poe2/* (isolated world)
│  ├─ item-reader.content.ts  MAIN-world script: reads paperdoll item from React props
│  ├─ background.ts        service worker; all cross-origin fetches
│  └─ options/             options page
├─ src/
│  ├─ adapters/maxroll.ts  maxroll DOM discovery + planner fetch contract
│  ├─ core/types.ts        ItemModel, ModRow, SearchSelection, StatMap types
│  ├─ core/translate.ts    planner item JSON + maps → ItemModel
│  ├─ core/query.ts        ItemModel + SearchSelection → trade query object
│  ├─ core/encode.ts       query → gzip → base64url → trade URL
│  ├─ core/categories.ts   item_class → trade category table
│  ├─ data/store.ts        stat-map/base-map loading, cache, refresh
│  └─ ui/popup/            mod picker (Shadow DOM)
├─ public/_locales/{en,th}/messages.json
├─ data/                   bundled snapshot: stat-map.json, base-map.json
├─ scripts/build-data.ts   generates the maps and a coverage report
├─ tests/                  unit tests + fixtures captured from real APIs
└─ .github/workflows/
   ├─ ci.yml               lint, typecheck, unit tests, coverage gate
   ├─ data.yml             daily cron: build-data → publish to gh-pages
   └─ release.yml          tag v* → build → zip → GitHub Release
```

### Unit responsibilities

| Unit | Does | Depends on |
|---|---|---|
| `adapters/maxroll` | Finds eligible item elements, reads `{profileId, itemId}`, asks background for planner JSON | DOM, background messaging |
| `background` | Fetches planner JSON, trade leagues, the stat-map refresh, and the latest release. Caches in `chrome.storage`. | host permissions |
| `core/translate` | Turns a planner item into an `ItemModel`: resolves base name/class, groups multi-id stats, and attaches a trade id or marks the stat unmapped | stat-map, base-map |
| `core/query` | Builds the trade query object from `ItemModel` + `SearchSelection` | categories table |
| `core/encode` | Serializes, gzips (`CompressionStream`), base64url-encodes, and builds the URL | none |
| `ui/popup` | Renders mod rows, collects the selection, triggers search | `core/*`, i18n |
| `data/store` | Picks the freshest available map: cached remote, then bundled | background |
| `scripts/build-data` | Builds stat-map.json + base-map.json and prints coverage | RePoE, trade data API |

`core/*` is pure (no DOM, no `chrome.*`), so it can be unit-tested in Node.

### Data flow

1. The content script injects a 🔍 button into two kinds of targets:
   - paperdoll slots (`.poe2-PaperdollSlot` that have an item rarity class)
   - inline `span.poe2-item[data-poe2-profile]` whose `data-poe2-id` is numeric
   It marks each element `data-b2t-injected` and watches for new targets with a
   `MutationObserver`.
2. On click, the content script gets the planner item JSON:
   - **Paperdoll slot:** it tags the slot with a unique `data-b2t-key` and dispatches
     a `b2t:read-item` CustomEvent. `item-reader` (MAIN world) finds the slot, walks
     up to 6 fiber levels looking for `memoizedProps.item` with a `base` field, and
     replies with a `b2t:item` CustomEvent whose detail is the item as a JSON string.
   - **Inline span:** it sends `{profileId, itemId}` to background. Background
     returns the item from the planner API, cached per profile in
     `chrome.storage.session`.
3. The content script loads the maps through `data/store`, and `core/translate`
   produces an `ItemModel`.
4. Unique and normal items go straight to step 6. Rare and magic items open the
   popup.
5. The user adjusts the selection and presses **Search on Trade**.
6. `core/query` and then `core/encode` build the URL, and
   `window.open(url, "_blank", "noopener")` opens it.

## 6. Data pipeline

### stat-map.json

```ts
type TradeKind = "explicit" | "implicit" | "enchant" | "crafted" | "fractured" | "rune";

type StatMap = {
  generatedAt: string;           // ISO timestamp
  entries: Array<{
    ids: string[];               // game stat ids sharing one translation
    text: string;                // normalized English template, e.g. "#% increased Spell Damage"
    trade: Partial<Record<TradeKind, string>>; // e.g. { explicit: "explicit.stat_2974417149" }
  }>;
};
```

Generation (`scripts/build-data.ts`):

1. Download RePoE `stat_descriptions.min.json` and trade `/api/trade2/data/stats`.
2. For each translation entry, use its `trade_stats` when present, grouped by kind.
3. Otherwise, normalize every English template and match it against trade stat text
   of the same kind, ignoring case:
   - `[A|B]` becomes `B`, and `[A]` becomes `A`
   - `{n}` becomes `#`
   - also try the variant with a leading `+` added or removed
4. Write only entries that have at least one trade id.

### base-map.json

`{ [metadataPath]: { name, itemClass } }`, filtered to item classes that appear in
`core/categories.ts`.

### Refresh

- `data.yml` runs `build-data` every day and publishes both files to GitHub Pages
  under `/data/`.
- The URL is one build-time constant, `DATA_BASE_URL`, set once the GitHub repository
  exists.
- The extension checks for new data at most once every 24 hours, on first use. It
  needs no `alarms` permission. If the fetch fails, it keeps the cached copy, or uses
  the bundled snapshot if nothing is cached. Refresh failures do not show an error to
  the user.
- The options page shows the `generatedAt` date of the map currently in use.

### Version check

The extension checks `https://api.github.com/repos/{owner}/{repo}/releases/latest`
at most once every 24 hours. If the tag is newer than the manifest version, the
popup shows a small banner that links to the release.

## 7. Search behaviour and query mapping

### By rarity

| Rarity | 🔍 action | Query |
|---|---|---|
| Unique | Search immediately | `name` + `type` (base name) |
| Normal | Search immediately | `type` |
| Rare / Magic | Open popup | see below |

### Popup

```
┌ Rare · Attuned Wand ───────────────── ✕ ┐
│ Base  (•) Any Wand  ( ) Attuned Wand     │
│ ─ Explicit ───────────────────────────── │
│ [x] 64% increased Spell Damage   min [51]│
│ [x] +2 to Level of all Spell Sk… min [ 2]│
│ [x] 14% increased Cast Speed     min [11]│
│ ─ Implicit / Rune / Enchant ──────────── │
│ [ ] Gain 6% as Extra Lightning   min [ 4]│
│ [-] Allocates Sacrifice  (not on trade)  │
│ Match  [All ▾]  (All / At least N)       │
│ [ ] Rune sockets ≥ 1                     │
│          [ Search on Trade ↗ ]           │
└──────────────────────────────────────────┘
```

- The popup renders inside a Shadow DOM root so maxroll's CSS cannot affect it.
- Only one popup is open at a time. Esc or a click outside closes it.
- It is keyboard accessible: tab order follows the rows, and Enter runs the search.

### Mapping rules

| Input | Query output |
|---|---|
| Base = category (default) | `filters.type_filters.filters.category.option = <category>` |
| Base = exact | `type = "<base name>"` |
| Rare or magic | `filters.type_filters.filters.rarity.option = "nonunique"` |
| Explicit mods | Checked by default. `value.min = floor(value × minPct)`. When `|value| ≤ 5` (skill levels, small flat values), `min` is the exact value, so +2 does not become +1. |
| Implicit, rune, and enchant mods | Shown unchecked |
| Multi-id stats | One row. The value is the average of the component values. |
| Negative values | `value.max = ceil(value × minPct)` instead of `min` |
| Unmapped stats | Greyed row labelled "not on trade" and excluded from the query |
| Match = All | stat group `{ type: "and", filters }` |
| Match = At least N | stat group `{ type: "count", value: { min: N }, filters }` |
| Rune sockets checkbox | `filters.equipment_filters.filters.rune_sockets.min = sockets.length` |
| Status | `status.option` from options (`online` / `available` / `any`) |
| Not emitted | ilvl (planner uses 99 as a placeholder), quality, corrupted |

### Item class to trade category

`core/categories.ts` is a hand-written table covering every equipment class that
maxroll uses, for example:

| item_class | category |
|---|---|
| `Wand` | `weapon.wand` |
| `Sceptre` | `weapon.sceptre` |
| `Focus` | `armour.focus` |
| `Ring` | `accessory.ring` |
| `Amulet` | `accessory.amulet` |
| `Belt` | `accessory.belt` |
| `Helmet` | `armour.helmet` |
| `Body Armour` | `armour.chest` |
| `Gloves` | `armour.gloves` |
| `Boots` | `armour.boots` |
| `Jewel` | `jewel` |
| `UtilityFlask` | `flask.charm` |

The full table is completed during implementation from the trade `filters` options.
An unknown class falls back to searching by exact base.

### Options page

- **League:** a select filled from `/api/trade2/data/leagues`. If that fails, a text
  input is shown. If the saved league is missing from the list, the extension uses the
  first current non-Hardcore, non-SSF league and shows a notice in the popup.
- **Default min %:** 80, range 50–100.
- **Status:** `available` by default, matching the user's example URL.

## 8. Permissions

```jsonc
{
  "permissions": ["storage"],
  "host_permissions": [
    "https://planners.maxroll.gg/*",
    "https://www.pathofexile.com/api/trade2/data/*",
    "https://<owner>.github.io/*",   // DATA_BASE_URL host
    "https://api.github.com/*"
  ],
  "content_scripts": [{ "matches": ["https://maxroll.gg/poe2/*"] }]
}
```

The extension does not request `tabs`, `<all_urls>`, `scripting`, or `alarms`.

## 9. Error handling

| Case | Behaviour |
|---|---|
| Planner fetch fails (network error or 404) | Inline toast "Couldn't load build data" with a **Retry** button |
| Planner JSON shape differs from expected | Validate before use. If invalid, show "Maxroll format changed", link to GitHub Issues, and do not attempt a partial query. |
| Items render late (SPA navigation, lazy embeds) | `MutationObserver` with an idempotent `data-b2t-injected` marker |
| Stat-map refresh fails | Use the cached map, then the bundled one. No user-facing error. |
| Stat not in map | Greyed row (section 7) |
| Leagues fetch fails | Use the last saved league, or a manual text input on the options page |
| Saved league has ended | Fall back to the current default league and show a notice |
| MV3 service worker terminated | All caches live in `chrome.storage`, not in memory |

All console output uses the `[b2t]` prefix.

## 10. Testing

1. **Unit tests (Vitest).** Fixtures are real captured responses:
   `tests/fixtures/planner-z7coxn0y.json`, `trade-stats.json`, `trade-filters.json`,
   plus a snapshot of the generated maps.
   - `translate`: a rare wand with a rune, a ring with an implicit, an amulet with an
     unmapped enchant, the unique belt Mageblood, and an item with added-damage
     multi-id stats.
   - `query`: golden JSON for and/count, category/exact base, negative values, and
     rune sockets.
   - `encode`: `decode(encode(q))` equals `q`. Decoding the example payload
     `H4sIAAAAAAAAE6tW…` equals the known JSON.
2. **Coverage gate.** `build-data --check` computes mapping coverage over the fixture
   build. CI fails below 95%. The `data.yml` cron refuses to publish below 95% and
   keeps the previous data instead.
3. **E2E (Playwright + headed Chromium with the extension loaded).** Opens the live
   maxroll guide, asserts 🔍 buttons exist, opens a rare item popup, clicks Search, and
   asserts that the new tab URL decodes to the expected query. The browser must be
   headed because Cloudflare blocks headless browsers on pathofexile.com. The test
   depends on live sites, so it runs manually, not on every PR.
4. **Release smoke checklist (README).** Install unpacked, open 2–3 guides, and test a
   unique, a rare, a jewel, and a charm.

## 11. Distribution

- `release.yml`: pushing a `v*` tag builds with WXT, zips `.output/chrome-mv3`, and
  attaches the zip to a GitHub Release.
- The README covers install steps (Developer mode → Load unpacked), a no-data-collection
  statement, and a disclaimer: "Not affiliated with or endorsed by Grinding Gear Games
  or Maxroll."
- The name and icon do not use "Path of Exile" or "Maxroll" branding.

## 12. Risks

| Risk | Mitigation |
|---|---|
| The maxroll planner API is private and may change or be blocked | Isolated in `adapters/maxroll`. Schema validation surfaces the failure clearly. |
| Paperdoll item reading depends on React internals (`__reactFiber$`, the `item` prop) | Isolated in `item-reader`. If no item is found, the extension shows "Couldn't read this item" instead of guessing. |
| The trade URL payload format is undocumented | Verified first (section 13). Fallbacks are `?q=` or a background POST to `/api/trade2/search`. |
| RePoE fork lags behind game patches | Text matching against live trade stats covers entries without `trade_stats`. The coverage gate stops bad data from being published. |
| GGG changes trade stat ids | The daily regeneration picks up the new ids |

## 13. Trade URL spike (done 2026-09-21)

1. The URL payload accepts `type`, `filters.type_filters` (category and rarity),
   `filters.equipment_filters.rune_sockets`, a `count` stat group, and both `min` and
   `max` values. **Confirmed.** No fallback is needed.
2. With no `sort`, results came back in ascending price order.
3. `/api/trade2/data/leagues` exists (see section 4).
