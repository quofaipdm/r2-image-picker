import { expect, test } from '@playwright/test';

// Upload : ici on éprouve le VRAI serveur (R2 local de `wrangler dev`) ou une
// interception réseau. Aucun binaire dans le dépôt : les fichiers sont créés à
// l'exécution, conformément aux règles du projet.

// Ces deux tests soumettent une requête au worker pour lire son code HTTP : ils
// n'ont de sens qu'avec le vrai serveur (REAL_WORKER=1), sinon ils verraient le
// 501 du harnais statique.
const needsWorker = () => test.skip(!process.env.REAL_WORKER, 'nécessite REAL_WORKER=1 (wrangler dev)');

function jpeg(name: string, bytes = 1024) {
  // En-tête JPEG minimal : suffisant pour donner un type MIME et une taille
  // crédibles au worker, qui ne décode pas l'image.
  const body = Buffer.alloc(bytes, 0x41);
  return {
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), body, Buffer.from([0xff, 0xd9])]),
  };
}

// goto() et seulement goto(). Les patchs XHR doivent être posés APRÈS : la
// navigation recharge la page et réinitialise window, ce qui effacerait
// silencieusement __timeouts / __xhrs et ferait échouer le test pour une raison
// absente du code testé.
async function loadThen(page: import('@playwright/test').Page) {
  await page.goto('/');
}

