# Plan 15 — Ordonnancement visuel + export de galerie dans r2-image-picker

> Repo cible : `r2-image-picker/` (repo Git autonome, Worker Cloudflare)
> Projet consumer : `qfpdm/` (Astro 6 statique)
> Statut : plan prêt à implémenter — aucune modification effectuée à ce jour
> Date : septembre 2026

> ## ⚡ Exécution par swarm — commencer ici
>
> Ce fichier est la **référence de raisonnement** (audits, décisions, pièges,
> annexe des références). Pour implémenter, lire d'abord
> **`15_0-index-and-shared-context.md`**, puis **un seul** des cinq fichiers de
> tâche :
>
> | Fichier | Agent | Tâches |
> |---|---|---|
> | `15_1_upload-order-p1.md` | A | T10 — ordre des URL après upload (P1 préexistant) |
> | `15_2_folder-upload.md` | B | T11, T12, T13 — upload de dossier + garde-fous |
> | `15_3_ordering-state-and-render.md` | C | T1–T5 — état, rendu, drag |
> | `15_4_ordering-export-and-docs.md` | D | T6–T9 — export + doc ordonnancement |
> | `15_5_docs-upload-and-verify.md` | E | T14 + 33 tests + docs finales |
>
> A, B et C sont parallèles (zones disjointes de `src/ui.ts`). D dépend de C.
> E dépend de tout le monde. Ordre de merge : A → B → C → D → E.

---

## 0. Synthèse — réponse à la question

**« Ordered_complexité de l'ajout d'un ordonnancement visuel + export de galerie ? »**

**Faible à modérée, entièrement dans du code que nous possédons déjà.**

| Question | Réponse |
|---|---|
| Nouveau endpoint API ? | **Non.** Tout est côté client dans `src/ui.ts` |
| Nouveau fichier source ? | **Non.** `src/ui.ts` (+ `src/upload.ts` si et seulement si T13/U6 est retenu) |
| Nouvelle dépendance ? | **Non.** Vanilla JS, zéro package |
| Changement dans `qfpdm/` ? | **Déjà fait** — `.pages.yml` corrigé le 30/09/2026 (`type: list` → `type: text`, cf. §1.4). Aucune dépendance pour le drag & export |
| Complexité réelle | **Le piège est `renderGrid()` qui reconstruit `innerHTML`** — l'ordre manuel doit vivre dans un tableau séparé, sinon le tri et la recherche le détruisent à chaque rendu |
| Difficulté mobile | **Écartée.** Voir §9 — boutons ↑/↓ seulement |
| Upload de dossier ? | **Bonne idée, faible coût** (~80–110 lignes, §1.6). Aplatissement retenu, zéro changement serveur |
| Défaut préexistant trouvé en relisant ? | **Oui, un P1** : les URL copiées après upload sortent dans l'ordre d'arrivée réseau, pas de sélection (§1.5, U1). Corrigible en 3 lignes, mais à faire en premier |

Charge estimée : **deux sessions**. La première pour T10 (le P1 préexistant, §1.5) et
T11–T14 (upload), qui sont indépendants de l'ordonnancement. La seconde pour
T1–T9. Couvrir ces deux blocs dans une seule session est la façon la plus simple
de ne pas valider T1–T9 avant d'avoir vu T10 en conditions réelles.

**Pourquoi c'est peu cher :** `r2-image-picker` est un Worker de 1 045 lignes, vanilla, que
nous écrivons. Le chargement exhaustif d'un dossier existe **déjà** dans
`copyAllUrls()` (`src/ui.ts:860-887`) et sera factorisé. La génération du texte
à copier est une fonction pure. Aucun mécanisme serveur n'est requis.

**Pourquoi ce n'est pas *trivialement* simple :** le code actuel est conçu autour
d'un modèle « dossier = ensemble non ordonné, trié à l'affichage ». Passer à
« dossier = liste ordonnée manuellement » impose d'introduire une machine à
états, de neutraliser le tri et la recherche, de supprimer le clic-pour-copier
qui entre en conflit avec le drag, et de réconcilier le système de focus clavier
(`focusedGridIndex`, `src/ui.ts:812-832`) qui indexe le DOM — index invalidé à
chaque réordonnancement.

Et la relecture du chemin d'upload a montré que le problème est plus ancien que
la fonctionnalité : l'ordre arbitraire existe déjà dans le code de production (§1.5).

---

## 1. Contexte

### 1.1 L'outil actuel

`r2-image-picker/src/ui.ts` est une fonction unique `renderUI(env: Env): Response`
(`src/ui.ts:3`) qui renvoie une chaîne HTML complète, CSS inline + `<script>`
inline. `src/index.ts` route quatre endpoints : `GET /api/list`, `POST /api/upload`,
`GET /api/tree`, `POST /api/tree/folder`.

| Élément | Emplacement |
|---|---|
| Génération HTML + CSS + JS | `src/ui.ts:3-1044` (une seule fonction) |
| Conversion clé R2 → URL publique | `publicUrl()` `src/ui.ts:236-238` |
| État global | `src/ui.ts:240-283` |
| Tri + recherche | `getSortedObjects()` `src/ui.ts:395-420` |
| Rendu de la grille | `renderGrid()` `src/ui.ts:422-471` |
| Clic = copier l'URL | `copyUrl()` `src/ui.ts:473-484` |
| Pagination (24/page) | `loadItems()` `src/ui.ts:486-524` |
| Focus clavier sur la grille | `src/ui.ts:812-832` |
| Copie de toutes les URLs du dossier | `copyAllUrls()` `src/ui.ts:860-887` |
| Raccourcis clavier globaux | `src/ui.ts:986-1030` |

Déploiement : `.github/workflows/deploy.yml` — `npm ci` puis `npx wrangler deploy`
sur push `main`. **Pas d'étape de build front** : le script client est un template
literal (§8.1).

### 1.2 Le flux éditeur actuel — le problème à résoudre

`GUIDE_Editeur.md` §3.2 (lignes 154-173) décrit la séquence actuelle pour une
galerie de 40 photos :

1. Ouvrir la Médiathèque, dossier `galleries/2026-06-concert/`
2. Cliquer **Copier les URLs** (`src/ui.ts:166`, handler `src/ui.ts:860`)
3. Ouvrir Page CMS → Galeries → Nouvelle entrée
4. Coller le bloc d'URLs dans le champ **Images**
5. **Réordonner à la main** : « déplacez les lignes vers le haut ou le bas »
   (`GUIDE_Editeur.md:171`)

Le problème est double :

- **L'ordre du picker est arbitraire.** `getSortedObjects()` trie par nom /
  date / poids. Deux options : nom (`PICT0003` … `PICT0098`, ordre photographique
  réel si les fichiers sont bien numérotés) ou date d'upload R2. L'éditeur doit
  donc marquer mentalement l'ordre voulu, le laisser dans le presse-papier, puis
  le réordonner ligne par ligne dans le CMS. Sur 40 photos : plusieurs minutes
  et un risque d'erreur.
- **Le presse-papiers est le seul canal.** Si l'éditeur upload 30 nouvelles photos
  dans un dossier existant (complément de galerie), il doit identifié manuellement
  quelles 12 sont les nouvelles — impossible, l'export copie tout le dossier.

### 1.3 Découverte majeure — les dimensions ne sont PLUS requises

**Vérifié sur toute la chaîne de rendu.** Conséquence directe : l'export n'a
**pas besoin** de mesurer les dimensions, ce qui supprime le poste de coût le
plus lourd de la fonctionnalité.

| Étape | Fichier : ligne | Constat |
|---|---|---|
| Couverture de card | `qfpdm/src/components/CardCover.astro:16-17` | `width: _origW, height: _origH` sont déstructurés et **jamais utilisés**. Toujours `displayW = 800`, `displayH = 800/aspectRatio` (l.22-24) |
| Grille galerie | `qfpdm/src/components/GalleryGrid.astro:23` | `getImageSize(undefined, undefined)` → `{w: undefined, h: undefined}` |
| Attributs PhotoSwipe | `GalleryGrid.astro:29-30` | `data-pswp-width={size.w ?? 0}` → `0` |
| Initialisation lightbox | `qfpdm/src/layouts/Layout.astro:96-100` | `if (a.dataset.pswpWidth === '0' …)` → recharge via `new Image()` et remplit `naturalWidth`/`naturalHeight` **avant** `lightbox.init()` |
| `<Image>` unpic | `GalleryGrid.astro:36-37` | `width={400} height={300}` en dur, indépendant du frontmatter |

**Conclusion :** `coverWidth` / `coverHeight` sont du ballast mort. Sur les 13
galeries existantes, 7 ne les renseignent pas — et le site fonctionne. L'export
peut donc émettre le format `images: |` le plus simple, sans aucune sonde
`new Image()`.

>.side-note Un nettoyage opportun : `coverWidth` / `coverHeight` pourraient être
> retirés de `.pages.yml` et de `content.config.ts`. **Hors périmètre de ce plan.**

### 1.4 Découverte secondaire — `type: list` est un type de champ *inexistant* dans Page CMS

> **Statut : corrigé le 30 septembre 2026.** Analyse, décision et vérification ci-dessous.

`qfpdm/.pages.yml` déclarait `type: list` sur **trois** champs :

| Champ | Ligne | Fichiers concernés |
|---|---|---|
| `galleries.images` | 78-86 | 13 fichiers, tous en `images: \|` |
| `articles.galleryRef` | 29-33 | 4 fichiers, tous en `galleryRef: <url>` |
| `pages.galleryRef` | 50-54 | 0 fichier (champ inutilisé) |

Or **`list` n'est pas un type de champ enregistré** dans Page CMS v2. Le registre
(`fields/registry.ts`) n'expose que : `boolean`, `code`, `date`, `file`, `image`,
`number`, `reference`, `rich-text`, `select`, `string`, `text`, `uuid` — plus `object`
et `block` pour l'imbrication. `list` existe comme **propriété de configuration**
(`list: true` sur un `type: object`), pas comme type.

#### Pourquoi ça n'a rien cassé jusqu'ici

Deux replis successifs masquent l'erreur :

1. **Rendu** — `entry-form.tsx` : `FieldComponent = editComponents[field.type]` introuvable
   pour `list` → repli sur `editComponents["text"]`, soit une `<textarea>`.
2. **Validation** — `schema.ts` : *Unknown or invalid type → Defaulting to text* →
   `z.string()`, donc la chaîne passe.

Résultat : le champ s'affiche bien en zone de texte, le collage fonctionne, et la
sérialisation via la lib `yaml` réécrit un bloc scalaire littéral (`|-`). Le
round-trip est sûr. **Le §3.2 du guide était donc correct**, pour la mauvaise
raison.

Le validateur de config, lui, rejette bien `list` (`config-schema.ts` refine sur
`fieldTypes ∪ {object, block}`) — mais il n'est appelé que dans l'écran de config
(`entry.tsx`), **jamais** sur le chemin d'édition. D'où 3 erreurs visibles sans
conséquence fonctionnelle.

#### Gravité — P2 aujourd'hui, P1 au prochain durcissement

