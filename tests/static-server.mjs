// Serveur statique minimal pour le harnais : sert la page rendue depuis src/ui.ts
// et répond 404 JSON à /api/*, que les tests interceptent via page.route().
// Évite d'avoir à lancer workerd (macOS 13.5+ requis) pour tester le rendu et
// l'ordonnancement, qui sont entièrement côté client.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(resolve(here, '../.playwright-fixture/index.html'));

const port = Number(process.env.PORT || 8788);

createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    // Aucun test ne doit atteindre le réseau : si une route n'est pas interceptée,
    // on le rend visible immédiatement au lieu d'attendre un vrai serveur.
    res.writeHead(501, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'API non interceptée dans le harnais statique' }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page);
}).listen(port, '127.0.0.1', () => {
  console.log(`harnais statique sur http://127.0.0.1:${port}`);
});