test.describe('upload', () => {
  test('U1 — les URL copiées suivent l\'ordre de sélection', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // goto() d'abord : about:blank n'est pas un contexte sécurisé, donc
    // navigator.clipboard y est undefined.
    await page.goto('/');
    await page.evaluate(() => navigator.clipboard.writeText(''));

    // L'URL de réponse porte le nom de fichier reçu : on peut donc vérifier que
    // l'ordre COPIÉ est celui de la SÉLECTION, et pas celui des arrivées réseau.
    await page.route('**/api/upload', async (route) => {
      const raw = route.request().postDataBuffer()?.toString('latin1') ?? '';
      const name = /filename="([^"]+)"/.exec(raw)?.[1] ?? 'unknown';
      // Délai inversé par rapport à la position : le dernier fichier choisi répond
      // en premier. Un `results.push()` donnerait alors une liste retournée.
      const pos = Number(/sel-(\d+)/.exec(name)?.[1] ?? 0);
      await new Promise((r) => setTimeout(r, (11 - pos) * 12));
      return route.fulfill({
        json: { key: 'galleries/test-upload/' + name, url: 'https://media.quofai.org/' + name, size: 1 },
      });
    });

    const names = Array.from({ length: 12 }, (_, i) => `sel-${String(i).padStart(2, '0')}.jpg`);
    await page.evaluate(() => openUploadModal());
    await page.locator('#fileInput').setInputFiles(names.map((n) => jpeg(n)));
    await expect(page.locator('#uploadSubmitBtn')).toBeEnabled();
    await page.locator('#uploadSubmitBtn').click();
    await expect(page.locator('.toast')).toContainText('upload', { timeout: 30_000 });

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const lines = clip.split('\n').filter(Boolean);
    expect(lines).toEqual(names.map((n) => 'https://media.quofai.org/' + n));
  });

  test('U11 — chaque requête d\'upload arme un délai maximal', async ({ page }) => {
    await loadThen(page);
    await page.evaluate(() => {
      const w = window as unknown as { __timeouts: number[] };
      w.__timeouts = [];
      const d = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'timeout')!;
      Object.defineProperty(XMLHttpRequest.prototype, 'timeout', {
        get() {
          return d.get!.call(this);
        },
        set(v: number) {
          w.__timeouts.push(v);
          d.set!.call(this, v);
        },
      });
    });
    await page.evaluate(() => openUploadModal());
    await page.locator('#fileInput').setInputFiles([jpeg('a.jpg'), jpeg('b.jpg')]);
    await expect(page.locator('#uploadSubmitBtn')).toBeEnabled();
    await page.locator('#uploadSubmitBtn').click();
    await expect(page.locator('#uploadSubmitBtn')).toBeDisabled();
    // Sans cette valeur, une requête figée ne résout jamais et le bouton reste
    // désactivé définitivement.
    await expect.poll(() => page.evaluate(() => (window as any).__timeouts.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as any).__timeouts)).toContain(120000);
  });

  test('U11 — un timeout fait relâcher le verrou d\'upload', async ({ page }) => {
    // Jamais résolu : c'est le scénario U11 (page d'authentification Cloudflare).
    await page.route('**/api/upload', () => new Promise(() => {}));
    await loadThen(page);
    await page.evaluate(() => {
      const w = window as unknown as { __xhrs: XMLHttpRequest[] };
      w.__xhrs = [];
      const orig = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
        w.__xhrs.push(this);
        // @ts-expect-error signature variadique volontairement permise
        return orig.apply(this, args);
      };
    });
    await page.evaluate(() => openUploadModal());
    await page.locator('#fileInput').setInputFiles([jpeg('bloque.jpg')]);
    await expect(page.locator('#uploadSubmitBtn')).toBeEnabled();
    await page.locator('#uploadSubmitBtn').click();

    await expect.poll(() => page.evaluate(() => (window as any).__xhrs.length)).toBeGreaterThan(0);
    // Simule l'expiration du délai : ontimeout doit résoudre le uploadOne().
    await page.evaluate(() => {
      const xhr = (window as any).__xhrs[0];
      xhr.dispatchEvent(new Event('timeout'));
    });
    await expect.poll(() => page.evaluate(() => uploading), { timeout: 10_000 }).toBe(false);
  });

  test('U2 — re-sélectionner le même fichier deux fois de suite', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => openUploadModal());
    await page.locator('#fileInput').setInputFiles([jpeg('meme.jpg')]);
    const first = await page.locator('#uploadFileList').textContent();
    await page.locator('#fileInput').setInputFiles([jpeg('meme.jpg')]);
    const second = await page.locator('#uploadFileList').textContent();
    // Sans le reset de `value`, le navigateur ne déclencherait aucun `change` et
    // la seconde sélection serait silencieusement ignorée.
    expect(second).toBe(first);
    expect(second).toContain('meme.jpg');
  });

  test('un .txt est refusé en 415', async ({ page }) => {
    needsWorker();
    await page.goto('/');
    const status = await page.evaluate(async () => {
      const fd = new FormData();
      fd.append('file', new File(['nope'], 'notes.txt', { type: 'text/plain' }));
      fd.append('prefix', 'galleries/test-upload/');
      return (await fetch('/api/upload', { method: 'POST', body: fd })).status;
    });
    expect(status).toBe(415);
  });

  test('HEIC refusé en 415 — choix produit assumé', async ({ page }) => {
    needsWorker();
    await page.goto('/');
    const status = await page.evaluate(async () => {
      const fd = new FormData();
      fd.append('file', new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' }));
      fd.append('prefix', 'galleries/test-upload/');
      return (await fetch('/api/upload', { method: 'POST', body: fd })).status;
    });
    expect(status).toBe(415);
  });

  test('un dossier déposé est aplati : seuls les fichiers, extensions conservées', async ({ page }) => {
    await page.goto('/');
    const names = await page.evaluate(async () => {
      // Reproduit ce que filesFromDrop() renvoie pour un dossier contenant des
      // sous-dossiers : des File, pas une arborescence.
      const files = [
        new File(['a'], 'IMG_1.jpg', { type: 'image/jpeg' }),
        new File(['b'], 'IMG_2.jpg', { type: 'image/jpeg' }),
        new File(['c'], 'IMG_3.jpeg', { type: 'image/jpeg' }),
      ];
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      const out = await filesFromDrop(dt);
      return out.map((f: File) => f.name);
    });
    // Le même nom dans deux sous-dossiers deviendrait un doublon : le serveur
    // renomme, il n'écrase pas. Ici on vérifie surtout qu'aucun chemin ne subsiste.
    expect(names).toEqual(['IMG_1.jpg', 'IMG_2.jpg', 'IMG_3.jpeg']);
  });

  // Plan §27 : un dossier de 600 fichiers doit être refusé EN BLOC, avec le
  // motif — pas 500 rejets isolés, et surtout rien n'est envoyé.
  test('U5 — un lot de plus de 500 fichiers est refuse en bloc, rien n\'est envoye',
    async ({ page }) => {
      await loadThen(page);
      const sent = await page.evaluate(async () => {
        let requests = 0;
        const realOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (m: string, ...rest: unknown[]) {
          requests++;
          // @ts-expect-error signature volontairement partielle
          return realOpen.call(this, m, ...rest);
        };
        try {
          openUploadModal();
          // Faux objets : selectFiles() ne lit que name/size/type, inutile
          // de transférer 600 vrais blobs via le protocole du navigateur.
          const many = Array.from({ length: 600 }, (_, i) => ({
            name: `burst-${String(i).padStart(3, '0')}.jpg`,
            size: 1024,
            type: 'image/jpeg',
          }));
          // @ts-expect-error les faux objets suffisent au filtrage
          selectFiles(many);
          return {
            requests,
            selected: selectedFiles.length,
            rejections: summarizeFailures(rejectedFiles),
          };
        } finally {
          XMLHttpRequest.prototype.open = realOpen;
        }
      });
      expect(sent.selected).toBe(0);
      expect(sent.requests).toBe(0);
      expect(sent.rejections).toContain('max 500');
    });

  test('U5bis — 200 Mo cumules refuses, un lot sous les deux plafonds passe',
    async ({ page }) => {
      await loadThen(page);
      const res = await page.evaluate(() => {
        const mb = 1024 * 1024;
        const mk = (n: number, size: number) => Array.from({ length: n }, (_, i) => ({
          name: `w-${i}.jpg`, size, type: 'image/jpeg',
        }));
        // 51 x 4 Mo = 204 Mo : sous 500 fichiers, au-dessus de 200 Mo.
        selectFiles(mk(51, 4 * mb));
        const over = { selected: selectedFiles.length, why: summarizeFailures(rejectedFiles) };
        // 20 x 4 Mo = 80 Mo : passe.
        selectFiles(mk(20, 4 * mb));
        return { over, under: { selected: selectedFiles.length, why: summarizeFailures(rejectedFiles) } };
      });
      expect(res.over.selected).toBe(0);
      expect(res.over.why).toContain('200 Mo');
      expect(res.under.selected).toBe(20);
      expect(res.under.why).not.toContain('200 Mo');
    });

  // readEntries() rend ~100 entrées par appel et [] quand c'est fini. Une seule
  // itération renverrait 100 fichiers sur 203 SANS lever d'erreur : l'éditeur
  // croirait avoir tout uploadé. Impossible de déclencher ça avec un vrai
  // dossier (un DataTransfer JS ne peut pas contenir de répertoire), donc on
  // injecte un faux lecteur qui pagine comme le vrai.
  test('U6 — un dossier de plus de 100 entrees est lu en entier', async ({ page }) => {
    await loadThen(page);
    const res = await page.evaluate(async () => {
      // Répertoire racine : 150 entrées, donc 2 pages (100 + 50).
      // Sous-dossier 'sub' : 50 entrées, 1 page. + 3 fichiers à la racine.
      const rootNames = Array.from({ length: 150 }, (_, i) => `R${String(i).padStart(3, '0')}.jpg`);
      const subNames = Array.from({ length: 50 }, (_, i) => `S${String(i).padStart(3, '0')}.jpg`);
      const fileEntry = (name: string) => ({
        isFile: true, isDirectory: false, name,
        file: (res: (f: File) => void) => res(new File(['x'], name, { type: 'image/jpeg' })),
      });
      const dirEntry = (name: string, children: unknown[], chunk = 100) => ({
        isFile: false, isDirectory: true, name,
        createReader: () => {
          let i = 0;
          return {
            // Le lot est figé à l'appel, le rappel est asynchrone : c'est le contrat de
            // la vraie API. Lire `i` dans le setTimeout renverrait la même page
            // à chaque appel (et une page vide pour un dossier de < chunk).
            readEntries: (cb: (e: unknown[]) => void) => {
              const batch = children.slice(i, i + chunk);
              i += chunk;
              setTimeout(() => cb(batch), 0);
            },
          };
        },
      });
      const dt = {
        items: [
          { kind: 'file', webkitGetAsEntry: () => dirEntry('root', [...rootNames.map(fileEntry), dirEntry('sub', subNames.map(fileEntry)), fileEntry('a.jpg'), fileEntry('b.jpg'), fileEntry('c.jpg')]) },
        ],
        files: [],
      };
      const out = await filesFromDrop(dt);
      return { count: out.length, names: out.map((f: File) => f.name) };
    });
    expect(res.count).toBe(203);
    // Les 150 de la racine doivent être là : c'est la page que la boucle perdrait.
    expect(res.names.filter((n) => n.startsWith('R1')).length).toBe(50);
    expect(res.names).toContain('S000.jpg');
    expect(res.names).toContain('a.jpg');
    // Aplatissement : aucun chemin ne doit subsister dans un nom.
    expect(res.names.some((n) => n.includes('/'))).toBe(false);
  });
});