| Impact | Verdict |
|---|---|
| Perte de données actuelle | **Non** — round-trip vérifié |
| Build Astro cassé | **Non** — Astro ne lit jamais `.pages.yml` |
| Édition bloquée | **Non** — le repli `text` prend le relais |
| `alt` / `width` / `height` par image | **Inatteignables** — sous-champs ignorés |
| Bouton « + » documenté (§3.5, « Ajouter plusieurs galeries ») | **Inexistant** — pas d'UI répétable |

Le vrai risque est la **fragilité** : les deux replis sont des branches `else`. Si Page CMS
les retire, `images` et `galleryRef` s'affichent **vides**, et une seule publication
écrit des valeurs vides → **les 13 galeries perdent leur liste d'images**. Le
validateur signale déjà l'erreur, donc le projet est à une version du durcissement.

#### Correction appliquée — `type: text`, **pas** `string`

⚠️ Une version antérieure de ce plan recommandait `type: string`. **C'est faux et
ce serait catastrophique** : `string` rend un `<input>` mono-ligne, qui supprime les
sauts de ligne au collage. Les 13 galeries se collapseraient en une seule ligne,
`parseGalleryImages()` renverrait 1 image, et chaque galerie perdrait ses photos en
silence. Le type correct est **`text`** (textarea), identique au repli actuel.

```diff
 -      - name: images
 -        label: Images
 -        type: list
 -        description: "Une URL R2 par ligne. alt, largeur et hauteur optionnels"
 -        fields:
 -          url:    { label: "URL de l'image (R2)",       type: string, required: true }
 -          alt:    { label: "Texte alternatif",          type: string }
 -          width:  { label: "Largeur (px)",              type: number }
 -          height: { label: "Hauteur (px)",              type: number }
 +      - name: images
 +        label: Images
 +        type: text
 +        description: "Une URL R2 par ligne. L'ordre des lignes est l'ordre d'affichage dans la lightbox."
 ```

Les deux `galleryRef` ont reçu le même traitement. Composant rendu et schéma de
validation sont **inchangés** (`<textarea>` + `z.string()`) : la configuration devient
valide sans modifier le comportement, et les sous-champs ignorés disparaissent.
Aucun des 17 fichiers de contenu ne change de forme, donc aucune migration ni
ré-enregistrement n'est déclenché. Rollback = `git revert` d'un seul fichier.

#### Vérification

- `astro build` : 55 pages, aucune erreur
- 13 galeries / 270 images, comptage identique avant-après
- 12 pages publiées : le nombre de `gallery-card` par page correspond au frontmatter
- 4 articles/pages consommant `galleryRef` : 34 / 13 / 10 / 70 cartes rendues, conformes
- `.pages.yml` : 3 collections, 25 types de champs, 0 invalide
- `CONFIG_REFERENCE.md` : le bloc `.pages.yml` mirrorne désormais le fichier réel à l'identique

Docs mises à jour : `CONFIG_REFERENCE.md`, `AGENTS.md` (nouvelle section « Champs Page CMS »),
`GUIDE_Editeur.md` §3.5 — « Associer une ou plusieurs galeries », qui explique le
champ **Galeries associées** dont le type passe de `list` à `text`.

### 1.5 Découverte majeure — le chemin d'upload produit DÉJÀ un ordre arbitraire

Cette section est le résultat d'une relecture du chemin d'upload demandée en
complément de la fonctionnalité d'ordonnancement. Elle invalide une prémisse du plan :
l'ordre arbitraire n'est pas seulement un problème d'**affichage** — il existe déjà
dans le code qui produit les URL à l'éditeur.

#### Le défaut P1 — `results` est alimenté dans l'ordre d'arrivée, pas dans l'ordre de sélection

`uploadFiles()` (`src/ui.ts:562-611`) traite les fichiers avec 3 workers concurrents :

```js
const CONCURRENCY = 3;                                         // ui.ts:577
const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
  while (index < files.length) {
    const file = files[index++];
    const res = await uploadOne(file, currentPrefix);
    results.push(res);          // ← ordre d'ACHÈVEMENT, pas de sélection
  }
});
const ok = results.filter(r => r.ok);
const urls = ok.map(r => r.obj.url);                           // ui.ts:603
navigator.clipboard.writeText(urls.join('\\n'));              // ui.ts:604
```

Chaque `await uploadOne(...)` se résout quand la **requête HTTP de ce fichier-là**
se termine. Sur un lot de 40 photos, `results` est donc permuté selon la latence R2 :
la photo 12 termine avant la photo 3. `urls` sort dans cet ordre. **Le presse-papiers
reçoit une liste mélangée, et l'éditeur la colle telle quelle dans le champ Images.**

C'est exactement le mode de défaillance « valide mais faux » décrit en §8.4 — le pire
qui soit, parce qu'aucune erreur n'est affichée et que le résultat est un YAML valide.
Et il frappe **avant** même que l'ordonnancement manuel existe : c'est le chemin par
défaut du poste « Téléverser », puis « Coller dans le CMS ».

Le même `forEach` alimente la grille : `allObjects.unshift(...)` (`src/ui.ts:594-596`)
insère chaque objet **en tête** dans l'ordre d'achèvement, donc les nouveaux fichiers
apparaissent en haut de la grille dans un ordre inversé-aléatoire.

Le remède tient en deux caractères : indexer le résultat par la position d'origine.

```js
const res = await uploadOne(file, currentPrefix);
results[files.indexOf(file)] = res;   // ⚠️ O(n²) : ne pas faire ça
```

Non — `indexOf` est linéaire et le lot peut dépasser 300 fichiers. Préallouer un
tableau à la bonne taille et affecter par indice :

```js
const results = new Array(files.length);
// … dans le worker :
const i = index++;
const res = await uploadOne(files[i], currentPrefix);
results[i] = res;
```

Progressif : la barre d'avancement reste correcte (`completed++` est indépendant),
seuls `ok`, `failed` et l'insertion dans `allObjects` changent d'ordre — et c'est
précisément ce qu'il faut.

#### Les autres défauts du chemin d'upload

| # | Constat | Emplacement | Gravité |
|---|---|---|---|
| U1 | **Ordre d'achèvement** ci-dessus | `ui.ts:582`, `:603` | **P1** |
| U2 | `fileInput.value` n'est jamais remis à zéro → re-sélectionner **le même dossier** ne déclenche pas `change`, donc la 2ᵉ tentative est silencieusement ignorée | `ui.ts:943` | **P1** dès l'upload de dossier (§1.6) : c'est le geste « réessayer après avoir corrigé un fichier rejeté » |
| U3 | `totalBytes` est calculé (`ui.ts:573`) puis **jamais utilisé** → aucun garde-fou sur le poids total, et la progression est en nombre de fichiers, pas en octets | `ui.ts:573` | P2 |
| U4 | Le client teste `file.type.startsWith('image/')` (donc BMP, TIFF, HEIC, HEIF passent) alors que le serveur n'autorise que 6 MIME → 20 BMP sélectionnés = 20 échecs 415 | `ui.ts:660` vs `upload.ts:3-10` | P2 |
| U5 | À l'inverse, un `file.type` **vide** (certains partages réseau, outils de scan, HEIC selon le navigateur) fait rejeter à tort une vraie image : `''.startsWith('image/')` vaut `false` | `ui.ts:660` | P2 |
| U6 | `uploaded: new Date().toISOString()` est **l'horloge du navigateur**, pas la date R2, et `contentType: null` → le tri « Date » qui amorce `orderKeys` (§3.2) repose sur une horloge non fiable | `ui.ts:595` | P2 |
| U7 | `showError(failed.map(...).join(', '))` concatène **tous** les échecs → 200 fichiers rejetés produisent une chaîne unique illisible | `ui.ts:608` | P3 |
| U8 | `dragleave` sans compteur d'entrée → la zone clignote dès que la souris traverse un enfant ; aggravé par les drops de dossier, qui génèrent beaucoup plus d'événements | `ui.ts:934` | P3 |
| U9 | Le serveur fait un `head()` avant chaque `put()` → 2 allers-retours et 1 opération de classe B en plus par fichier | `upload.ts:56` | P3 (négligeable : 300 fichiers = 300 ops B, quota 10 M/mois) |
| U10 | Le suffixe de collision est `Date.now()` → deux fichiers homonymes traités dans la même milliseconde peuvent obtenir le **même** suffixe | `upload.ts:63-64` | P3, devient plausible avec l'upload de dossier (§1.6) |
| U11 | `uploadOne()` n'a ni `ontimeout` ni `onabort` : une requête bloquée (page d'authentification Cloudflare Access, connexion figée) **ne se résout jamais** → le `while (index < files.length)` du worker se bloque, `await Promise.all(workers)` ne rend pas la main, et le bouton d'envoi reste désactivé **définitivement**, sans message | `ui.ts:533-559`, `:578-589` | P2 ; passe à P1 en probabilité avec l'upload de dossier (300 requêtes = 300 occasions de se figer) |

#### Contrainte de U11 sur le correctif U1

T10 préalloue `results` et affecte par indice. C'est correct **à la condition que
`uploadOne()` résolve toujours** — c'est le cas aujourd'hui (`onload`, `onerror` et le
`catch` du `JSON.parse` résolvent tous les trois), mais U11 montre que l'invariant
est tenu par accident, pas par construction. Ajouter `ontimeout` et `onabort`
résolvant sur le même modèle `resolve({ ok: false, … })` rend l'invariant explicite, et
supprime au passage le blocage infini. Les deux corrections vont ensemble.

#### Constat neutre — le `<div id="uploadFilesize">` dupliqué est bien réel

§8.2 affirmait deux `id="uploadFilesize"` en `src/ui.ts:215` et `:217`. Vérifié : c'est
exact, le second est du markup mort. Correction au passage, sans rapport avec ce plan.

### 1.6 Upload de dossier — faisabilité et coût

**Verdict : bonne idée, faible coût.** Le picker a déjà le batch (concurrence 3), la
progression, l'agrégation succès/échec et les limites par fichier. Il manque la
traversée de répertoire, la collecte, et les garde-fous de lot.

#### Support navigateur des deux approches

| API | Support | Verdict |
|---|---|---|
| `<input webkitdirectory multiple>` | Chrome/Edge/Safari desktop, Firefox (préfixe non standard mais largement implémenté) | **Retenu**, mais sur un **`<input>` séparé** : sur `#fileInput` il transformerait le sélecteur natif en mode dossier seul (voir T11.1) |
| `DataTransferItem.webkitGetAsEntry()` + `readEntries()` récursif | Chrome/Edge/Safari desktop ; support Firefox variable | **Retenu** en amélioration progressive, avec repli sur `DataTransfer.files` |
| `showDirectoryPicker()` (File System Access) | Chromium uniquement — ni Safari, ni iOS, ni Firefox | **Écarté** : trop restrictif pour un outil interne |

Deux pièges de l'API d'entrées, tous deux silencieux :

