import { ninjaAdapter } from '../src/adapters/ninja.ts';
import { runSite } from '../src/site/runtime.ts';

export default defineContentScript({
  matches: ['https://poe.ninja/poe2/builds/*', 'https://poe.ninja/poe2/pob/*'],
  runAt: 'document_idle',
  main: (ctx) => runSite(ctx, ninjaAdapter),
});
