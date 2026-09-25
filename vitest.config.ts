// vitest.config.ts — unit tests only. The app build config lives in vite.config.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // `shared/alertRules.mjs` and `functions/src/*.ts` are imported directly by
    // the suites, so one runner covers client math, rule engine and server
    // payment guards without three separate setups.
  },
});