1. `webkitGetAsEntry()` ne fonctionne que dans le handler `drop` — ailleurs elle renvoie `null` (§5, règle déjà mentionnée pour le drag des cards).
2. `readEntries()` est **paginé à ~100 entrées par appel** et renvoie un tableau vide à la fin. Une seule itération tronque silencieusement le dossier ; il faut boucler tant que le tableau est non vide. C'est l'erreur classique de cette API.
3. ⚠️ Corollaire du premier : dès que le handler `await` quoi que ce soit, le `DataTransfer` est **neutered** et les appels suivants à `webkitGetAsEntry()` renvoient `null`. Toutes les entrées doivent donc être extraites **de façon synchrone, avant le premier `await`** — branche des fichiers libres comprise. Se tromper ici reproduit exactement le symptôme de la troncature `readEntries`, par un autre chemin.

Le drop d'un **dossier** via `e.dataTransfer.files` — le code actuel (`src/ui.ts:940`) — renvoie une liste vide en Chromium. Il faut donc passer par les entrées, pas seulement par `webkitdirectory`.

#### Formats : trois listes divergentes, à unifier

| Emplacement | Contenu |
|---|---|
| `wrangler.toml` `ALLOWED_EXTENSIONS` | `jpg,jpeg,png,webp,gif,avif,svg` — **7 extensions** |
| `api.ts:3-5` `EXTENSIONS` (défaut) | identiques (7) — sert au **filtrage de liste**, pas à l'upload |
| `upload.ts:3-10` `ALLOWED_MIMES` | 6 MIME — `jpg` et `jpeg` partagent `image/jpeg`, d'où 6 pour 7 extensions |
| `ui.ts:660` | `image/*` — **beaucoup plus large que le serveur** |

Conséquence : le client accepte et le serveur refuse (U4), et le client refuse à tort
ce que le serveur accepterait (U5). La correction est d'exposer une seule constante au
client, injectée depuis `env` comme `WEIGHT_WARNING` l'est déjà (`ui.ts:4`, `:234`),
et de tester **l'extension en repli** quand `file.type` est vide.

Deux points de fond à trancher, signalés sans être corrigés ici :

- **HEIC absent des deux listes.** Les membres de l'association photographient au téléphone ; `image/heic` n'est accepté ni par le client ni par le serveur, et Cloudflare Image Resizing ne le transcode pas. Un dossier d'iPhone serait rejeté en bloc, sans remède côté outil. C'est un choix produit, pas un bug : le noter dans le guide plutôt que de le dissimuler dans le code.
- **SVG autorisé.** Servi depuis `media.quofai.org`, donc hors de l'origine du site, et toujours référencé en `<img>` — un SVG ne s'exécute pas dans cette balise. Risque faible. À noter : ni `@unpic` ni Cloudflare Image Resizing ne traitent un SVG, et ses dimensions sont sans limite, donc il ne rentre pas dans le modèle de couverture du site.

#### Aplatir ou préserver l'arborescence

| Option | Effet | Coût |
|---|---|---|
| **A — aplatir** (retenu) | Tous les fichiers atterrissent dans `currentPrefix`, sous leur seul nom de base. `sanitizeFilename()` (`upload.ts:12`) ne fait déjà rien d'autre | **Zéro changement serveur.** La grille reste plate, l'export reste lisible |
| B — préserver `webkitRelativePath` | `Galerie/2005/x.jpg` → `prefix/Galerie/2005/x.jpg` | Il faudrait assainir **chaque segment** du chemin, garantir l'impossibilité de remonter hors `prefix`, et le nombre de dossiers de l'arbre s'affiche mal dans une grille plate |

Option A retenue. Elle est compatible avec l'ordonnancement : le dossier reste plat, donc
« entrer dans le dossier, ordonner, exporter » garde son sens. L'arborescence pourra être
un interrupteur ultérieur, réversible et localisé.

⚠️ Le corollaire à connaître : en aplatissant, deux sous-dossiers contenant le même nom
de fichier (`A/img.jpg` et `B/img.jpg`) convergent vers `img.jpg`, et le second est renommé par
le serveur en `img-<timestamp>.jpg` (`upload.ts:62-64`). Rien n'est perdu, mais ces noms horodatés
apparaîtront dans l'export. C'est le compromis assumé de l'option A.

#### Coût

