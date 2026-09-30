import { expect, test } from '@playwright/test';
import { KEYS, manyKeys, openFolderAndOrder, PREFIX, seed } from './fixture';

// Chaque test couvre un défaut catalogué en §1.5 du plan, et doit échouer sur un
// code qui ne le corrige pas.

test.describe('ordonnancement', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
  });

  test('1. enterOrderingMode ne rend qu\'une fois', async ({ page }) => {
    // Compter les appels plutôt que tester le rendu : un double appel est invisible
    // à l'œil, le résultat affiché est identique.
    await page.goto('/');
    const count = await page.evaluate(async (prefix) => {
      await navigateTo(prefix);
      // Attendre la FIN du chargement du dossier : navigateTo() vide allObjects,
      // donc allObjects non vide prouve que le renderGrid() de loadItems() a eu
      // lieu. Attendre « des cards visibles » ne suffirait pas : celles du dossier
      // racine seraient déjà là et le rendu du chargement serait compté avec
      // celui du mode — le test mesurerait le chargement, pas un doublon.
      await new Promise((r) => {
        const t = setInterval(() => {
          if (allObjects.length > 0) {
            clearInterval(t);
            r(undefined);
          }
        }, 20);
      });
      let n = 0;
      const orig = renderGrid;
      window.renderGrid = () => {
        n++;
        return orig();
      };
      await enterOrderingMode();
      return n;
    }, PREFIX);
    expect(count).toBe(1);
  });

  test('2. orderKeys survit à renderGrid', async ({ page }) => {
    await page.goto('/');
    const after = await page.evaluate(async (prefix) => {
      await navigateTo(prefix);
      await enterOrderingMode();
      const first = orderKeys[0];
      nudge(1, first);
      renderGrid();
      return { first, keys: orderKeys.slice(), n: orderKeys.length };
    }, PREFIX);

    expect(after.n).toBe(KEYS.length);
    expect(after.keys[1]).toBe(after.first);
  });

  test('3. sortir du mode ne laisse pas de filtre invisible', async ({ page }) => {
    await page.goto('/');
    const visible = await page.evaluate(async (prefix) => {
      await navigateTo(prefix);
      searchQuery = 'IMG_001';
      await enterOrderingMode();
      exitOrderingMode();
      return { q: searchQuery, shown: getSortedObjects().length };
    }, PREFIX);

    expect(visible.q).toBe('');
    // Sans cette remise à zéro, la grille sortirait amputée sans raison visible.
    expect(visible.shown).toBe(KEYS.length);
  });

  test('4. une clé absente de orderKeys n\'affiche pas de position', async ({ page }) => {
    await page.goto('/');
    const res = await page.evaluate(async (prefix) => {
      await navigateTo(prefix);
      await enterOrderingMode();
      // Retirer une clé de l'ordre : sa card ne doit porter AUCUN numéro, sinon
      // elle afficherait une position qui n'existe pas (le "1" par défaut d'un
      // posByKey.get() raté).
      const absent = orderKeys.pop();
      renderGrid();
      const card = document.querySelector(`.card[data-key="${absent}"]`);
      return {
        absent,
        badge: card?.querySelector('.card-order')?.textContent ?? null,
        total: document.querySelectorAll('.card-order').length,
      };
    }, PREFIX);

    expect(res.badge).toBeNull();
    expect(res.total).toBe(KEYS.length - 1);
  });

  test('5. le clic ne copie plus en mode ordonnancement', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openFolderAndOrder(page);
    await page.evaluate(() => navigator.clipboard.writeText(''));

    await page.locator('.card').first().click();
    await page.waitForTimeout(200);

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    // Le clic sur une card copie l'URL hors mode ; en mode il ne doit rien faire.
    expect(clip).toBe('');
  });

  test('6. le titre reste éditable pendant l\'ordonnancement', async ({ page }) => {
    await openFolderAndOrder(page);
    // Attrape la collision de sélecteur CSS : un .search-input réécrit sans le
    // préfixe .toolbar rendrait ce champ mort, et rien d'autre ne le signalerait.
    await expect(page.locator('#galleryTitle')).toBeEnabled();
    await page.locator('#galleryTitle').fill('Soirée disco');
    await expect(page.locator('#galleryTitle')).toHaveValue('Soirée disco');
  });

  test('7. les exports suivent l\'ordre choisi', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openFolderAndOrder(page);

    const chosen = await page.evaluate(() => {
      const wanted = [orderKeys[2], orderKeys[0], orderKeys[3], orderKeys[1]];
      orderKeys = wanted.slice();
      renderGrid();
      return wanted;
    });

    await page.locator('#exportUrlsBtn').click();
    const urls = await page.evaluate(() => navigator.clipboard.readText());
    const lines = urls.split('\n').filter(Boolean);
    expect(lines).toHaveLength(KEYS.length);
    lines.forEach((u, i) => expect(u.endsWith(chosen[i])).toBe(true));

    await page.locator('#galleryTitle').fill('Soirée disco');
    await page.locator('#exportMdBtn').click();
    const md = await page.evaluate(() => navigator.clipboard.readText());
    // La couverture est la première image de l'ordre choisi, pas du tri naturel.
    expect(md).toContain('images: |');
    expect(md).toContain('draft: false');
    expect(md).toContain('  https://media.quofai.org/' + chosen[0]);
    expect(md.indexOf(chosen[0])).toBeLessThan(md.indexOf(chosen[1]));
  });

  test('8. le badge reflète la position après un déplacement', async ({ page }) => {
    await openFolderAndOrder(page);
    const before = await page.evaluate(() => orderKeys[0]);
    await page.evaluate(() => nudge(1, orderKeys[0]));
    const texts = await page.locator('.card-order').allTextContents();
    expect(texts[1]).toBe('2');
    expect(await page.evaluate(() => orderKeys[1])).toBe(before);
  });

  test('9. Échap quitte le mode après confirmation si l\'ordre a été touché', async ({ page }) => {
    await openFolderAndOrder(page);
    page.once('dialog', (d) => void d.dismiss());
    await page.evaluate(() => {
      orderTouched = true;
    });
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => orderingMode)).toBe(true);

    page.once('dialog', (d) => void d.accept());
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => orderingMode)).toBe(false);
  });

  test('11. une clé absente de orderKeys reste exportée', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openFolderAndOrder(page);
    // orderKeys volontairement amputée : la clé retirée doit TOUJOURS être
    // exportée, sinon l'image disparaît silencieusement du YAML — un export
    // valide et faux.
    const dropped = await page.evaluate(() => {
      const gone = orderKeys.pop();
      renderGrid();
      return gone;
    });
    await page.locator('#exportUrlsBtn').click();
    const urls = await page.evaluate(() => navigator.clipboard.readText());
    expect(urls.split('\n').filter(Boolean)).toHaveLength(KEYS.length);
    expect(urls).toContain(dropped!);
  });

  test('10. un dossier navigation hors mode n\'est pas présenté comme trié', async ({ page }) => {
    // Contre-exemple du test 7 : SANS ordre choisi, les exports doivent suivre le
    // tri naturel. Si ce test échoue, orderedObjects() influencerait tout.
    await page.goto('/');
    await page.evaluate(async (prefix) => {
      await navigateTo(prefix);
    }, PREFIX);
    await page.evaluate(() => {
      currentSort = 'name';
      orderKeys = [];
      renderGrid();
    });
    const shown = await page.evaluate(() => getSortedObjects().map((o) => o.key));
    expect(shown).toEqual([...shown].sort());
  });

  // Un dossier de plus de 100 photos est le cas ordinaire d'un gros événement.
  // fetchAllObjects() boucle sur `truncated` avec un curseur : si cette boucle est
  // cassée, l'éditeur voit 100 photos au lieu de 254, ET l'export n'en contient
  // que 100 — une perte SILENCIEUSE, sans aucun message.
  //
  // On éprouve fetchAllObjects()/orderedObjects() directement au lieu de passer
  // par le mode ordonnancement : rendre 254 cartes déclencherait 254 requêtes
  // vers media.quofai.org, et le testerait sur le réseau au lieu de la pagination.
  test('12. la pagination /api/list est parcourue jusqu\'au bout', async ({ page }) => {
    const bulk = manyKeys(250);
    await seed(page, bulk); // 4 + 250 = 254 objets => 3 pages de 100/100/54
    await page.goto('/');
    const res = await page.evaluate(async (prefix) => {
      const all = await fetchAllObjects(prefix);
      const server = all.map((o) => o.key);
      // L'ordre demandé est l'inverse de l'ordre serveur, ce qui ne peut pas
      // coïncider par hasard avec un tri.
      const wanted = server.slice().reverse();
      orderKeys = wanted;
      return {
        server,
        fetched: all.length,
        distinct: new Set(server).size,
        ordered: orderedObjects(all).map((o) => o.key),
        wanted,
      };
    }, PREFIX);
    expect(res.fetched).toBe(254);
    expect(res.distinct).toBe(254); // aucun doublon entre pages
    expect(res.ordered).toHaveLength(254);
    // L'égalité avec l'inverse de l'ordre serveur prouve que la dernière page a
    // été atteinte ET qu'elle est ordonnée : une boucle cassée tronque à 100 et
    // les deux assertions tombent.
    expect(res.ordered).toEqual(res.wanted);
  });
  test('13. le bouton YAML a disparu du DOM', async ({ page }) => {
    await openFolderAndOrder(page);
    // buildYaml() reste, buildMarkdown() l'appelle : seul l'affordance est retiree,
    // parce que le YAML ecrase titre et date quand les champs sont vides alors que
    // title est required dans .pages.yml.
    await expect(page.locator('#exportYamlBtn')).toHaveCount(0);
    await expect(page.locator('#exportUrlsBtn')).toBeVisible();
    await expect(page.locator('#exportMdBtn')).toBeVisible();
  });

  test('14. « Comment publier ? » déplie le mode d\'emploi', async ({ page }) => {
    await openFolderAndOrder(page);
    const panel = page.locator('#orderHelpPanel');
    await expect(panel).toBeHidden();
    await expect(page.locator('#orderHelpBtn')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#orderHelpBtn').click();
    await expect(panel).toBeVisible();
    await expect(page.locator('#orderHelpBtn')).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toContainText('Photo de couverture');
    await page.locator('#orderHelpBtn').click();
    await expect(panel).toBeHidden();
  });

  test('15. le titre propose le dossier courant sans le pré-remplir', async ({ page }) => {
    await openFolderAndOrder(page);
    const input = page.locator('#galleryTitle');
    const folder = PREFIX.replace(/\/+$/, '').split('/').pop();
    // pré-remplir la valeur publierait un libellé interne comme titre public.
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', 'Par exemple « ' + folder + ' »');
  });

});
