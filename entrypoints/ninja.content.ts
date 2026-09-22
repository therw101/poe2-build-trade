import { ninjaAdapter } from '../src/adapters/ninja.ts';
import { runSite } from '../src/site/runtime.ts';

export default defineContentScript({
  matches: ['https://poe.ninja/poe2/builds/*'],
  runAt: 'document_idle',
  main: (ctx) => runSite(ctx, ninjaAdapter),
});