| Poste | Volume |
|---|---|
| Attributs sur l'`<input>` | 0 ligne |
| Traversée `webkitGetAsEntry` + boucle `readEntries` | +40–60 lignes |
| `selectFiles()` : repli extension, filtre fichiers système, plafonds de lot | +25–35 lignes |
| Correction U1 (ordre d'achèvement) | +3 lignes |
| Correction U2 (reset `fileInput.value`) | +1 ligne |
| Unification des listes de formats (U4/U5) | +8 lignes |
| **Total** | **~80–110 lignes, zéro dépendance, zéro endpoint** |

Les garde-fous de lot sont le seul vrai apport de cette section : il n'existe
aujourd'hui **aucun** plafond de nombre ni de poids. Un dossier de 3 000 photos produirait
3 000 XHR et gèlerait l'onglet. Plafonds proposés, à ajuster : **500 fichiers** et
**200 Mo** cumulés, refusés avec un motif explicite dans la liste existante des rejets.
---

## 2. Décisions d'architecture (validées)

| Question | Décision | Raison |
|---|---|---|
| Quel outil ? | **r2-image-picker uniquement.** R2 Explorer écarté | R2 Explorer est un paquet npm tiers (cf. plan 16) |
| Physique du réordonnancement | **Glisser-déposer HTML5 natif sur la grille existante** | Une seule grille à maintenir, pas de second panneau à garder synchronisé |
| Repli mobile | **Boutons ↑ / ↓ sur chaque card (~45 lignes)** | Le drag HTML5 ne se déclenche pas au toucher. Le coût du drag tactile réel est disproportionné (§9) |
| Bibliothèque externe | **Aucune** | Pas de bundler front (§8.1) ; vendoriser 30 Ko dans un template literal casse les conventions du repo |
| Formats d'export | **3 boutons : URLs / YAML / .md complet** | Couvre Page CMS (champ `text` multiligne, §1.4), GitHub, et fichier local. Les 3 passent tous par `orderedObjects()` (§8.4) |
| Persistance de l'ordre | **En mémoire, durée d'une session** | L'export est la persistance. Un `localStorage` par dossier est une tâche optionnelle (§10) |
| Images réordonnées hors dossier courant ? | **Non** | `currentPrefix` fige le périmètre ; cohérent avec `copyAllUrls()` |
| Couverture | **Première image de l'ordre par défaut**, surcharge par étoile optionnelle | Zéro UI supplémentaire pour le cas courant |
| Upload de dossier | **`webkitdirectory` + `webkitGetAsEntry()`, aplatissement dans `currentPrefix`** | Bonne idée, faible coût (§1.6). Aplatir = zéro changement serveur, grille et export restent plats et cohérents avec l'ordonnancement |
| Arborescence du dossier préservée ? | **Non — aplati** | `sanitizeFilename()` ne fait déjà que le nom de base. Préserver demanderait d'assainir chaque segment et de garantir l'impossibilité de sortir du `prefix`. Réversible plus tard via un interrupteur |
| Listes de formats acceptés | **Une seule constante, exposée au client depuis `env`** | Aujourd'hui 4 listes divergentes ; le client est plus large que le serveur (§1.6, U4/U5) |
| Plafonds de lot | **500 fichiers / 200 Mo cumulés** | Aucun plafond aujourd'hui : 3 000 photos = 3 000 XHR et un onglet gelé |
| Ordre des URL copiées après upload | **Ordre de sélection, garanti** | Aujourd'hui l'ordre d'achèvement réseau (§1.5, U1) — défaut P1 qui produit une galerie silencieusement désordonnée |

---

## 3. Architecture

### 3.1 Machine à états

```
                 ┌──────────────────────────────────────────┐
                 │  orderingMode = false                    │
                 │  tri + recherche actifs                   │
                 │  clic sur card = copier l'URL             │
                 └───────────────┬──────────────────────────┘
                                 │ clic #orderBtn
                                 ▼
                 ┌──────────────────────────────────────────┐
                 │  chargement exhaustif (pagination 100)    │
                 │  orderObjects[] + orderKeys[]             │
                 └───────────────┬──────────────────────────┘
                                 ▼
                 ┌──────────────────────────────────────────┐
                 │  orderingMode = true      ◄── state actif │
                 │  ordre = orderKeys[] (explicite)         │
                 │  tri + recherche désactivés               │
                 │  clic sur card = rien                    │
                 │  drag = réordonne · ↑/↓ = réordonne       │
                 │  #orderBar visible (3 boutons d'export)  │
                 └───────────────┬──────────────────────────┘
                                 │ clic #orderBtn / navigation / Escape
                                 ▼
                    retour à orderingMode = false
```

### 3.2 Le point d'architecture central

`renderGrid()` (`src/ui.ts:422-471`) reconstruit `gridContainer.innerHTML` à
partir de `getSortedObjects()`. Si l'ordre manuel vivait dans `allObjects`, il
serait écrasé au prochain rendu — par le tri, par la recherche, ou par
`loadItems(true)` (pagination).

**Règle : l'ordre manuel est un tableau de clés, séparé, qui prime sur le tri.**

```js
let orderingMode = false;   // état du mode
let orderObjects = [];      // liste exhaustive des objets du dossier (tri ignoré)
let orderKeys = [];         // ordre manuel : tableau de clés R2
let dragKey = null;         // clé en cours de drag
```

`getSortedObjects()` devient la seule charnière :

```js
function sortObjects(list) {
  const sorted = [...list];
  switch (currentSort) {
    case 'name': sorted.sort((a, b) => a.key.localeCompare(b.key)); break;
    case 'date': sorted.sort((a, b) => {
      const diff = new Date(a.uploaded).getTime() - new Date(b.uploaded).getTime();
      return currentSortDir === 'desc' ? -diff : diff;
    }); break;
    case 'size': sorted.sort((a, b) => {
      const diff = a.size - b.size;
      return currentSortDir === 'desc' ? -diff : diff;
    }); break;
  }
  return sorted;
}

function getSortedObjects() {
  if (orderingMode) return orderedObjects(orderObjects);
  const filtered = allObjects.filter(o => {
    if (!searchQuery) return true;
    const name = o.key.split('/').pop().toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });
  return sortObjects(filtered);
}

// Ordre manuel appliqué à un ensemble arbitraire (le dossier courant complet).
// Les clés ordonnées viennent en tête, dans l'ordre choisi ; les autres suivent,
// dans l'ordre naturel. C'est LA source de vérité de l'ordre pour TOUT export.
function orderedObjects(source) {
  const byKey = new Map(source.map(o => [o.key, o]));
  const out = [];
  const seen = new Set();
  for (const k of orderKeys) {
    const o = byKey.get(k);
    if (o && !seen.has(k)) { out.push(o); seen.add(k); }
  }
  for (const o of source) if (!seen.has(o.key)) out.push(o);
  return out;
}
```

**Amorçage depuis l'ordre courant.** Si l'éditeur a d'abord cliqué sur « Date »
(ou « Nom ») puis « Ordonner », il s'attend à réordonner *à partir de cet ordre*.
Il faut donc semer `orderKeys` avec `sortObjects(orderObjects)` — tri actif,
**recherche ignorée** (sinon seules les images filtrées seraient conservées et le
reste de la galerie disparaîtrait à la sortie du mode).

Dédupliquer à l'amorçage : deux objets de même `key` dans `orderObjects`
feraient pointer `indexOf` (et les badges de position) sur la première occurrence,
donnant des positions fausses.

```js
orderKeys = [...new Set(sortObjects(orderObjects).map(o => o.key))];
```

**Invariant d'ordre vs recherche.** L'ordre manuel porte sur **le dossier
entier**. La recherche ne filtre que l'**affichage** ; elle ne restreint jamais
l'ensemble exporté. Concrètement : pendant l'ordonnancement, la recherche est
neutralisée (le court-circuit `if (orderingMode)` passe avant le filtre), et
`applyOrderingChrome()` **masque le champ de recherche** pour rendre cet état
inatteignable plutôt que simplement indéfini. Un éditeur qui filtre puis clique
« Ordonner » doit voir la galerie entière, pas la sélection filtrée.

### 3.3 Chargement exhaustif

`handleList` (`src/api.ts:28-63`) plafonne `limit` à 100 (`src/api.ts:34`) et
pagine via `cursor`. La boucle existante de `copyAllUrls()`
(`src/ui.ts:864-877`) fait déjà exactement ce qu'il faut. **Factorisation :**

```js
async function fetchAllObjects(prefix) {
  let out = [];
  let cursor = null;
  let hasMore = true;
  while (hasMore) {
    const params = new URLSearchParams({ prefix: prefix, limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch('/api/list?' + params.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    out = out.concat(data.objects);
    cursor = data.cursor;
    hasMore = data.truncated;
  }
  return out;
}
```

`copyAllUrls()` devient `const allImages = await fetchAllObjects(currentPrefix);`
(−13 lignes).

---

## 4. Le rendu en mode ordonnancement

`renderGrid()` reste **le seul** point de rendu. Les différences sont additives :

| Élément | Mode normal | Mode ordonnancement |
|---|---|---|
| `draggable` | absent | `"true"` |
| Badge de position | absent | `.card-order` → `1`, `2`, `3`… |
| Boutons ↑/↓ | absents | `.card-nudge` (désactivés aux extrémités) |
| Clic sur card | `copyUrl(el, key, url)` | **aucune action** |
| `aria-label` | « Copier l'URL de X » | « Position N : X. Glisser pour réordonner » |
| Étoile couverture | absente | optionnelle (§10) |
| Grille | `getSortedObjects()` | idem (court-circuité par §3.2) |

---

## 5. Comportement du drag

Le drag HTML5 natif impose trois règles :

1. `e.preventDefault()` dans `dragover` — **sinon `drop` ne se déclenche jamais**
2. `e.dataTransfer.setData(...)` dans `dragstart` — Firefox l'exige
3. `renderGrid()` ne doit **pas** être appelé pendant `dragover`, seulement dans `drop`

Point d'attention réel : `renderGrid()` reconstruit `innerHTML`, donc **détruit
l'élément source du drag**. C'est sans conséquence si `dragKey` est remis à
`null` *avant* le `renderGrid()` de `onDrop`, et si `dragend` reste idempotent
(il ne trouve alors plus rien à nettoyer). Si le drag est annulé (Échap, sortie
de fenêtre), `dragend` joue seul et nettoie normalement.

Calcul de la position d'insertion : moitié gauche/gauche de la card survolée.

```js
function onDragStart(e) {
  const card = e.currentTarget;
  dragKey = card.dataset.key;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragKey);
  card.classList.add('dragging');
}

function onDragEnd() {
  document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.card.drop-before, .card.drop-after')
    .forEach(c => c.classList.remove('drop-before', 'drop-after'));
  dragKey = null;
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  if (!dragKey || card.dataset.key === dragKey) return;
  const rect = card.getBoundingClientRect();
  const next = (e.clientX - rect.left) > rect.width / 2 ? 'drop-after' : 'drop-before';
  if (!card.classList.contains(next)) {
    card.classList.remove('drop-before', 'drop-after');
    card.classList.add(next);
  }
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const card = e.currentTarget;
  if (!dragKey || card.dataset.key === dragKey) return;
  const rect = card.getBoundingClientRect();
  const after = (e.clientX - rect.left) > rect.width / 2;
  const from = orderKeys.indexOf(dragKey);
  let to = orderKeys.indexOf(card.dataset.key) + (after ? 1 : 0);
  orderKeys.splice(from, 1);
  if (from < to) to -= 1;
  orderKeys.splice(to, 0, dragKey);
  orderTouched = true;
  dragKey = null;
  renderGrid();
}
```

Le réordonnancement par bouton est le même mouvement, réduit :

```js
function nudge(dir, key) {
  const i = orderKeys.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= orderKeys.length) return;
  [orderKeys[i], orderKeys[j]] = [orderKeys[j], orderKeys[i]];
  orderTouched = true;
  renderGrid();
}
```

---

## 6. Tâches

> Repo : `r2-image-picker/`. Fichiers touchés : `src/ui.ts`, plus `src/upload.ts`
> si et seulement si T13/U6 est retenu (§7).
>
> **Ordre : T10 d'abord** — c'est un défaut P1 déjà en production (§1.5), pas une
> fonctionnalité nouvelle, et T11 s'appuie sur le même code de lot. Puis T1 → T9
> (ordonnancement), puis T11 → T14 (upload de dossier).
>
> Deux points de rupture pour ne pas faire les quatorze tâches d'un bloc : après
> T5, l'interface est utilisable (chargement + ordonnancement sans export) ; T6→T9
> n'ajoutent que la génération de texte. T11→T14 sont **indépendantes** de T1→T9 :
> aucun état d'ordonnancement n'est requis.

### T1 — État global + CSS du mode ordonnancement

Ajouter à la fin du bloc d'état (`src/ui.ts:252`, après `let focusedGridIndex = -1;`) :

```js
let orderingMode = false;
let orderObjects = [];
let orderKeys = [];
let dragKey = null;
let orderTouched = false;   // l'ordre a-t-il ete modifie a la main ?
```

`orderTouched` distingue un ordre simplement *initialisé* (tri par nom/date) d'un
ordre *choisi* par l'éditeur. Seul le second déclenche une confirmation à la sortie
(§8.4) : sans lui, entrer puis sortir du mode sans rien faire proposerait un dialogue
inutile à chaque fois.

Ajouter au bloc `<style>`, après `.card.focused{…}` (`src/ui.ts:97`) :

```css
.card.dragging{opacity:.4}
.card.drop-before{box-shadow:-3px 0 0 #2563eb inset}
.card.drop-after{box-shadow:3px 0 0 #2563eb inset}
.card-order{position:absolute;top:6px;left:6px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:rgba(26,26,26,.78);color:#fff;font-size:.6875rem;font-weight:600;line-height:22px;text-align:center;pointer-events:none}
.card-nudge{position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:2px}
.card-nudge button{width:22px;height:18px;padding:0;border:1px solid rgba(255,255,255,.7);border-radius:3px;background:rgba(26,26,26,.72);color:#fff;font-size:.625rem;line-height:1;cursor:pointer}
.card-nudge button:disabled{opacity:.25;cursor:default}
body.ordering .card{cursor:grab}
body.ordering .sort-group,body.ordering .toolbar .search-input{opacity:.4;pointer-events:none}
.order-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 20px;background:#f0f7ff;border-bottom:1px solid #bfdbfe;font-size:.8125rem}
.order-bar .order-hint{color:#1e40af;font-weight:500}
.order-bar .order-count{color:#555}
.order-exports{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}
.btn-export{background:#fff;border-color:#2563eb;color:#2563eb}
.btn-export:hover{background:#e8f0fe}
.btn-order{background:#7c3aed;color:#fff;border-color:#7c3aed;flex-shrink:0;white-space:nowrap}
.btn-order:hover{background:#6d28d9}
.btn-order:disabled{opacity:.5;cursor:default}
@media(max-width:600px){.order-bar{padding:10px 12px}.order-exports{margin-left:0;width:100%}}
```

⚠️ `.toolbar .search-input` est **volontairement** préfixé par `.toolbar`. La classe
`.search-input` est partagée : `#searchInput` (`src/ui.ts:165`) est dans la barre
d'outils, mais les champs `#galleryTitle` / `#galleryDate` de T6 la portent
**aussi** tout en vivant dans `.order-bar`. Un sélecteur `body.ordering .search-input`
sans prefixe leur poserait `pointer-events:none` — le titre et la date de la galerie
seraient inutilisables au moment précis où l'on veut les saisir. Le même raisonnement
vaut pour la règle de grammaire : `.toolbar` ne contient que recherche + tris, donc
la neutralisation reste exactement celle voulue.

### T2 — Bouton `#orderBtn` dans la barre d'outils

Dans `.toolbar` (`src/ui.ts:159-172`), insérer **après** `#copyAllBtn`
(`src/ui.ts:166`) :

```html
<button class="btn btn-order" id="orderBtn" aria-label="Ordonner les images du dossier et exporter la galerie">Ordonner</button>
```

Dans la barre `<main>`, insérer la barre d'ordonnancement **après** le
`<div class="breadcrumb">` (`src/ui.ts:186`) :

```html
<div class="order-bar" id="orderBar" style="display:none">
  <span class="order-hint">Glissez les images pour fixer leur ordre</span>
  <span class="order-count" id="orderCount"></span>
  <div class="order-exports">
    <button class="btn btn-export" id="exportUrlsBtn" aria-label="Copier les URL dans l'ordre d'affichage">Copier les URLs</button>
    <button class="btn btn-export" id="exportYamlBtn" aria-label="Copier le bloc YAML du frontmatter">Copier le YAML</button>
    <button class="btn btn-export" id="exportMdBtn" aria-label="Copier le fichier Markdown complet">Copier le .md</button>
  </div>
</div>
```

### T3 — Factoring `fetchAllObjects()` + bascule du mode

Ajouter juste avant `copyAllUrls()` (`src/ui.ts:860`) :

```js
async function fetchAllObjects(prefix) {
  let out = [];
  let cursor = null;
  let hasMore = true;
  while (hasMore) {
    const params = new URLSearchParams({ prefix: prefix, limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch('/api/list?' + params.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    out = out.concat(data.objects);
    cursor = data.cursor;
    hasMore = data.truncated;
  }
  return out;
}

async function enterOrderingMode() {
  const btn = document.getElementById('orderBtn');
  btn.disabled = true;
  btn.textContent = 'Chargement…';
  try {
    const all = await fetchAllObjects(currentPrefix);
    if (all.length === 0) {
      showToast('Aucune image dans ce dossier', 'error');
      return;
    }
    orderObjects = all;
    orderKeys = [...new Set(sortObjects(all).map(o => o.key))];
orderTouched = false;
  orderingMode = true;
  focusedGridIndex = -1;
  // Le champ de recherche est masqué en mode ordonnancement (applyOrderingChrome),
  // mais searchQuery reste en mémoire : à la sortie, getSortedObjects()
  // recommencerait à filtrer sur une requête invisible, et l'éditeur verrait
  // une grille amputée sans comprendre pourquoi. On le neutralise des deux côtés.
  searchQuery = '';
  searchInput.value = '';
  applyOrderingChrome();
  renderGrid();
    showToast(all.length + ' image(s) charg\u00e9e(s) — glissez pour ordonner', 'success');
  } catch {
    showToast('Erreur lors du chargement du dossier', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = orderingMode ? 'Terminer' : 'Ordonner';
  }
}

function exitOrderingMode() {
  orderingMode = false;
  orderObjects = [];
  orderKeys = [];
  orderTouched = false;
  dragKey = null;
  focusedGridIndex = -1;
  searchQuery = '';
  applyOrderingChrome();
  renderGrid();
}

// Sortie demandee alors qu'un ordre manuel existe : on confirme avant de perdre
// une sequence de N images. Seuls declencheurs ordonnes : navigation dossier,
// bouton "Terminer", touche Echap. Le repli confirm() est volontaire (§8.4).
function confirmDiscardOrder() {
  if (!orderTouched) return true;
  return confirm('Abandonner l\\'ordre manuel de ' + orderKeys.length
    + ' image(s) ?');
}

function toggleOrderingMode() {
  if (orderingMode) {
    if (confirmDiscardOrder()) exitOrderingMode();
  }
  else enterOrderingMode();
}

function applyOrderingChrome() {
  document.getElementById('orderBar').style.display = orderingMode ? 'flex' : 'none';
  document.body.className = orderingMode ? 'ordering' : '';
  const btn = document.getElementById('orderBtn');
  if (orderingMode) btn.textContent = 'Terminer';
  else { btn.textContent = 'Ordonner'; btn.disabled = false; }
  if (orderingMode) {
    document.getElementById('orderCount').textContent = orderKeys.length + ' image(s)';
    // Pendant l'ordonnancement, l'ordre porte sur le dossier entier : la
    // recherche est desactivee pour ne pas laisser croire a une selection.
    const search = document.getElementById('searchInput');
    if (search) search.style.display = 'none';
    // Un seul chemin d'export visible : on masque "toutes les URLs", dont
    // l'ordre naturel differerait de l'ordre choisi.
    const copyAll = document.getElementById('copyAllBtn');
    if (copyAll) copyAll.style.display = 'none';
  } else {
    const search = document.getElementById('searchInput');
    if (search) search.style.display = '';
    updateNavButtons();
  }
}
```

Raccourcir `copyAllUrls()` (`src/ui.ts:864-877`) : remplacer la boucle `while` par
la ligne ci-dessous. **Point non négociable :** le résultat passe par
`orderedObjects()` (cf. §3.2) pour que le bouton historique honore lui aussi
l'ordre manuel. Sans cela, un éditeur qui ordonne puis clique « Toutes les URLs »
obtiendrait l'ordre naturel — un résultat *valide mais faux*, le pire mode de
défaillance possible (§8.4).

```js
const allImages = orderedObjects(await fetchAllObjects(currentPrefix));
```

### T4 — `sortObjects()` + court-circuit dans `getSortedObjects()`

Remplacer `getSortedObjects()` (`src/ui.ts:395-420`) par les deux fonctions du
§3.2. **Le corps de la boucle `while` disparaît au profit de `sortObjects()`** :
rien d'autre ne change.

### T5 — Marqueurs, drag, ↑/↓ dans `renderGrid()`

Dans la boucle `objects.forEach(...)` de `renderGrid()` (`src/ui.ts:431-450`),
ajouter **avant** la boucle un index de position, puis insérer le bloc de
marqueurs après la construction de `.card-info` (`src/ui.ts:447`).

`indexOf` dans la boucle serait en O(n²) sur un dossier de 70 images, et
renverrait la *première* occurrence en cas de clé dupliquée (position fausse).
Un `Map` construit une fois par rendu règle les deux.

```js
const posByKey = new Map(orderKeys.map((k, i) => [k, i + 1]));
```

```js
if (orderingMode) {
  const pos = posByKey.get(key);
  // Ne pas retomber sur 1 : une clé absente de orderKeys est un état
  // incohérent, et l'afficher en position 1 produirait un badge faux
  // exactement comme le bug de aria-label que ce correctif supprime.
  // Mieux vaut un marqueur vide qu'un mensonge visible.
  const marker = pos === undefined ? '' : '<div class="card-order">' + pos + '</div>';
  html += marker;
  html += '<div class="card-nudge">'
    + '<button class="nudge-up" data-dir="-1" aria-label="Monter ' + escapeHtml(name) + '"' + (pos === 1 ? ' disabled' : '') + '>&#9650;</button>'
    + '<button class="nudge-down" data-dir="1" aria-label="Descendre ' + escapeHtml(name) + '"' + (pos === orderKeys.length ? ' disabled' : '') + '>&#9660;</button>'
    + '</div>';
}
```

Remplacer le bloc d'écouteurs `.card` (`src/ui.ts:464-470`) par :

```js
gridContainer.querySelectorAll('.card').forEach(el => {
  const key = el.dataset.key;
  if (orderingMode) {
    el.draggable = true;
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    el.querySelectorAll('.card-nudge button').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        nudge(parseInt(b.dataset.dir, 10), key);
      });
    });
    return;
  }
  const url = publicUrl(key);
  const handler = () => copyUrl(el, key, url);
  el.addEventListener('click', handler);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
});
```

Et ajuster l'`aria-label` de la card (`src/ui.ts:437`). `posByKey` et non
`orderKeys.indexOf(key)` — même raison que pour le badge : O(1) au lieu de O(n)
par card, et surtout pas de `-1` silencieux qui s'afficherait « Position 0 » :

```js
const posLabel = orderingMode
  ? (posByKey.has(key) ? 'Position ' + posByKey.get(key) + ' sur ' + orderKeys.length + ' : ' : '')
  : 'Copier l\'URL de ';
html += '<div class="card" role="button" tabindex="0" data-key="' + escapeHtml(key) + '" aria-label="'
  + posLabel
  + escapeHtml(name) + '">';
```

`posByKey` doit donc être calculé **avant** la construction du `<div class="card">`,
pas seulement avant la boucle d'écouteurs : la déclaration `const posByKey` du
bloc de marqueurs arrive trop tard pour l'`aria-label`.

`posByKey` et non `orderKeys.indexOf(key)` — même raison que pour le badge (T5) :
`indexOf` est O(n) par card, donc O(n²) par rendu, et renvoie `-1` (→ position `0`)
pour une clé absente de `orderKeys`.

Ajouter les quatre handlers de drag du §5 à la suite de `nudge()`.

### T6 — Générateurs de texte

Ajouter après `buildYaml` :

```js
function orderedEntries() {
  return getSortedObjects().map(o => ({
    key: o.key,
    url: publicUrl(o.key),
    name: o.key.split('/').pop(),
  }));
}

// Les backslashes dupliques dans un template literal exigent un quadruple
// échappement dans src/ui.ts. On passe par un code caractere pour rester lisible.
const BS = String.fromCharCode(92);

function yamlStr(s) {
  return '"' + String(s).split(BS).join(BS + BS).split('"').join(BS + '"') + '"';
}

function buildUrlsText() {
  return orderedEntries().map(e => e.url).join(BS + 'n');
}

function buildYaml(title, date, cover) {
  const lines = [];
  if (title) lines.push('title: ' + yamlStr(title));
  if (date) lines.push('date: ' + date);
  if (cover) lines.push('cover: ' + cover);
  lines.push('draft: false');
  lines.push('images: |');
  orderedEntries().forEach(e => lines.push('  ' + e.url));
  return lines.join(BS + 'n');
}

function buildMarkdown(title, date, cover) {
  return '---' + BS + 'n' + buildYaml(title, date, cover) + BS + 'n---' + BS + 'n' + BS + 'nDescription de la galerie.' + BS + 'n';
}

function suggestSlug(title) {
  return String(title)
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function copyExport(kind) {
  const entries = orderedEntries();
  if (entries.length === 0) {
    showToast('Aucune image \u00e0 exporter', 'error');
    return;
  }
  const titleInput = document.getElementById('galleryTitle');
  const dateInput = document.getElementById('galleryDate');
  const title = titleInput ? titleInput.value.trim() : '';
  const date = dateInput ? dateInput.value.trim() : '';
  const cover = entries[0].url;
  const text = kind === 'urls' ? buildUrlsText()
    : kind === 'yaml' ? buildYaml(title, date, cover)
    : buildMarkdown(title, date, cover);
  try {
    await navigator.clipboard.writeText(text);
    const suffix = kind === 'md' && title ? ' (fichier : ' + suggestSlug(title) + '.md)' : '';
    showToast(entries.length + ' image(s)' + suffix, 'success');
  } catch {
    showToast('Erreur de copie', 'error');
  }
}
```

Ajouter dans `.order-bar` (T2) deux champs d'en-tête, **optionnels**, avant les
boutons d'export :

```html
<input type="text" id="galleryTitle" class="search-input" style="max-width:220px" placeholder="Nom de la galerie (optionnel)" aria-label="Nom de la galerie">
<input type="date" id="galleryDate" class="search-input" style="max-width:150px" aria-label="Date de l'evenement">
```

> Sans titre ni date, `buildYaml()` n'émet que `draft:` et `images: |` — ce qui
> reste collable tel quel dans le champ **Images** de Page CMS.

### T7 — Listeners

Ajouter à la suite des listeners existants (après `src/ui.ts:956`) :

```js
document.getElementById('orderBtn').addEventListener('click', toggleOrderingMode);
document.getElementById('exportUrlsBtn').addEventListener('click', () => copyExport('urls'));
document.getElementById('exportYamlBtn').addEventListener('click', () => copyExport('yaml'));
document.getElementById('exportMdBtn').addEventListener('click', () => copyExport('md'));
```

Dans `updateNavButtons()` (`src/ui.ts:371`), ajouter la ligne jumelle de
`copyAllBtn` :

```js
document.getElementById('orderBtn').style.display = currentPrefix ? '' : 'none';
```

### T8 — Intégration clavier et navigation

Dans `navigateTo()` (`src/ui.ts:350`), **avant** le rechargement, sortir du mode
si actif — **en confirmant** si un ordre a été modifié à la main. Un clic sur
un dossier ne doit pas effacer sans bruit une séquence de 70 images :

```js
if (orderingMode && !confirmDiscardOrder()) return;
if (orderingMode) exitOrderingMode();
```

Le `return` annule la navigation entière : c'est le comportement attendu, la
grille affichée et l'ordre courant restent cohérents entre eux.

Dans le `switch (e.key)` global (`src/ui.ts:990`), ajouter — Échap reste un
déclencheur de sortie *confirmé*, pour ne pas diverger de « Terminer » :

```js
case 'Escape':
  if (uploadModal.className.includes('open')) closeUploadModal();
  else if (orderingMode) {
    if (confirmDiscardOrder()) exitOrderingMode();
  }
  break;
```

`moveGridFocus()` (`src/ui.ts:812-825`) et `activateFocusedItem()`
(`src/ui.ts:827-832`) **fonctionnent tels quels** : ils interrogent le DOM à
chaque appel, et `focusedGridIndex` est remis à `-1` à l'entrée et à la sortie du
mode. Vérifier que `Enter`/`Espace` sur une card en mode ordonnancement ne déclenche
rien de nuisible — le handler `.card` n'est pas attaché dans ce mode (§T5), donc
`activateFocusedItem()` ne trouve rien à cliquer : c'est le comportement voulu.

### T9 — Documentation

**Ne pas remplacer la méthode par le fichier texte.** `GUIDE_Editeur.md` §3.2
explique aujourd'hui que l'ordre de la galerie est celui des lignes du champ
**Images**, et que le réordonnancement se fait en déplaçant ces lignes. C'est le
mécanisme qui fait le contrat avec Page CMS : c'est lui qui décide de l'ordre à
l'affichage. Le picker n'est qu'un moyen de produire ce texte plus vite, pas un
remplacement du format.

Les deux méthodes sont donc présentées **côte à côte**, la méthode visuelle
d'abord parce qu'elle devient plus rapide, l'autre maintenue parce qu'elle reste
valable partout (sur mobile, sur un champ déjà rempli, et après toute retouche
manuelle du fichier).

- `GUIDE_Editeur.md` §3.2 : **ajouter** sous « Réordonner les photos » un second
  paragraphe « Ou ordonner visuellement avant l'export », qui renvoie au nouveau §4.13.
  Conserver la phrase existante mot pour mot : elle décrit le format du champ, pas
  l'outil.
- Nouveau §4.13 « Ordonner les images et exporter une galerie » (après §4.12),
  qui décrit le parcours Médiathèque → Ordonner → Copier, **et** rappelle qu'on
  peut ensuite retoucher le texte dans Page CMS — les deux ne s'excluent pas.
- `r2-image-picker/README.md` : une ligne sur la fonctionnalité
- `docs/PLAN-15-drag-order-export.md` : copie de ce plan.
  ⚠️ **Pas `dev/`** : ce répertoire est dans `.gitignore` de `r2-image-picker`
  (ligne 4). Les plans existants y sont des fichiers locaux non versionnés —
  une copie placée là ne serait jamais commitée.

Ce point n'est pas cosmétique : un éditeur qui lit « déplacez les lignes » puis
« ou passez par le picker » comprend que le champ **Images** reste la source de
vérité. Écrire « le nouveau parcours remplace l'ancien » produirait exactement
l'inverse, et l'ordre divergerait silencieusement dès la première retouche dans
Page CMS.

### T10 — Corriger l'ordre des URL copiées après upload (U1)

**À faire avant T1** : c'est un défaut P1 préexistant, indépendant de
l'ordonnancement, et il corrompt déjà les galeries. Le reste du plan peut
attendre ; pas celui-ci.

Dans `uploadFiles()` (`src/ui.ts:562-611`), remplacer `const results = [];`
(l. 572) par un tableau préalloué, et faire affecter par indice :

```js
const results = new Array(files.length);
// … dans le worker, remplacer :
//   const file = files[index++];
//   const res = await uploadOne(file, currentPrefix);
//   results.push(res);
const i = index++;
const res = await uploadOne(files[i], currentPrefix);
results[i] = res;
```

Rien d'autre ne bouge : `ok`, `failed`, l'insertion dans `allObjects` et la copie
automatique (`ui.ts:602-606`) se mettent d'eux-mêmes dans l'ordre de sélection.
`completed++` et la barre de progression sont déjà indépendantes de `results`.

Corollaire : `ok.forEach(r => allObjects.unshift(...))` (`ui.ts:594-596`) continue de
préfixer chaque objet, donc l'affichage final est l'**inverse** de l'ordre de
sélection. C'est acceptable — un tri par date les remettra dans l'ordre — mais le
laisser en commentaire plutôt que le découvrir dans six mois.

### T11 — Upload de dossier

1. **Un second `<input>`, pas un attribut sur l'existant.** ⚠️ Ne **pas**
   ajouter `webkitdirectory` à `#fileInput` : en Chromium, cet attribut fait
   passer le sélecteur natif en mode « dossier uniquement ». Cliquer sur la zone
   de dépôt n'ouvrirait plus la sélection de fichiers individuels — on casserait
   le parcours actuel, qui est le plus utilisé (§4.1). C'est le même piège que
   `webkitdirectory` **survient** après coup : invisible jusqu'à ce qu'un utilisateur
   ne puisse plus choisir 3 photos d'un coup.

   On ajoute donc un input dédié, masqué, et un lien secondaire dans la zone :

   ```html
   <input type="file" id="folderInput" webkitdirectory directory multiple style="display:none" aria-hidden="true">
   ```

   `directory` est redondant mais couvre des implémentations partielles. Les deux
   inputs se réinitialisent (`value = ''`, cf. U2) et appellent le même `selectFiles()`.

   Libellés : le texte de la zone devient « Glissez des images ou un dossier ici, ou
   cliquez pour parcourir », suivi du lien « …ou choisissez un dossier ».

2. **Libellés** : remplacer les deux occurrences du texte de zone de dépôt
   (`ui.ts:622` et `:672-674`) par « Glissez des images ou un dossier ici, ou cliquez pour parcourir ».

3. **Traversal du drop** : remplacer `selectFiles(e.dataTransfer.files)`
   (`ui.ts:940`) par une collecte via les entrées, avec repli sur `files` :

   ```js
   function readAllEntries(reader) {
     // readEntries() est paginé (~100/appel) : boucler jusqu'au tableau vide,
     // sinon le dossier est tronqué SANS AUCUNE ERREUR (§1.6).
     return new Promise(resolve => {
       const all = [];
       const read = () => reader.readEntries(entries => {
         if (!entries.length) return resolve(all);
         all.push(...entries);
         read();
       }, () => resolve(all));
       read();
     });
   }

   async function walkEntry(entry) {
     if (entry.isFile) {
       const file = await new Promise(res => entry.file(res, () => res(null)));
       return file ? [file] : [];
     }
     if (!entry.isDirectory) return [];
     const children = await readAllEntries(entry.createReader());
     const out = [];
     for (const child of children) out.push(...await walkEntry(child));
     return out;
   }

   async function filesFromDrop(dt) {
     const items = dt.items;
     if (!items || !items.length) return Array.from(dt.files || []);

     // ⚠️ Extraire TOUTES les entrées AVANT le premier await. Au-delà du
     // microtask, le DataTransfer est déjà « neutered » : les items suivants
     // renverraient null et le dossier serait tronqué sans erreur. Snapshot d'abord,
     // parcourt ensuite.
     const entries = [];
     const loose = [];
     for (const item of items) {
       const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
       if (entry) entries.push(entry);
       else if (item.kind === 'file') {
         const f = item.getAsFile();
         if (f) loose.push(f);
       }
     }

     const out = [];
     for (const entry of entries) out.push(...await walkEntry(entry));
     out.push(...loose);
     return out.length ? out : Array.from(dt.files || []);
   }
   ```

   Le repli final sur `dt.files` couvre le cas où `webkitGetAsEntry()` renvoie
   `null` pour tout (Firefox ancien). Il ne couvre **pas** un dossier : ce qui est
   précisément le comportement qu'on cherche à corriger. D'où le second input.

   Le `drop` devient `async` :

   ```js
   dropZone.addEventListener('drop', async (e) => {
     e.preventDefault();
     dropZone.classList.remove('dragover');
     selectFiles(await filesFromDrop(e.dataTransfer));
   });
   ```

   L'aplatissement est implicite : `selectFiles()` ne lit que `file.name`, donc les
   sous-dossiers disparaissent (§1.6, option A). Le garde-fou `if (!entry)` puis
   `item.getAsFile()` assure qu'un drop mixte (dossier + fichier) n'en perd aucun.

4. **Validation dans `selectFiles()`** (`ui.ts:653-674`) :

   - Repli sur l'extension quand `file.type` est vide (U5) :
     ```js
     const ext = (f.name.split('.').pop() || '').toLowerCase();
     const typeOk = f.type ? f.type.startsWith('image/') : ALLOWED_EXTS.has(ext);
     if (!typeOk) rejectedFiles.push({ name: f.name, reason: 'Format non image' });
     ```
   - Fichiers système ignorés silencieusement (macOS en livre plein) : `.DS_Store`,
     `Thumbs.db`, `desktop.ini`, et tout nom commençant par `.` :
     ```js
     if (f.name.startsWith('.') || /^Thumbs\.db$/i.test(f.name) || /^desktop\.ini$/i.test(f.name)) return;
     ```
   - Plafonds de lot, refusés via la liste de rejets existante :
     ```js
     const MAX_FILES = 500, MAX_TOTAL_BYTES = 200 * 1024 * 1024;
     if (files.length > MAX_FILES) {
       rejectedFiles.push({ name: files.length + ' fichiers',
         reason: 'Lot trop volumineux (max ' + MAX_FILES + ')' });
       return;
     }
     const total = files.reduce((s, f) => s + f.size, 0);   // corrige aussi U3
     if (total > MAX_TOTAL_BYTES) {
       rejectedFiles.push({ name: files.length + ' fichiers',
         reason: 'Poids total > 200 Mo' });
       return;
     }
     ```

   `totalBytes` (U3) reste donc inutilisé à `ui.ts:573` : soit le supprimer, soit
   s'en servir pour une progression en octets. **Ne pas laisser les deux.**

   - Réutiliser `total` pour l'affichage `uploadFilesize` déjà présent
     (`ui.ts:675`) plutôt que d'y recomputer un `reduce`.

### T12 — Unifier la liste des formats (U4/U5)

Le client doit connaître la liste que le serveur applique vraiment
(`upload.ts:3-10`), sinon l'éditeur découvre le refus après l'envoi.

Exposer `ALLOWED_EXTENSIONS` au client, à côté de `weightWarningBytes` déjà injecté
(`ui.ts:4` et `:234`) :

```js
// src/ui.ts, hors template literal (à côté de weightWarningBytes)
const allowedExtensions = env.ALLOWED_EXTENSIONS.split(',').map(s => s.trim().toLowerCase());
// … dans le script client :
const ALLOWED_EXTS = new Set(${JSON.stringify(allowedExtensions)});
```

⚠️ Contrainte du template literal (§8.1) : utiliser `JSON.stringify()` pour
produire le littéral de tableau, **jamais** un littéral écrit à la main dans la
chaîne. Et faire correspondre `ALLOWED_EXTENSIONS` de `wrangler.toml` et la
`ALLOWED_MIMES` de `upload.ts` — aujourd'hui 7 extensions contre 6 MIME, cohérents
par accident, pas par construction.

### T13 — Correctifs mineurs du chemin d'upload

| Défaut | Correction | Emplacement |
|---|---|---|
| U2 | `fileInput.value = '';` après `selectFiles(fileInput.files)` — sinon réessayer le **même** dossier ne fait rien, sans message | `ui.ts:943` |
| U6 | Renvoyer `uploaded` depuis `handleUpload` (l_worker connaît l'instant du `put`) et l'utiliser à la place de `new Date()` | `upload.ts:73-76`, `ui.ts:595` |
| U7 | Tronquer la liste des échecs : 5 premiers + « … et N autres » | `ui.ts:608` |
| U8 | Compteur `dragenter`/`dragleave` pour empêcher le clignotement de la zone | `ui.ts:930-936` |
| U9 | `head()` laissé en place — évite un écrasement silencieux, coût négligeable | `upload.ts:56` |
| U10 | suffixe `-${Date.now()}` → `-${Date.now()}-${counter}` ou `crypto.randomUUID()` | `upload.ts:62-64` |
| U11 | `xhr.ontimeout` / `xhr.onabort` résolvant en `{ ok: false, reason: 'Delai depasse' }`, et `xhr.timeout = 120000` | `ui.ts:533-559` |

U6 est le seul qui touche `src/upload.ts`. Il est optionnel : sans lui, le
tri « Date » qui amorce l'ordonnancement repose sur l'horloge du navigateur, ce qui
est acceptable tant que le tri « Nom » (par défaut) régit.

U11 est **à traiter avec T10**, pas après : le tableau préalloué de T10 n'est
sûr que si chaque `uploadOne()` résout (§1.5).

U9 (`head()` avant chaque `put`) est **laissé tel quel** : le surcoût est
négligeable au regard du quota, et le `head()` évite un écrasement silencieux.

### T14 — Documentation (upload)

En plus de T9 :

- `GUIDE_Editeur.md` : dans le même §3.2, **ajouter** (sans retirer la méthode
  par lignes, cf. T9) une mention « glisser un dossier entier », et le rappel que
  **HEIC n'est pas accepté** (les photos iPhone doivent être converties) — c'est la
  question qui reviendra sinon.
- `r2-image-picker/README.md` : les limites réelles, absentes aujourd'hui du README —
  4 Mo par fichier, 500 fichiers / 200 Mo par lot, 6 formats acceptés (7 extensions,
  `jpg` et `jpeg` se partageant le même MIME), HEIC exclu.
  Le README ne mentionne aujourd'hui **aucune** limite d'upload.

⚠️ T9 et T14 écrivent tous deux dans le §3.2 de `GUIDE_Editeur.md`. Les traiter
comme **une seule édition de fichier**, sinon la seconde lecture repartira de la
version précédente et l'un des deux ajouts disparaîtra.

---

## 7. Récapitulatif des modifications

| Fichier | Repo | Lignes | Nature |
|---|---|---|---|
| `src/ui.ts` | `r2-image-picker` | ~+220 / −13 | CSS, HTML, état, 4 handlers drag, 3 générateurs, `orderedObjects()` + garde de confirmation |
| `src/ui.ts` (upload) | `r2-image-picker` | ~+105 / −6 | ordre des résultats (T10), traversal de dossier (T11), 2ᵉ input, plafonds, `ontimeout`/`onabort`, reset input, compteur drag, troncature des erreurs |
| `src/upload.ts` | `r2-image-picker` | +1 à +4 | **optionnel**, U6 seul : `uploaded` dans la réponse JSON |
| `README.md` | `r2-image-picker` | ~+8 | limites d'upload, qui n'y figurent pas aujourd'hui |
| `GUIDE_Editeur.md` | `QuoFai` | ~+45 | doc éditeur : §3.2 reçoit l'ordre visuel **en complément** de la méthode par lignes (conservée) + dossier et HEIC ; nouveau §4.13 |
| `.pages.yml` | `qfpdm` | −7 / +3 | **fait le 30/09/2026** (§1.4) |

**Zéro** : nouvelle dépendance, nouveau fichier source, nouvel endpoint,
migration de contenu, changement de schéma Zod, changement de CSS du site.

---

## 8. Pièges d'implémentation

### 8.1 Le script est un template literal — 4 règles non négociables

`src/ui.ts` construit toute la page dans un template literal JS. Les pièges déjà
rencontrés dans l'historique du repo (`PLAN-copy-all-urls-button.md`, section
« Bug fixes found during debug ») :

| Piège | Symptôme | Échappement |
|---|---|---|
| `\n` dans une string JS émise | Devient un **vrai saut de ligne** → `SyntaxError` | Écrire `\\n` dans `ui.ts` pour obtenir `\n` dans le JS émis. **C'est pourquoi `buildUrlsText()` utilise `BS + 'n'`** |
| Backslash dans une regex | Regex cassée | Doubler : `/\\/?[^/]+\\/?$/` (cf. `src/ui.ts:952`) |
| Apostrophe française | `SyntaxError` | `\"` ou `\u0027`, ou `\"…\"` |
| Accents | Illisibles dans la source | Convention existante : `\u00e9`, `\u00e8`, `\u00e0` (`src/ui.ts:673`, `src/ui.ts:880`) |

`applyOrderingChrome()` utilise `document.body.className = …` plutôt que
`classList.toggle` — `body` n'a aujourd'hui aucune classe, mais une affectation
directe reste non destructive.

### 8.2 Bug préexistant rencontré

`src/ui.ts:215` et `src/ui.ts:217` déclarent **deux fois** `<div id="uploadFilesize">`.
`getElementById` renvoie le premier ; le second est du markup mort. À corriger
en passant (supprimer `src/ui.ts:217`) — sans rapport avec cette fonctionnalité,
mais gratuit à corriger.

### 8.3 Cohérence cover encodé / non encodé

Les galeries existantes sont incohérentes : `soiree-disco-2005.md` a un `cover:`
**non encodé** (`…/Soirée_Disco_2005/PICT0051.jpg`) et des `images:`
**encodés** (`…/Soir%C3%A9e_Disco_2005/…`). Les deux fonctionnent (le navigateur
ré-encode), et `publicUrl()` (`src/ui.ts:236-238`) produit toujours de l'encodé.
**Décision : l'export émet de l'encodé partout**, c'est plus sûr et c'est ce que
fait déjà le picker. Ne pas tenter d'homogénéiser l'existant.

### 8.4 Un export peut être *valide et faux* — l'ordre doit avoir une source unique

Le danger numéro un n'est pas une erreur visible, c'est un résultat qui passe pour
correct. `copyAllUrls()` (`src/ui.ts:860-887`) relit le dossier via l'API et se
sert de `data.objects` **tel quel** : si `orderKeys` n'est pas appliqué là, le
bouton historique rend l'ordre naturel. Un éditeur qui a meticulously glissé 70
photos, puis clique « Toutes les URLs » par habitude, colle le résultat dans Page CMS,
publie — et perd l'ordonnancement **sans le moindre message d'erreur**.

Règle : **tout** chemin d'export passe par `orderedObjects()` (§3.2). Cette fonction
fusionne un ensemble quelconque du dossier avec `orderKeys` — clés ordonnées d'abord,
puis les autres dans l'ordre naturel — et déduplique au passage. Le tri par nom,
par date ou par taille ne peut plus décider l'ordre d'export, et un ordre partiel
(20 images déplacées sur 70) reste **complet** : les 50 autres suivent, pas perdues.

Corollaire d'UI : pendant l'ordonnancement, `applyOrderingChrome()` masque
`copyAllBtn` pour ne laisser qu'un chemin d'export visible. Il réapparaît à la sortie,
où il rend de nouveau l'ordre de tri naturel — comportement inchangé hors mode.

### 8.5 Le seul `confirm()` du code — précédent assumé

`confirmDiscardOrder()` introduit le **premier** `confirm()` de l'application. Le
choix est délibéré : `showToast` (`src/ui.ts:301`) est un helper passif d'une ligne,
 incapable d'interrompre une action, et il n'existe aucun motif de confirmation à
 réutiliser. Perdre 70 images d'ordonnancement sur un clic de dossier est un accident
coûteux ; la séquence n'est **pas** persistée (§2) donc il n'y a pas de
 récupération. Ne pas « simplifier » ce `confirm()` sans ajouter d'abord un annuler.

Les trois déclencheurs (navigation, « Terminer », Échap) passent tous par
`confirmDiscardOrder()`, et le drapeau `orderTouched` garantit qu'un ordre simplement
 *initialisé* (juste le tri par nom) ne déclenche jamais de dialogue.

---

## 9. Repli mobile — décision et coût

**L'API HTML5 Drag and Drop ne se déclenche pas au toucher.** Le repli retenu est
**Tier A : deux boutons ↑ / ↓ sur chaque card**, visibles uniquement en mode
ordonnancement.

- **Coût : ~45 lignes** (15 CSS dans T1, 30 JS dans T5) — 15 minutes.
- **Fonctionne à l'identique** sur souris, tactile et clavier (boutons focusables
  via `Tab`, car ce sont des `<button>` avec `aria-label`).
