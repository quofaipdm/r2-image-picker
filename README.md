# r2-image-picker

A Cloudflare worker for managing media hosted on r2 
for the quofai.org website. 

## Fonctionnalités

- Navigation dans l'arborescence R2 (dossiers + images), tri, recherche
- Upload d'images ou d'un **dossier entier** (glisser-déposer ou sélecteur)
- **Mode ordonnancement** (`Ordonner`) : tri visuel par glisser-déposer ou
  flèches ▲/▼, puis export du bloc `images` dans l'ordre choisi
  (URLs, YAML de frontmatter, ou fichier `.md` complet)
- Copie d'URL au clic, copie de toutes les URLs d'un dossier
- Création de dossiers, thème clair/sombre, navigation clavier

Voir `../GUIDE_Editeur.md` (§4.13) pour le parcours éditeur.

## Limites d'upload

| Limite | Valeur |
|---|---|
| Poids par image | **4 Mo** (`MAX_UPLOAD_BYTES`, HTTP 413) |
| Nombre d'images par lot | **500** (`MAX_FILES`) |
| Poids total par lot | **200 Mo** (`MAX_TOTAL_BYTES`) |
| Requêtes simultanées | **3** (`CONCURRENCY`) |
| Délai par requête | **120 s** (`xhr.timeout`) |

> Un lot qui dépasse 500 fichiers ou 200 Mo est refusé **en bloc** : les motifs sont
> affichés dans la liste des rejets et **rien n'est envoyé**. Ces deux plafonds sont
> appliqués côté navigateur ; le serveur ne voit qu'un fichier par requête et ne
> contrôle donc que le poids unitaire.

Formats acceptés : **6** — JPEG, PNG, WebP, GIF, AVIF, SVG.

> Ce sont **7 extensions** pour 6 types MIME : `jpg` et `jpeg` partagent le
> même type (`image/jpeg`), les deux sont donc acceptés sans double comptage.

- **HEIC n'est pas accepté** (photos iPhone par défaut) : convertir en JPEG.
- Les fichiers non conformes sont **ignorés** avec un message, pas rejetés en bloc.
- Un nom déjà pris est renommé (`nom-<timestamp>-<n>.<ext>`), jamais écrasé.
- Les sous-dossiers d'un dossier déposé sont **aplatis** dans le dossier
  affiché ; les noms identiques sont donc renommés par le serveur.

Ces limites sont appliquées **côté serveur** (`src/upload.ts`) ; les mêmes
constantes de format sont injectées au client depuis `wrangler.toml`.

## Documentation

- `docs/PLAN-15-drag-order-export.md` — conception de l'ordonnancement et des
  exports (ordre session-only, `orderedObjects()` comme source de vérité).
