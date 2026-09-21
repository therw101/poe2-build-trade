import { defineConfig } from 'wxt';
import { githubHostPermissions } from './src/config';

export default defineConfig({
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage'],
    host_permissions: [
      'https://planners.maxroll.gg/*',
      'https://www.pathofexile.com/api/trade2/data/*',
      ...githubHostPermissions(),
    ],
  },
});