- Les boutons sont `disabled` en première et dernière position, donc un clavier
  de lecteur d'écran annonce correctement les bornes.

### Pourquoi le drag tactile *réel* n'est pas justifié

| Palier | Coût | Verdict |
|---|---|---|
| **A — boutons ↑/↓** | ~45 lignes, 15 min | **Retenu** |
| **B — drag tactile** (long-press, `touch-action`, pointer capture, autoscroll) | ~200 lignes, 2-3 h, risque de jank, test sur appareil requis | Refusé |
| **C — SortableJS** | ~10 lignes de code | Refusé |

Palier B est le poste le plus cher de la fonctionnalité — plus que tout le reste
réuni — et il devrait être testé sur un vrai téléphone.

Palier C est le moins cher en *code* mais le plus cher en *contraintes* : il n'y a
**aucune étape de build front** (`wrangler.toml` ne déclare que
`main = "src/index.ts"`, pas de commande `build`). Le script client vit dans un
template literal. Il faudrait donc soit vendoriser ~30 Ko de bibliothèque
minifiée dans le dépôt, soit ajouter un `<script src="https://cdn…">` — donc une
dépendance réseau externe dans un outil interne protégé par Cloudflare Access.

### Pourquoi le drag serait *pire* sur mobile même s'il fonctionnait

