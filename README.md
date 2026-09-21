# Build → Trade (PoE2)

A Chromium extension that adds a search button to every equipment item on
[maxroll.gg](https://maxroll.gg/poe2/build-guides) Path of Exile 2 build guides. One
click opens the official trade site with a search that matches the item.

- **Unique items** open a trade search by name.
- **Rare and magic items** open a picker where you choose mods and minimum values
  before searching.
- **Gems, currency, and other items linked in the guide text** show a search button
  when you hover them. Currency opens the bulk exchange; gems and bases open a normal
  search.
- Works on the equipment paperdoll (any set or Act tab) and on "New Item" links in the
  guide text.

> Not affiliated with or endorsed by Grinding Gear Games or Maxroll.

## Install

1. Download `poe2-build-trade-<version>-chrome.zip` from the
   [latest release](../../releases/latest) and unzip it.
2. Open `chrome://extensions`. This also works in Edge, Brave, and Opera.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

To update, replace the folder with a newer release and click the reload icon on the
extension card. The picker shows a banner when a new version is out.

## Use

1. Open a maxroll PoE2 build guide.
2. Click the magnifier on an item.
3. For rare and magic items:
   - Untick mods you don't care about.
   - Adjust the minimum values (they default to 80% of the build's roll).
   - Choose **Any <class>** or the exact base.
   - Choose whether all mods must match or only **at least N** of them.
4. Click **Search on Trade**. The trade site opens in a new tab.

Mods that the trade site can't search, such as amulet anoint enchants, are shown
greyed out.

## Settings

Right-click the extension icon, then choose **Options**.

| Setting | Default |
|---|---|
| Trade league | The current league, picked automatically. Pick one explicitly if you play an event league. |
| Default minimum | 80% of the build value. Values of 5 or less (such as +2 skill levels) are searched exactly. |
| Listing status | Instant buyout and in person |

## Privacy

The extension collects nothing and has no analytics. The only network requests it makes are:

- `planners.maxroll.gg`, to read the build you are viewing
- `www.pathofexile.com/api/trade2/data/*`, for the list of leagues
- GitHub, for daily mod-data updates and new-version checks (only when configured)

Settings stay in your browser's extension storage.

## ภาษาไทย

Extension สำหรับ Chrome, Edge, Brave และ Opera ที่เพิ่มปุ่มค้นหาให้ไอเทมทุกชิ้นในหน้า build
guide ของ maxroll (PoE2) กดแล้วจะเปิดเว็บเทรดอย่างเป็นทางการพร้อม filter ที่ตรงกับไอเทมนั้น

- **Unique**: กดครั้งเดียวก็ค้นด้วยชื่อ
- **Rare/Magic**: มีหน้าต่างให้เลือกม็อดกับค่าต่ำสุดก่อน (ค่าเริ่มต้น 80% ของค่าใน build)
- **หินสกิล / currency / ไอเทมที่ลิงก์ในเนื้อหา guide**: เอาเมาส์ชี้แล้วจะมีปุ่มค้นหาโผล่ท้ายลิงก์
  currency จะเปิดหน้า exchange ส่วนหินสกิลกับ base จะเปิดหน้าค้นหาปกติ

**วิธีติดตั้ง**

1. ดาวน์โหลดไฟล์ zip จากหน้า Releases แล้วแตกไฟล์
2. เปิด `chrome://extensions`
3. เปิด **Developer mode**
4. กด **Load unpacked** แล้วเลือกโฟลเดอร์ที่แตกไว้

**League**: ระบบจะเลือกให้อัตโนมัติ ถ้าเล่น league หลักระหว่างที่มี event ให้เข้าไปเลือก
league เองในหน้า Options

## Development

```sh
npm install
npm run dev          # Chromium with the extension and hot reload
npm test             # unit tests (real captured fixtures)
npm run typecheck
npm run build        # .output/chrome-mv3
npm run e2e          # live smoke test on maxroll (needs a build; HEADED=1 to watch)
npm run build-data   # regenerate public/data/*.json from RePoE + trade2 data API
```

How the pieces fit:

- `entrypoints/maxroll.content.ts` injects the buttons and opens the picker.
- `entrypoints/item-reader.content.ts` runs in the page's main world and reads
  paperdoll items from React props.
- `entrypoints/background.ts` handles the planner API, the data maps, leagues, and
  opening tabs.
- `src/core/*` is pure logic: translate an item, build the query, and encode it into a
  trade2 URL.

The design is in `docs/superpowers/specs/`.

### Maintainer setup

1. Set `GITHUB_REPO` in `src/config.ts` to `owner/repo`. This turns on the daily data
   refresh and the update banner, and adds the matching host permissions.
2. In the repository settings, enable **Pages** with the source set to **GitHub
   Actions**. `data.yml` publishes fresh maps every day. It refuses to publish if mod
   coverage drops below 95%.
3. To release, bump `version` in `package.json`, then tag and push:
   `git tag v0.2.0 && git push --tags`. `release.yml` attaches the zip.

### Release smoke checklist

1. Load `.output/chrome-mv3` unpacked in a fresh profile.
2. Open 2–3 different guides.
3. Test a unique (one click), a rare weapon, a rare jewel, and a charm, and check that
   the trade tab shows the expected filters.
4. Hover a gem link and a currency link in the guide text, click the button, and check
   that the gem opens a search and the currency opens the exchange.
5. Switch the set and the Act tab on the paperdoll, and check that the searched item
   follows the selection.
6. Check that changes on the options page affect the next search.
