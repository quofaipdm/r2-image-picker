// Rend réellement src/ui.ts puis écrit la page HTML émise dans .playwright-fixture/.
// But : le harnais doit tourner SANS workerd, qui exige macOS 13.5+ alors que le
// poste de dev est en 12.6. La page étant du HTML statique + un <script> inline,
// un petit serveur Node suffit ; les endpoints /api/* sont interceptés par les
// tests. Les tests qui veulent vraiment le worker sont opt-in (REAL_WORKER=1).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const { renderUI } = await import(pathToFileURL(resolve(root, 'src/ui.ts')).href);

const env = {
  MEDIA_BUCKET: null,
  PUBLIC_R2_BASE_URL: 'https://media.quofai.org',
  ALLOWED_EXTENSIONS: 'jpg,jpeg,png,webp,gif,avif,svg',
  WEIGHT_WARNING_BYTES: '3000000',
  MAX_UPLOAD_BYTES: '4194304',
};

const html = await renderUI(env).text();

const outDir = resolve(root, '.playwright-fixture');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html);
console.log(`fixture: ${outDir}/index.html (${html.length} octets)`);