Au breakpoint `600px` (`src/ui.ts:145-146`), la grille passe à
`grid-template-columns:repeat(auto-fill,minmax(140px,1fr))` avec
`.card-image-wrap{height:130px}` → **2 colonnes**. Une galerie de 100 photos
représente ~50 lignes de défilement. Un long-press suivi d'un drag avec
autoscroll sur 50 lignes est une expérience **plus mauvaise** que deux tapes sur
↑/↓, même sans le moindre bug.

---

## 10. Hors périmètre

- **Tick-boxes / sélection multiple** — non demandé. Le réordonnancement est
  « tout le dossier, réordonné ». Si un jour nécessaire, l'état `orderKeys`
  existe déjà : ajouter `selectedKeys` et remplacer le filtre est un
  incrément de ~60 lignes.
- **Actions en masse sur une sélection** (supprimer, déplacer, télécharger un ZIP)
- **Étoile « définir comme couverture »** — la couverture par défaut est déjà la
  première image de l'ordre. À ajouter seulement si les couvertures découplées de
  l'ordre deviennent fréquentes.
- **Persistance `localStorage` de l'ordre par dossier** — utile si les sessions
  d'ordonnancement dépassent 40 photos
- **Réordonner plusieurs dossiers à la fois**
- **Suppression de `coverWidth` / `coverHeight`** (§1.3) — ballast mort, mais
  nettoyage séparé dans `qfpdm/`
