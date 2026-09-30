import { defineConfig } from '@playwright/test';

// Deux modes, choisis par REAL_WORKER=1 :
//   - par défaut : page rendue depuis src/ui.ts par un serveur Node, /api/*
//     intercepté. workerd exige macOS 13.5+ ; le poste de dev est en 12.6.
//   - REAL_WORKER=1 : `wrangler dev`, donc le VRAI worker et son R2 local.
const realWorker = process.env.REAL_WORKER === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // Volontaire : les tests d'ordonnancement partagent un état de page, et le R2
  // local de wrangler n'est pas conçu pour des writers concurrents.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: realWorker ? 'http://127.0.0.1:8787' : 'http://127.0.0.1:8788',
    trace: 'retain-on-failure',
  },
  webServer: realWorker
    ? {
        command: 'npm run dev',
        url: 'http://127.0.0.1:8787',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : {
        // --experimental-strip-types : src/ui.ts est du TypeScript, importé
        // directement. Sans lui, Node refuse l'extension .ts.
        command:
          'node --experimental-strip-types --no-warnings tests/build-fixture.mjs && node tests/static-server.mjs',
        url: 'http://127.0.0.1:8788',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
