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

// Un dossier de N photos synthétisées, toutes directement sous PREFIX (pas de
// sous-dossier : avec delimiter:'/', R2 renverrait un sous-dossier dans
// `prefixes` et non dans `objects`, le mock doit rester fidèle à ça).
// Numérotation décroissante : l'ordre du serveur est donc l'inverse de
// l'ordre alphabétique, comme pour KEYS.
export function manyKeys(count: number): string[] {
  const pad = String(count).length + 1;
  return Array.from({ length: count }, (_, i) => `${PREFIX}BULK_${String(count - i).padStart(pad, '0')}.jpg`);
}

// Reproduit la pagination de R2 : /api/list rend AU PLUS `limit` objets et
// signale `truncated` tant qu'il en reste, avec un curseur opaque.
// Sans cela, fetchAllObjects() ne ferait qu'un seul tour dans TOUS les tests :
// une boucle while (hasMore) cassée (curseur ignoré, truncated ignoré) ne
// serait détectée par aucun test, alors qu'un dossier de plus de 100 photos est
// le cas ordinaire d'un gros événement.
export async function seed(page: Page, extraKeys: string[] = []) {
  await page.route('**/api/list*', (route) => {
    const url = new URL(route.request().url());
    const prefix = url.searchParams.get('prefix') ?? '';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '', 10) || 24, 1), 100);
    const listed = (key: string): Listed => ({
      key,
      size: 1024,
      uploaded: '2026-01-02T03:04:05.000Z',
      contentType: 'image/jpeg',
    });
    const all = [...objectsFor(prefix), ...extraKeys.filter((k) => k.startsWith(prefix)).map(listed)];
    // Curseur = index du premier objet restant (R2 renvoie un jeton opaque ;
    // une chaîne suffit à prouver que la boucle le relaie correctement).
    const start = parseInt(url.searchParams.get('cursor') ?? '', 10) || 0;
    const page = all.slice(start, start + limit);
    const truncated = start + limit < all.length;
    return route.fulfill({
      json: {
        objects: page,
        prefixes: [],
        cursor: truncated ? String(start + limit) : null,
        truncated,
      },
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
