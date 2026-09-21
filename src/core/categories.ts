/** RePoE item_class → trade2 `type_filters.category` option. */
export const CATEGORY_BY_CLASS: Record<string, string> = {
  Claw: 'weapon.claw',
  Dagger: 'weapon.dagger',
  'One Hand Sword': 'weapon.onesword',
  'One Hand Axe': 'weapon.oneaxe',
  'One Hand Mace': 'weapon.onemace',
  Spear: 'weapon.spear',
  Flail: 'weapon.flail',
  'Two Hand Sword': 'weapon.twosword',
  'Two Hand Axe': 'weapon.twoaxe',
  'Two Hand Mace': 'weapon.twomace',
  Warstaff: 'weapon.warstaff',
  Talisman: 'weapon.talisman',
  Bow: 'weapon.bow',
  Crossbow: 'weapon.crossbow',
  Wand: 'weapon.wand',
  Sceptre: 'weapon.sceptre',
  Staff: 'weapon.staff',
  Helmet: 'armour.helmet',
  'Body Armour': 'armour.chest',
  Gloves: 'armour.gloves',
  Boots: 'armour.boots',
  Quiver: 'armour.quiver',
  Shield: 'armour.shield',
  Focus: 'armour.focus',
  Buckler: 'armour.buckler',
  Amulet: 'accessory.amulet',
  Belt: 'accessory.belt',
  Ring: 'accessory.ring',
  Jewel: 'jewel',
  LifeFlask: 'flask.life',
  ManaFlask: 'flask.mana',
  UtilityFlask: 'flask.charm',
};

/** Human label for the "Any …" base option. */
export const CLASS_LABEL: Record<string, string> = {
  UtilityFlask: 'Charm',
  LifeFlask: 'Life Flask',
  ManaFlask: 'Mana Flask',
};

export function categoryFor(itemClass: string | null): string | null {
  return (itemClass && CATEGORY_BY_CLASS[itemClass]) || null;
}

export function classLabel(itemClass: string): string {
  return CLASS_LABEL[itemClass] ?? itemClass;
}
