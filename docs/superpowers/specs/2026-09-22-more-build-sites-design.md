# More build sites: mobalytics and poe.ninja (v0.3)

Date: 2026-09-22 · Extends `2026-09-21-poe2-build-trade-design.md`.

## Goal

Search trade from two more PoE2 build sites, but only where the site does not already
offer it:

| Site | Equipment | Skill gems / linked names |
|---|---|---|
| mobalytics.gg/poe-2 guides | Our button and popup on every paperdoll slot and jewel | Hover search |
| poe.ninja/poe2/builds characters | Not touched. poe.ninja has its own mod-picker trade search. | Hover search |

## Findings (live, 2026-09-22)

- **poe.ninja**
  - Every equipped item already has "Search on Trade" with a mod picker, pseudo stats, and a min% slider.
  - Skill gems in the Skills and Main Skills lists have no trade search.
  - Gem names are text leaves under `[data-tooltip-trigger]`, and the gem level is in a separate span.
  - Headless Chromium works.
- **mobalytics**
  - Each paperdoll slot has a hidden `<a href="https://www.pathofexile.com/trade2/search/…?q=…">`. The same link is shown as a "Trade" badge on hover.
  - The slot box is the grandparent of that link.
  - In React props, the slot's component has `slot: "helmet"`. An ancestor two levels up has `data[slot] = { equipmentItem, runes, … }`.
  - Jewels pass `item` directly as a prop.
  - `equipmentItem` has these fields:
    - `name`: base name, or unique name with an optional variant, e.g. "Morior Invictus (life)"
    - `isUnique`
    - `explicitDescriptions`
    - prefix and suffix mod slugs
    - `poe2TradeRequest.query`: a JSON string with the guide's own trade filters, using trade stat ids and minimums, including pseudo stats
  - The guide's query hard-codes league "Forbidden Rites" and status `securable`.
  - Inline item links and gem cards are text leaves under `[data-tippy-delegate-id]`.
  - Cloudflare challenges automated browsers, so E2E cannot cover mobalytics. It is checked manually in a real Chrome.

## Design

- **Site runtime.**
  - `src/site/runtime.ts` holds what every site shares: button injection, the MutationObserver, the hover button, link resolution, and popup and trade opening.
  - A `SiteAdapter` supplies `items(root)`, which returns buttons with an async `model()`, and `links(root)`, which returns name candidates.
  - Content scripts are one-liners: `maxroll`, `mobalytics`, `ninja`. The MAIN-world `item-reader` serves maxroll and mobalytics.
- **mobalytics items.**
  - The background validates the slot (`isMobaSlot`) and converts it with `mobaToModel`:
    - **Unique:** one-click search. The name comes from the guide query, else the display name with a trailing "(…)" removed. The base type comes from `trade-items.json`.
    - **Guide filters present:** a rare model whose popup rows are the guide's filters.
      - Each row has `preset: {min, max}`, is checked by default, and keeps the guide's bounds; `minPct` is not applied a second time.
      - Row text is the trade template, e.g. "# to maximum Life", because the guide gives a threshold, not a rolled value.
      - Pseudo rows sit with the explicit rows and carry a "pseudo" tag.
    - **No filters:** one-click search by base type. When no base is known (for example a jewel), the popup searches the category.
    - The item class comes from the trade category (reverse of `CATEGORY_BY_CLASS`), and rune sockets from `runes.length`.
    - League and status always come from our settings.
- **Names.**
  - `leafNames()` collects text leaves inside the site's tooltip-trigger containers.
  - `linkName()` normalises the text; leaves that cannot be a name are marked checked and skipped.
  - `lookupName()` tries the exact name first, then the name without a trailing "(…)".
- **Data.**
  - `build-data` also writes `trade-stat-text.json`, about 245 KB, mapping each trade stat id to its display template.
  - Text is stored once per `stat_N`, with full-id overrides where kinds differ. When the API lists an id twice, the first listing wins.
  - The file is bundled and refreshed daily from Pages. `background.ts` now has one generic `dataFile()` loader for trade-items and stat text.

## Testing

- **Unit tests:**
  - `mobaToModel` against `tests/fixtures/mobalytics-equipment.json`: real SSR data, re-keyed to the live props shape.
  - `buildTradeStatText` against the trade stats fixture.
  - `findMobaSlotInFiber`, `linkName`, and `lookupName`.
- **E2E:** `npm run e2e` covers maxroll plus a poe.ninja character (skill-gem hover search). Override the character with `NINJA_CHARACTER`.
- **Manual:** mobalytics in real Chrome (slot popup, unique, jewel, gem hover).
