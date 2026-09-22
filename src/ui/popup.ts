import { classLabel } from '../core/categories.ts';
import { defaultRowStates, selectionFromRows, type RowState } from '../core/query.ts';
import type { ItemModel, MatchMode, SearchSelection } from '../core/types.ts';
import { t } from '../ext/i18n.ts';
import type { Context } from '../ext/messages.ts';
import type { Settings } from '../ext/settings.ts';
import { h } from './dom.ts';
import { POPUP_CSS, TOKENS_CSS } from './styles.ts';

const HOST_ID = 'b2t-popup';
const RARITY_LABEL: Record<ItemModel['rarity'], string> = {
  normal: 'Normal',
  magic: 'Magic',
  rare: 'Rare',
  unique: 'Unique',
};

export interface PopupOptions {
  anchor: HTMLElement;
  model: ItemModel;
  settings: Settings;
  context: Context;
  onSearch: (sel: SearchSelection) => void;
}

let cleanup: (() => void) | null = null;

export function closePopup(): void {
  cleanup?.();
  cleanup = null;
}

function parseBound(input: HTMLInputElement): number | null {
  if (input.value.trim() === '') return null;
  const n = Number(input.value);
  return Number.isFinite(n) ? n : null;
}

function modRow(state: RowState): HTMLElement {
  const { row } = state;
  const mapped = row.tradeId !== null;
  const boundIsMax = row.preset ? row.preset.min === null && row.preset.max !== null : row.value < 0;
  const container = h('div', { class: `row${mapped ? '' : ' unmapped'}${state.checked ? '' : ' unchecked'}` });

  const checkbox = h('input', {
    type: 'checkbox',
    'aria-label': row.text,
    checked: state.checked,
    disabled: !mapped,
  });
  const bound = h('input', {
    type: 'number',
    step: 'any',
    placeholder: t(boundIsMax ? 'maxPlaceholder' : 'minPlaceholder'),
    'aria-label': `${row.text} ${t(boundIsMax ? 'maxPlaceholder' : 'minPlaceholder')}`,
    value: (boundIsMax ? state.max : state.min) ?? '',
    disabled: !mapped || !row.numeric || !state.checked,
  });

  checkbox.addEventListener('change', () => {
    state.checked = checkbox.checked;
    bound.disabled = !row.numeric || !state.checked;
    container.classList.toggle('unchecked', !state.checked);
    container.dispatchEvent(new CustomEvent('b2t-change', { bubbles: true }));
  });
  bound.addEventListener('input', () => {
    if (boundIsMax) state.max = parseBound(bound);
    else state.min = parseBound(bound);
  });

  container.append(
    checkbox,
    h('span', { class: 'text' }, row.text, row.kind === 'pseudo' ? h('span', { class: 'tag' }, 'pseudo') : null),
    mapped ? (row.numeric ? bound : h('span')) : h('span', { class: 'na' }, t('notOnTrade')),
  );
  return container;
}

function position(host: HTMLElement, anchor: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const { width, height } = host.getBoundingClientRect();
  const margin = 8;
  let left = a.right + margin;
  if (left + width > innerWidth - margin) left = a.left - width - margin;
  left = Math.max(margin, Math.min(left, innerWidth - width - margin));
  const top = Math.max(margin, Math.min(a.top, innerHeight - height - margin));
  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
}

