import type { Page } from '@playwright/test';

// L'ordre du tableau est DÉLIBÉRÉMENT à l'inverse de l'ordre voulu : si le tri par
// nom et l'ordre manuel donnaient le même résultat, un test pourrait passer pour la
// mauvaise raison (on ne prouverait pas que c'est l'ordre manuel qui agit).
export const KEYS = [
  'galleries/2026-test/IMG_004.jpg',
  'galleries/2026-test/IMG_001.jpg',
  'galleries/2026-test/IMG_003.jpg',
  'galleries/2026-test/IMG_002.jpg',
];

export const PREFIX = 'galleries/2026-test/';

type Listed = { key: string; size: number; uploaded: string; contentType: string };

function objectsFor(prefix: string): Listed[] {
  return KEYS.filter((k) => k.startsWith(prefix)).map((key) => ({
    key,
    size: 1024,
    uploaded: '2026-01-02T03:04:05.000Z',
    contentType: 'image/jpeg',
  }));
}

// Intercepter /api/list plutôt qu'écrire dans R2 rend les tests d'ordonnancement
// instantanés et sans état. Reste à utiliser pour l'upload, où le serveur est
// justement ce qu'on veut éprouver.
export async function seed(page: Page) {
  await page.route('**/api/list*', (route) => {
    const url = new URL(route.request().url());
    const prefix = url.searchParams.get('prefix') ?? '';
    return route.fulfill({
      json: { objects: objectsFor(prefix), prefixes: [], cursor: null, truncated: false },
    });
  });
}

// Entre dans le mode ordonnancement depuis l'UI réelle (et non via un appel direct
// à enterOrderingMode) : le clic est le chemin que suit l'utilisateur, et il
// traverse applyOrderingChrome(), qui fait partie de ce qu'on veut couvrir.
export async function openFolderAndOrder(page: Page) {
  await page.goto('/');
  await page.evaluate(async (prefix) => {
    await navigateTo(prefix);
  }, PREFIX);
  await page.locator('#orderBtn').click();
  await page.locator('#orderBar').waitFor({ state: 'visible' });
}
