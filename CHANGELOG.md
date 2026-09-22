# Changelog

What changed between releases. Download builds from the
[Releases page](https://github.com/therw101/poe2-build-trade/releases).

## [Unreleased]

### Added

- **poe.ninja Path of Building pages (`poe.ninja/poe2/pob/…`):** a search button on every equipment item, flask, and charm. poe.ninja has no trade search on these pages.
  - Mods are read from the item text and matched to trade stats. Local stats such as "% increased Energy Shield" on armour use their local filter.
  - Repeated stats are added up. For example, +40% and +33% Cold Resistance become one row of 73%.
  - Only as many lines as the base really has implicits count as implicit, because PoB exports sometimes list explicit mods as implicits.
- Skill gems on PoB pages get the hover search.

### ภาษาไทย

- **หน้า PoB ของ poe.ninja:** ไอเทม ขวด และ charm ทุกชิ้นมีปุ่มค้นหา อ่านม็อดจากข้อความแล้วจับคู่กับ stat บนเว็บเทรดให้
- ม็อดซ้ำกันจะรวมค่าให้ และหินสกิลบนหน้า PoB ชี้แล้วค้นได้

## [0.3.0] - 2026-09-22

### Added

- **mobalytics.gg guides:** a search button on every paperdoll slot and jewel.
  - Rare items open the picker with the filters the guide author chose, at the author's minimums, already ticked. Pseudo stats such as total elemental resistance are tagged.
  - Uniques search by name in one click.
  - League and listing status come from your Options, not the guide.
- **poe.ninja characters:** skill gem names show the hover search button. Equipment keeps poe.ninja's own trade search.
- On mobalytics, gem cards and item names in the guide text get the hover search, the same as on maxroll.

### Changed

- Unique names shown with a variant, such as "Morior Invictus (life)", are searched by their trade name.
- The daily data refresh also publishes `trade-stat-text.json`. The picker uses it to show mobalytics filters as text.

### Known limits

- mobalytics jewels show as "Jewel" instead of their base (for example Ruby), because the guide data has no base name. The search still covers all jewels with those mods.

### ภาษาไทย

- **mobalytics:** ไอเทมทุกช่องและ jewel มีปุ่มค้นหา
  - ไอเทม rare เปิด popup ที่ติ๊กม็อดตามที่คนเขียน guide เลือกไว้ พร้อมค่าต่ำสุดของเขา
  - ไอเทม unique กดครั้งเดียวค้นเลย
  - league และสถานะใช้ตามหน้า Options ของเรา
- **poe.ninja:** เอาเมาส์ชี้ชื่อหินสกิลแล้วมีปุ่มค้นหา ส่วนไอเทมที่ใส่อยู่ใช้ปุ่มเทรดของ poe.ninja เอง
- ชื่อ unique ที่มี variant ต่อท้าย เช่น "(life)" ค้นเจอแล้ว

## [0.2.0] - 2026-09-21

### Added

- **Linked items in maxroll guide text:** gems, currency, and other items get a search button when you hover them.
  - Currency, fragments, and runes open the bulk exchange.
  - Uniques search by name; gems and bases search by type.
  - Names that trade does not list, such as Purity of Fire, get no button.
- The daily data refresh also publishes `trade-items.json`, the map from item names to trade searches.

### ภาษาไทย

- หินสกิล, currency และไอเทมที่ลิงก์ไว้ในเนื้อหา guide ของ maxroll เอาเมาส์ชี้แล้วมีปุ่มค้นหา
- currency เปิดหน้า exchange ส่วนหินสกิลกับ base เปิดหน้าค้นหาปกติ

## [0.1.0] - 2026-09-21

First release.

- **maxroll.gg PoE2 guides:** a search button on every paperdoll item (any set or Act tab) and on "New Item" links in the guide text.
- **Unique and normal items:** one-click search by name or base.
- **Rare and magic items:** a picker where you can:
  - tick the mods you want
  - set minimums (80% of the build's roll by default; values of 5 or less are searched exactly)
  - choose "Any <class>" or the exact base
  - match all mods or at least N
  - require rune sockets
- Amulet anoints and other option stats can be searched.
- **Options:**
  - trade league, picked automatically if you don't choose one
  - default minimum
  - listing status
- Mod data ships with the extension, is refreshed daily from GitHub Pages, and a banner appears when a new release is out.
- English and Thai UI.

### ภาษาไทย

- ปุ่มค้นหาบนไอเทมทุกชิ้นในหน้า guide ของ maxroll
- **unique/normal:** กดครั้งเดียวค้นเลย
- **rare/magic:** เลือกม็อดและค่าต่ำสุดได้ก่อนค้น
- หน้า Options ตั้ง league, ค่าต่ำสุดเริ่มต้น และสถานะการขาย

[0.3.0]: https://github.com/therw101/poe2-build-trade/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/therw101/poe2-build-trade/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/therw101/poe2-build-trade/releases/tag/v0.1.0