- **Export direct vers Page CMS par HTTP** — non audited, Cloudflare Access,
  aucune API publique. L'export presse-papiers est le bon niveau.
- **Préserver l'arborescence du dossier uploadé** (§1.6, option B) — l'aplatissement est
  le défaut. Préserver exigerait d'assainir chaque segment et de garantir que le
  chemin ne peut pas remonter hors de `currentPrefix`. Interrupteur ultérieur,
  réversible et localisé.
- **Support HEIC / HEIF** (§1.6) — ni le client ni le serveur ne l'acceptent, et Cloudflare
  Image Resizing ne le transcode pas. Ouvrir la voie exigerait une conversion côté
  Worker (sharp) ou un pré-traitement local : décision produit, pas un correctif.
- **Téléversement en ZIP** — exigerait la décompression côté Worker ; hors de portée d'un
  outil interne dont les volumes sont quelques centaines de fichiers.
- **R2 Explorer** — cf. plan 16

---

## 11. Vérification

Aucune suite de tests n'existe dans `r2-image-picker` (`package.json` ne déclare
que `deploy` et `dev`). Validation manuelle via `npm run dev`.

**Fonctionnel**

1. `npm run dev` → dossier `galleries/` avec ≥ 30 images
2. **Copier les URLs** (existant) → toujours fonctionnel après factorisation T3
3. Clic sur une card hors mode ordonnancement → l'URL est copiée, overlay vert
4. **Ordonner** → les N images apparaissent, badge `1…N` visible
5. Trier par « Date » **puis** **Ordonner** → l'ordre initial suit le tri
6. Drag d'une card vers une autre → insertion à gauche/droite selon le curseur
7. ↑ / ↓ → déplacement d'un rang, boutons désactivés aux extrémités
8. Recherche active puis **Ordonner** → toutes les images présentes, pas
   seulement les résultats filtrés
