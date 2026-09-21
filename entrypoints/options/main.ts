import { browser } from 'wxt/browser';
import { TRADE_LEAGUES_URL } from '../../src/config.ts';
import type { League } from '../../src/core/leagues.ts';
import type { TradeStatus } from '../../src/core/types.ts';
import { t } from '../../src/ext/i18n.ts';
import { sendMessage } from '../../src/ext/messages.ts';
import { getSettings, saveSettings, type Settings } from '../../src/ext/settings.ts';
import { h } from '../../src/ui/dom.ts';
import { TOKENS_CSS } from '../../src/ui/styles.ts';

const CSS = `
body { margin: 0; min-height: 100vh; background: var(--b2t-bg); color: var(--b2t-text); font-size: 14px; line-height: 1.5; }
main { max-width: 520px; margin: 0 auto; padding: 32px 16px; }
h1 { margin: 0 0 24px; font-size: 22px; font-weight: 600; color: var(--b2t-accent-strong); }
.field { display: grid; gap: 6px; margin-bottom: 20px; }
.field > span { font-weight: 600; }
select, input { font: inherit; color: var(--b2t-text); background: var(--b2t-surface); border: 1px solid var(--b2t-border); border-radius: 4px; padding: 6px 8px; }
input[type=number] { width: 96px; }
select:focus-visible, input:focus-visible { outline: 2px solid var(--b2t-accent); outline-offset: 1px; }
.hint { font-size: 12px; color: var(--b2t-text-dim); }
.status { min-height: 20px; font-size: 12px; color: var(--b2t-accent); }
footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--b2t-border); font-size: 12px; color: var(--b2t-text-dim); display: grid; gap: 4px; }
`;

const statusEl = h('div', { class: 'status', role: 'status' });
let statusTimer = 0;

async function save(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  statusEl.textContent = t('saved');
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (statusEl.textContent = ''), 1500);
}

async function fetchLeagues(): Promise<League[] | null> {
  try {
    const res = await fetch(TRADE_LEAGUES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as { result: League[] }).result;
  } catch (err) {
    console.warn('[b2t] leagues fetch failed', err);
    return null;
  }
}

function leagueField(settings: Settings, leagues: League[] | null): HTMLElement {
  if (!leagues) {
    const input = h('input', { type: 'text', value: settings.league ?? '', placeholder: 'Standard' });
    input.addEventListener('change', () => void save({ league: input.value.trim() || null }));
    return h('label', { class: 'field' }, h('span', {}, t('optLeague')), input, h('span', { class: 'hint' }, t('optLeagueError')));
  }
  const select = h('select', {}, h('option', { value: '' }, t('optLeagueAuto')));
  for (const l of leagues) select.append(h('option', { value: l.id }, l.text));
  select.value = settings.league && leagues.some((l) => l.id === settings.league) ? settings.league : '';
  select.addEventListener('change', () => void save({ league: select.value || null }));
  return h('label', { class: 'field' }, h('span', {}, t('optLeague')), select);
}

function minPctField(settings: Settings): HTMLElement {
  const input = h('input', { type: 'number', min: 50, max: 100, step: 5, value: Math.round(settings.minPct * 100) });
  input.addEventListener('change', () => {
    const pct = Math.min(100, Math.max(50, Math.round(Number(input.value) || 80)));
    input.value = String(pct);
    void save({ minPct: pct / 100 });
  });
  return h('label', { class: 'field' }, h('span', {}, t('optMinPct')), input);
}

function statusField(settings: Settings): HTMLElement {
  const options: [TradeStatus, string][] = [
    ['available', t('statusAvailable')],
    ['online', t('statusOnline')],
    ['any', t('statusAny')],
  ];
  const select = h('select', {}, ...options.map(([v, label]) => h('option', { value: v }, label)));
  select.value = settings.status;
  select.addEventListener('change', () => void save({ status: select.value as TradeStatus }));
  return h('label', { class: 'field' }, h('span', {}, t('optStatus')), select);
}

async function main(): Promise<void> {
  document.title = t('optTitle');
  const style = h('style');
  style.textContent = TOKENS_CSS + CSS;
  document.head.append(style);

  const [settings, leagues, context] = await Promise.all([
    getSettings(),
    fetchLeagues(),
    sendMessage({ type: 'context' }),
  ]);
  const dataDate = context.ok ? new Date(context.data.dataGeneratedAt).toLocaleDateString() : '—';

  document.getElementById('app')!.append(
    h('h1', {}, t('optTitle')),
    leagueField(settings, leagues),
    minPctField(settings),
    statusField(settings),
    statusEl,
    h(
      'footer',
      {},
      h('span', {}, t('optData', dataDate)),
      h('span', {}, t('optVersion', browser.runtime.getManifest().version)),
      h('span', {}, t('disclaimer')),
    ),
  );
}

void main();
