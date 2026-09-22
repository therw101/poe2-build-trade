import { maxrollAdapter } from '../src/adapters/maxroll.ts';
import { runSite } from '../src/site/runtime.ts';

export default defineContentScript({
  matches: ['https://maxroll.gg/poe2/*'],
  runAt: 'document_idle',
  main: (ctx) => runSite(ctx, maxrollAdapter),
});