9. **Copier les URLs** → les URL dans l'ordre visuel, une par ligne
10. Titre + date renseignés → **Copier le YAML** → bloc `title/date/cover/draft/images`
11. **Copier le .md** → fichier complet avec séparateurs `---`, et le toast
    annonce le nom de fichier suggéré
12. Coller le YAML dans un fichier de `qfpdm/src/content/galleries/` →
    `npm run build` sans erreur, galerie affichée dans l'ordre choisi
13. `Échap` → sortie du mode, retour au comportement normal
14. Navigation vers un sous-dossier en mode actif → mode quitté proprement
15. Clic racine → `#orderBtn` masqué (comme `#copyAllBtn`)
16. ~200 images → le chargement paginé va au bout, badge `200 image(s)`

**Régressions**

17. Focus clavier grille (↑ ↓ Entrée) inchangé hors mode ordonnancement
18. Upload multiple (v1.6) inchangé
19. Création de dossier, arbre latéral, fil d'Ariane inchangés
20. Mobile : la barre d'outils et la barre d'ordonnancement ne débordent pas à 375px

**Console**

21. Zéro `SyntaxError` au chargement de la page
22. `document.querySelectorAll('.card.dragging').length === 0` après tout drag

**Upload (T10–T14)** — à valider dans un dossier de test, pas en production

23. Sélectionner 12 fichiers **dans l'ordre connu** → les URL copiées automatiquement
    respectent cet ordre, et non l'ordre d'arrivée réseau. **C'est le test de U1** :
    comparer la première et la dernière URL de la liste aux noms choisis.
24. Re-sélectionner le **même** dossier deux fois de suite → la 2ᵉ fois prend bien effet
    (test de U2 : sans le reset, rien ne se passe et aucun message n'apparaît)
25. Glisser un dossier de ~150 photos (avec sous-dossiers) → **toutes** les images sont
    retenues. Le compte doit correspondre à un `find` en ligne de commande. Un dossier
    tronqué à ~100 fichiers trahit la boucle `readEntries` manquante (§1.6).
26. Dossier contenant `.DS_Store`, `Thumbs.db`, un `.heic` et un `.bmp` → les deux
    fichiers système sont ignorés sans bruit, `.heic` et `.bmp` rejetés avec un motif
    explicite, et **avant** tout envoi
27. Dossier de 600 fichiers → refusé avec « Lot trop volumineux (max 500) », rien n'est envoyé
28. Deux sous-dossiers contenant `img.jpg` → les deux sont conservés, le second
    portant un suffixe horodaté (§1.6, corollaire de l'aplatissement)
29. Fichier au `file.type` vide → accepté grâce au repli sur l'extension
30. Lot partiellement en échec → les réussites sont bien copiées, le message d'erreur est
    tronqué et lisible (U7)



31. Un fichier `.heic` seul dans un dossier → motif de rejet explicite en français,
    et le guide renvoie vers la compression (§10 du guide), pas vers un contournement
32. `webkitGetAsEntry` indisponible (Firefox ancien) → le drop de dossier retombe
    sur `DataTransfer.files` : les fichiers simples passent, le dossier non. Le lien
    « …ou choisissez un dossier » reste le chemin fiable sur ces navigateurs (§1.6)
33. Requête d'upload qui ne répond pas (test du composant réseau → « pending ») →
    l'upload se termine avec un message « Delai depasse », pas de blocage définitif (U11)

---

## 12. Risques

| Risque | Probabilité | Impact | Réduction |
|---|---|---|---|
| `SyntaxError` par `\n` / backslash / apostrophe (§8.1) | **Élevée** | Page blanche | Utiliser `BS + 'n'` partout ; `npx wrangler deploy` en local avant commit |
| Le drag est neutralisé par une régression de `renderGrid()` | Moyenne | Ordre perdu | Un seul point de rendu, testé (checklist 5-7) |
| `focusedGridIndex` pointe une card déplacée | Faible | Focus clavier décalé | Remis à `-1` à l'entrée et à la sortie |
| Divergence du nom de fichier `.md` vs slug Page CMS | Moyenne | `galleryRef` cassé | `extractIdFromRef` (`qfpdm/src/utils/gallery.ts`) compare le dernier segment d'URL. Vérifier le slug réel créé par Page CMS avant d'utiliser l'export `.md` en production |
| Grande galerie → temps de chargement | Faible | Attente | Limite 100/page ; 200 images = 2 requêtes. Toast de progression |
| `draft: false` par défaut contredit `.pages.yml` (`default: true`) | **Faible mais réelle** | Galerie publiée par inadvertement | Le toast et la documentation signalent le choix. Corriger dans le `.md` avant commit si la galerie doit rester brouillon |
| **Ordre d'achèvement des URL post-upload** (U1, §1.5) | **Certain** — c'est le comportement actuel | **P1** : galerie collée dans le désordre, silencieusement | T10, tableau préalloué indexé. À faire **avant** le reste |
| `readEntries()` non bouclé → dossier tronqué sans erreur | Moyenne si on écrit la traversal de mémoire | Perte silencieuse d'images | T11 fournit la boucle récursive complète ; test 25 |
| `webkitGetAsEntry()` indisponible (Firefox ancien, hors handler `drop`) | Moyenne | Le drop de dossier ne fonctionne pas | Repli explicite sur `DataTransfer.files` + feature-detect ; `webkitdirectory` couvre le cas clic |
| Aplatissement → collisions de noms entre sous-dossiers | **Certaine** si l'arborescence est utilisée | Noms horodatés dans l'export, pas de perte | Documenté (§1.6) et testé (28). Le serveur suffixe déjà, il n'écrase rien |
| HEIC rejeté en bloc pour un dossier d'iPhone | **Élevée** pour le public visé | Expérience « ça ne marche pas » | Documenté dans le guide (T14) plutôt que contourné dans le code (§10) |
| Lot de 3 000 fichiers sans plafond | Faible aujourd'hui, probable après T11 | Onglet gelé, 3 000 XHR | Plafonds 500 fichiers / 200 Mo (T11) |

---

## Annexe A — Références

| Sujet | Fichier : ligne |
|---|---|
| Point d'entrée UI | `r2-image-picker/src/ui.ts:3` |
| Clé R2 → URL publique | `r2-image-picker/src/ui.ts:236-238` |
| Bloc d'état | `r2-image-picker/src/ui.ts:240-283` |
| `focusedGridIndex` (point d'insertion T1) | `r2-image-picker/src/ui.ts:252` |
| `showToast` (helper passif, cf. §8.5) | `r2-image-picker/src/ui.ts:301` |
| `escapeHtml` (utilisé par T5) | `r2-image-picker/src/ui.ts:295` |
| `navigateTo` / `updateNavButtons` | `r2-image-picker/src/ui.ts:350` / `:367` |
| `ALLOWED_EXTENSIONS` injecté au client | `r2-image-picker/src/ui.ts:4` (motif), `:234` (`WEIGHT_WARNING`) |
| Upload : modal, sélection, lot | `r2-image-picker/src/ui.ts:562-611` (lot), `:653-674` (`selectFiles`) |
| Upload : `dropZone` + `fileInput` | `r2-image-picker/src/ui.ts:210-218`, `:928-943` |
| Upload : garde-fous serveur | `r2-image-picker/src/upload.ts:3-10` (MIME), `:43-50` (taille), `:52-65` (collision) |
| Config R2 / quotas | `r2-image-picker/wrangler.toml` (`ALLOWED_EXTENSIONS`, `MAX_UPLOAD_BYTES`) |
| Tri + recherche | `r2-image-picker/src/ui.ts:395-420` |
| Rendu grille | `r2-image-picker/src/ui.ts:422-471` |
| Clic = copier | `r2-image-picker/src/ui.ts:473-484` |
| Pagination | `r2-image-picker/src/api.ts:28-63` (plafond `limit` : l.34) |
| Copie exhaustive existante | `r2-image-picker/src/ui.ts:860-887` (boucle `while` : `:868-877`) |
| Focus clavier grille | `r2-image-picker/src/ui.ts:812-832` (`moveGridFocus` : `:812`, `activateFocusedItem` : `:827`) |
| Grille + breakpoints | `r2-image-picker/src/ui.ts:59`, `src/ui.ts:138-147` |
| Pipeline CI | `r2-image-picker/.github/workflows/deploy.yml` |
| Format frontmatter réel | `qfpdm/src/content/galleries/soiree-disco-2005.md` |
| Schéma Zod galeries | `qfpdm/src/content.config.ts` |
| Parsing `images` | `qfpdm/src/utils/gallery.ts` → `parseGalleryImages()` |
| `galleryRef` → id | `qfpdm/src/utils/gallery.ts` → `extractIdFromRef()` |
| Config Page CMS | `qfpdm/.pages.yml` |
| Cover ignorée | `qfpdm/src/components/CardCover.astro:16-24` |
| Dimensions lightbox optionnelles | `qfpdm/src/components/GalleryGrid.astro:23,29-30` + `qfpdm/src/layouts/Layout.astro:96-100` |
| Flux éditeur actuel | `GUIDE_Editeur.md:154-173`, `GUIDE_Editeur.md:334-348` |
| Analyse R2 Explorer | `dev/plans/16-r2-explorer-third-party-assessment.md` |