export function openPopup({ anchor, model, settings, context, onSearch }: PopupOptions): void {
  closePopup();
  const host = h('div', { id: HOST_ID });
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = TOKENS_CSS + POPUP_CSS;

  const states = defaultRowStates(model, settings.minPct);
  const main = (s: RowState) => s.row.kind === 'explicit' || s.row.kind === 'pseudo';
  const explicit = states.filter(main);
  const other = states.filter((s) => !main(s));

  // Base: category ("Any Wand") when the class maps to one, else exact base only.
  let baseMode: SearchSelection['baseMode'] = model.category ? 'category' : 'exact';
  const baseRadio = (mode: SearchSelection['baseMode'], label: string) => {
    const input = h('input', { type: 'radio', name: 'base', checked: baseMode === mode });
    input.addEventListener('change', () => (baseMode = mode));
    return h('label', {}, input, label);
  };
  const baseSection =
    model.category && model.itemClass && model.baseName
      ? h(
          'div',
          { class: 'base', role: 'radiogroup', 'aria-label': t('baseLabel') },
          baseRadio('category', t('anyClass', classLabel(model.itemClass))),
          baseRadio('exact', model.baseName),
        )
      : null;

  // Match: all checked mods, or at least N of them.
  const matchSelect = h(
    'select',
    { 'aria-label': t('match') },
    h('option', { value: 'and' }, t('matchAll')),
    h('option', { value: 'count' }, t('matchAtLeast')),
  );
  const countInput = h('input', { type: 'number', min: 1, step: 1, 'aria-label': t('matchAtLeast') });
  const checkedCount = () => states.filter((s) => s.checked && s.row.tradeId !== null).length;
  const syncCount = () => {
    const n = checkedCount();
    countInput.max = String(Math.max(n, 1));
    if (!countInput.value || Number(countInput.value) > n) countInput.value = String(Math.max(n - 1, 1));
    countInput.hidden = matchSelect.value !== 'count';
  };
  matchSelect.addEventListener('change', syncCount);

  const runeCheckbox = h('input', { type: 'checkbox' });
  const runeControl =
    model.sockets > 0 ? h('label', {}, runeCheckbox, t('runeSockets', model.sockets)) : null;

  const search = () => {
    const match: MatchMode =
      matchSelect.value === 'count'
        ? { type: 'count', min: Math.max(1, Math.floor(Number(countInput.value) || 1)) }
        : { type: 'and' };
    onSearch({
      baseMode,
      mods: selectionFromRows(states),
      match,
      runeSockets: runeCheckbox.checked ? model.sockets : null,
      status: settings.status,
    });
    closePopup();
  };

  const title = model.rarity === 'unique' ? model.name : model.baseName ?? model.name;
  const panel = h(
    'div',
    { class: 'panel', role: 'dialog', 'aria-label': `${RARITY_LABEL[model.rarity]} ${title}` },
    h(
      'header',
      {},
      h('span', { class: `rarity rarity-${model.rarity}` }, RARITY_LABEL[model.rarity]),
      h('span', { class: 'title', title }, title),
      h('button', { class: 'close', type: 'button', 'aria-label': t('close'), onclick: closePopup }, '✕'),
    ),
    h(
      'div',
      { class: 'body' },
      context.update
        ? h(
            'div',
            { class: 'banner' },
            t('updateAvailable', context.update.version),
            h('a', { href: context.update.url, target: '_blank', rel: 'noopener' }, t('download')),
          )
        : null,
      context.leagueChanged ? h('div', { class: 'banner' }, t('leagueChanged', context.league)) : null,
      baseSection ? h('h3', {}, t('baseLabel')) : null,
      baseSection,
      explicit.length ? h('h3', {}, t('explicitMods')) : null,
      ...explicit.map(modRow),
      other.length ? h('h3', {}, t('otherMods')) : null,
      ...other.map(modRow),
      h('div', { class: 'controls' }, h('label', {}, t('match'), matchSelect, countInput), runeControl),
    ),
    h(
      'footer',
      {},
      h('span', { class: 'league', title: context.league }, t('leagueLabel', context.league)),
      h('button', { class: 'search', type: 'button', onclick: search }, `${t('searchOnTrade')} ↗`),
    ),
  );
  panel.addEventListener('b2t-change', syncCount);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      search();
    }
  });
  syncCount();

  root.append(style, panel);
  document.body.append(host);
  position(host, anchor);

  const onPointerDown = (e: PointerEvent) => {
    if (!e.composedPath().includes(host) && !e.composedPath().includes(anchor)) closePopup();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closePopup();
  };
  const onResize = () => position(host, anchor);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onKey, true);
  addEventListener('resize', onResize);
  cleanup = () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    host.remove();
    anchor.focus({ preventScroll: true });
  };
  (panel.querySelector('.search') as HTMLButtonElement).focus({ preventScroll: true });
}
