import { mobalyticsAdapter } from '../src/adapters/mobalytics.ts';
import { runSite } from '../src/site/runtime.ts';

export default defineContentScript({
  matches: ['https://mobalytics.gg/poe-2/*'],
  runAt: 'document_idle',
  main: (ctx) => runSite(ctx, mobalyticsAdapter),
});
