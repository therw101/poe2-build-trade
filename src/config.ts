/**
 * GitHub repository that hosts releases and the refreshed data files, in
 * "owner/repo" form. Leave empty to disable remote data refresh and update checks.
 */
export const GITHUB_REPO = 'therw101/poe2-build-trade';

export const MAXROLL_PLANNER_URL = 'https://planners.maxroll.gg/profiles/poe2/';
export const TRADE_BASE_URL = 'https://www.pathofexile.com';
export const TRADE_SEARCH_URL = `${TRADE_BASE_URL}/trade2/search/poe2/`;
export const TRADE_EXCHANGE_URL = `${TRADE_BASE_URL}/trade2/exchange/poe2/`;
export const TRADE_LEAGUES_URL = `${TRADE_BASE_URL}/api/trade2/data/leagues`;
export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function repoParts(): { owner: string; repo: string } | null {
  const [owner, repo] = GITHUB_REPO.split('/');
  return owner && repo ? { owner, repo } : null;
}

export function dataBaseUrl(): string | null {
  const p = repoParts();
  return p ? `https://${p.owner}.github.io/${p.repo}/data` : null;
}

export function releasesApiUrl(): string | null {
  const p = repoParts();
  return p ? `https://api.github.com/repos/${p.owner}/${p.repo}/releases/latest` : null;
}

export function githubHostPermissions(): string[] {
  const p = repoParts();
  return p ? [`https://${p.owner}.github.io/*`, 'https://api.github.com/*'] : [];
}
