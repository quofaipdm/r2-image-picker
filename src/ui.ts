import type { Env } from './types';

export function renderUI(env: Env): Response {
  const weightWarningBytes = parseInt(env.WEIGHT_WARNING_BYTES, 10);
  // Liste unique des formats acceptes : elle vient de env (wrangler.toml), donc le
  // client ne peut plus etre plus large que le serveur, ni le rejeter a tort.
  // JSON.stringify produit le litteral de tableau dans le script client : ne jamais
  // ecrire ce tableau a la main dans la chaine (§8.1).
  const allowedExtensions = (env.ALLOWED_EXTENSIONS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mediatheque quofai</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-family:system-ui,-apple-system,sans-serif;font-size:16px;color:#1a1a1a;background:#f5f5f5;line-height:1.5}
body{min-height:100vh}
button{cursor:pointer;font:inherit}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
:focus-visible{outline:2px solid #2563eb;outline-offset:2px;border-radius:4px}
.header{background:#fff;border-bottom:1px solid #e0e0e0;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.header h1{font-size:1.25rem;font-weight:600}
.header-actions{display:flex;gap:8px}
.btn{padding:8px 16px;border-radius:6px;border:1px solid #d0d0d0;background:#fff;font-size:.875rem;font-weight:500;transition:background .15s,box-shadow .15s}
.btn:hover{background:#f0f0f0}
.btn-primary{background:#2563eb;color:#fff;border-color:#2563eb}
.btn-primary:hover{background:#1d4ed8}

.toolbar{display:flex;align-items:center;gap:12px;padding:10px 20px;background:#fff;border-bottom:1px solid #e0e0e0;flex-wrap:wrap}
.nav-arrows{display:flex;gap:4px}
.nav-arrows .btn{padding:6px 10px;font-size:.875rem;line-height:1}
.nav-arrows .btn:disabled{opacity:.4;cursor:default}

.sidebar-toggle-mobile{display:none;background:none;border:none;font-size:1.25rem;padding:4px;cursor:pointer;line-height:1}

.app-layout{display:flex;gap:16px;align-items:flex-start;padding:16px 20px;max-width:1200px;margin:0 auto}
.main-content{flex:1;min-width:0}
.main-content .breadcrumb{margin-bottom:12px}
.main-content .content{padding:0;max-width:none}

.search-input{flex:1;min-width:180px;padding:8px 12px;border:1px solid #d0d0d0;border-radius:6px;font-size:.875rem}
.sort-group{display:flex;gap:4px}
.sort-btn{padding:6px 12px;border:1px solid #d0d0d0;border-radius:4px;background:#fff;font-size:.8125rem;transition:background .15s}
.sort-btn:hover{background:#f0f0f0}
.sort-btn.active{background:#2563eb;color:#fff;border-color:#2563eb}
.btn-copy-all{background:#16a34a;color:#fff;border-color:#16a34a;flex-shrink:0;white-space:nowrap}
.btn-copy-all:hover{background:#15803d}
.btn-copy-all:disabled{opacity:.5;cursor:default}

.breadcrumb{background:#fff;padding:8px 20px;border-bottom:1px solid #e0e0e0;font-size:.8125rem;color:#555}
.breadcrumb a{color:#2563eb}
.breadcrumb a:hover{text-decoration:underline}
.breadcrumb span{color:#999}

.content{max-width:1200px;margin:0 auto;padding:20px}
.folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px}
.folder-card{display:flex;align-items:center;gap:8px;padding:12px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:box-shadow .15s,transform .15s;font-size:.875rem}
.folder-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.08);transform:translateY(-1px)}
.folder-icon{font-size:1.5rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.card{position:relative;background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;cursor:pointer;transition:box-shadow .15s,transform .15s}
.card:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);transform:translateY(-2px)}
.card-image-wrap{position:relative;width:100%;height:180px;overflow:hidden;background:#f0f0f0}
.card-image-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.card-image-wrap .error-fallback{display:none;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:16px;color:#999;font-size:.75rem;text-align:center}
.card-image-wrap .error-fallback svg{width:32px;height:32px;margin-bottom:8px;opacity:.4}
.card-info{padding:8px 10px 10px}
.card-size{font-size:.75rem;color:#777;margin-bottom:2px}
.card-size.warning{color:#f59e0b;font-weight:600}
.card-name{font-size:.8125rem;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-name::before{content:attr(data-fullname);display:none}
.copy-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(22,163,74,.9);color:#fff;opacity:0;pointer-events:none;transition:opacity .2s}
.copy-overlay.show{opacity:1}
.copy-overlay svg{width:36px;height:36px;margin-bottom:6px}
.copy-overlay span{font-size:.875rem;font-weight:600}

.sidebar{width:240px;flex-shrink:0;background:#fff;border:1px solid #e0e0e0;border-radius:8px;position:sticky;top:16px;max-height:calc(100vh - 140px);overflow-y:auto}
.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #e0e0e0;font-size:.8125rem;font-weight:600;color:#555}
#newFolderBtn{padding:2px 8px;font-size:1rem;line-height:1;border:1px solid #d0d0d0;border-radius:4px;background:#fff;cursor:pointer}
#newFolderBtn:hover{background:#f0f0f0}

.tree{font-size:.875rem;color:#333;padding:4px 0}
.tree-item{display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;border-radius:0 4px 4px 0;transition:background .1s;user-select:none;border-left:3px solid transparent}
.tree-item:hover{background:#f0f0f0}
.tree-item.active{background:#e8f0fe;color:#2563eb;font-weight:600;border-left-color:#2563eb}
.tree-toggle{font-size:1rem;width:16px;text-align:center;flex-shrink:0;color:#666;transition:transform .15s}
.tree-toggle.open{transform:rotate(90deg)}
.tree-item-icon{flex-shrink:0;font-size:.875rem}
.tree-item-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tree-children{display:none;padding-left:20px}
.tree-children.open{display:block}

.new-folder-form{display:flex;gap:6px;padding:6px 10px;border-top:1px solid #e0e0e0}
.new-folder-form input{flex:1;padding:4px 8px;border:1px solid #2563eb;border-radius:4px;font-size:.8125rem;outline:none}
.new-folder-form button{padding:4px 8px;border:1px solid #d0d0d0;border-radius:4px;background:#fff;cursor:pointer;font-size:.75rem}
.new-folder-form button:hover{background:#f0f0f0}

.card.focused{outline:2px solid #2563eb;outline-offset:2px}
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
.order-note{flex-basis:100%;color:#555;margin:-4px 0 0}
.order-actions{flex-basis:100%;display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;margin-top:2px}
.order-group{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.order-group-label{color:#1e40af;font-weight:500}
.order-exports{display:flex;gap:8px;flex-wrap:wrap}
.btn-export{background:#fff;border-color:#2563eb;color:#2563eb}
.btn-export:hover{background:#e8f0fe}
.btn-export-primary{background:#2563eb;color:#fff;border-color:#2563eb}
.btn-export-primary:hover{background:#1d4ed8}
.order-help{margin-left:auto;background:none;border:none;color:#1e40af;font-size:.8125rem;font-weight:500;text-decoration:underline;cursor:pointer;padding:0;white-space:nowrap}
.order-help:hover{color:#1d4ed8}
.order-help-panel{flex-basis:100%;display:none;background:#fff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 12px;color:#333;margin-top:8px}
.order-help-panel.open{display:block}
.order-help-panel p{margin:0 0 6px}
.order-help-panel p:last-child{margin-bottom:0}
.btn-order{background:#7c3aed;color:#fff;border-color:#7c3aed;flex-shrink:0;white-space:nowrap}
.btn-order:hover{background:#6d28d9}
body.ordering .btn-order{background:#fff;color:#7c3aed}
body.ordering .btn-order:hover{background:#f3e8ff}
.btn-order:disabled{opacity:.5;cursor:default}

.load-more-wrap{text-align:center;padding:24px 0}
.load-more-wrap .btn{padding:10px 24px}
.loading,.empty-state,.error-state{text-align:center;padding:40px 20px;color:#777;font-size:.875rem}
.loading::after{content:'';display:inline-block;width:20px;height:20px;margin-left:8px;border:2px solid #d0d0d0;border-top-color:#2563eb;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.empty-state svg,.error-state svg{width:40px;height:40px;margin-bottom:12px;opacity:.3}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;color:#fff;font-size:.875rem;font-weight:500;z-index:1000;opacity:0;transition:opacity .3s;pointer-events:none}
.toast.show{opacity:1}
.toast.success{background:#16a34a}
.toast.error{background:#dc2626}
.upload-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;align-items:center;justify-content:center}
.upload-modal.open{display:flex}
.upload-panel{background:#fff;border-radius:12px;padding:24px;width:90%;max-width:480px;max-height:90vh;overflow-y:auto}
.upload-panel h2{font-size:1.125rem;font-weight:600;margin-bottom:16px}
.drop-zone{border:2px dashed #d0d0d0;border-radius:8px;padding:32px 16px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s;margin-bottom:16px}
.drop-zone:hover,.drop-zone.dragover{border-color:#2563eb;background:#f0f7ff}
.drop-zone p{font-size:.875rem;color:#555;margin-top:8px}
.drop-folder-link{margin-top:12px;padding:4px 10px;border:none;background:none;color:#2563eb;font-size:.8125rem;text-decoration:underline}
.drop-folder-link:hover{color:#1d4ed8}
.drop-zone .file-icon{font-size:2rem}
.drop-zone.has-file{border-color:#16a34a;background:#f0fdf4}
.upload-progress{margin-bottom:16px;display:none}
.upload-progress.show{display:block}
.upload-progress progress{width:100%;height:8px;border-radius:4px}
.upload-progress progress::-webkit-progress-bar{background:#e0e0e0;border-radius:4px}
.upload-progress progress::-webkit-progress-value{background:#2563eb;border-radius:4px}
.upload-progress .progress-text{font-size:.75rem;color:#555;margin-top:4px}
.upload-actions{display:flex;gap:8px;justify-content:flex-end}
#upload-filesize{font-size:.75rem;color:#777;margin-top:4px;margin-bottom:12px;display:none}

.sidebar-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:899}
.sidebar-backdrop.show{display:block}

@media(max-width:768px){
  .app-layout{flex-direction:column;padding:12px}
  .sidebar{position:fixed;inset:0;z-index:900;width:280px;max-height:100vh;border-radius:0;transform:translateX(-100%);transition:transform .2s;top:0}
  .sidebar.open{transform:translateX(0)}
  .sidebar-backdrop.show{display:block}
  .sidebar-toggle-mobile{display:block}
}

@media(max-width:600px){
  .header{padding:10px 12px}
  .header h1{font-size:1rem}
  .toolbar{padding:10px 12px;flex-direction:column;align-items:stretch}
  .search-input{min-width:0}
  .sort-group{justify-content:center}
  .content{padding:12px}
  .grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
  .card-image-wrap{height:130px}
  .order-bar{padding:10px 12px}
  .order-actions{gap:12px}
  .order-help{margin-left:0}
  .order-bar .search-input{flex:1;min-width:0;max-width:none!important}
}
</style>
</head>
<body>
<div class="header">
  <h1>La Mediathèque du site de Quo Fai Pas de Mau</h1>
  <div class="header-actions">
    <button class="sidebar-toggle-mobile" id="sidebarToggle" aria-label="Menu dossiers">☰</button>
    <button class="btn btn-primary" id="uploadBtn" aria-label="Uploader une image">Uploader</button>
  </div>
</div>

<div class="toolbar">
  <div class="nav-arrows">
    <button class="btn" id="backBtn" disabled aria-label="Precedent">◀</button>
    <button class="btn" id="forwardBtn" disabled aria-label="Suivant">▶</button>
    <button class="btn" id="upBtn" disabled aria-label="Dossier parent">▲</button>
  </div>
  <input type="search" class="search-input" id="searchInput" placeholder="Rechercher une image..." aria-label="Rechercher une image par nom">
  <button class="btn btn-copy-all" id="copyAllBtn" aria-label="Copier toutes les URLs du dossier">Copier les URLs</button>
  <button class="btn btn-order" id="orderBtn" aria-label="Ordonner les images du dossier et exporter la galerie">Ordonner</button>
  <div class="sort-group" role="group" aria-label="Tri des images">
    <button class="sort-btn active" data-sort="name" aria-label="Trier par nom">Nom</button>
    <button class="sort-btn" data-sort="date" aria-label="Trier par date">Date</button>
    <button class="sort-btn" data-sort="size" aria-label="Trier par poids">Poids</button>
  </div>
</div>

<div class="sidebar-backdrop" id="sidebarBackdrop"></div>

<div class="app-layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <span>Dossiers</span>
      <button class="btn" id="newFolderBtn" aria-label="Nouveau dossier">+</button>
    </div>
    <nav class="tree" id="treeContainer" aria-label="Arborescence des dossiers"></nav>
  </aside>

  <main class="main-content">
    <div class="breadcrumb" id="breadcrumb" role="navigation" aria-label="Fil d'Ariane"></div>
    <div class="order-bar" id="orderBar" style="display:none">
      <span class="order-hint">Glissez les images pour fixer leur ordre</span>
      <span class="order-count" id="orderCount"></span>
      <input type="text" id="galleryTitle" class="search-input" style="max-width:220px" placeholder="Nom de la galerie" aria-label="Nom de la galerie">
      <input type="date" id="galleryDate" class="search-input" style="max-width:150px" aria-label="Date de l'evenement">
      <p class="order-note">L'ordre n'est enregistré que dans votre presse-papiers : rien n'est envoyé au site.</p>
      <div class="order-actions">
        <div class="order-group">
          <span class="order-group-label" id="exportUrlsLabel">Pour mettre la galerie en ligne — dans Page CMS</span>
          <div class="order-exports">
            <button class="btn btn-export btn-export-primary" id="exportUrlsBtn" aria-describedby="exportUrlsLabel">Copier les URLs</button>
          </div>
        </div>
        <div class="order-group">
          <span class="order-group-label" id="exportMdLabel">Pour un développeur — dépôt Git</span>
          <div class="order-exports">
            <button class="btn btn-export" id="exportMdBtn" aria-describedby="exportMdLabel">Copier le .md</button>
          </div>
        </div>
        <button class="order-help" id="orderHelpBtn" type="button" aria-expanded="false" aria-controls="orderHelpPanel">Comment publier ?</button>
      </div>
      <div class="order-help-panel" id="orderHelpPanel">
        <p><strong>Où coller les URLs ?</strong> Dans Page CMS, dans le champ « Images » : une URL par ligne, l'ordre des lignes devient l'ordre dans la lightbox.</p>
        <p><strong>Et la couverture ?</strong> C'est la première URL de la liste — à coller aussi dans « Photo de couverture ».</p>
        <p><strong>Brouillon ou publié ?</strong> Une galerie créée dans Page CMS reste en brouillon : décochez « Brouillon » pour la publier. Le fichier .md, lui, arrive avec draft: false et se publie dès le dépôt.</p>
      </div>
    </div>

    <div class="content" id="content">
      <div class="loading" id="loadingIndicator">Chargement</div>
      <div class="folders" id="foldersContainer" style="display:none"></div>
      <div class="grid" id="gridContainer" style="display:none"></div>
      <div class="load-more-wrap" id="loadMoreWrap" style="display:none">
        <button class="btn" id="loadMoreBtn" aria-label="Charger 24 suivantes">Charger 24 suivantes</button>
      </div>
      <div class="empty-state" id="emptyState" style="display:none">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <p>Aucune image dans ce dossier</p>
      </div>
      <div class="error-state" id="errorState" style="display:none">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        <p>Erreur de chargement</p>
      </div>
    </div>
  </main>
</div>

<div class="upload-modal" id="uploadModal" role="dialog" aria-label="Uploader une image">
  <div class="upload-panel">
    <h2>Uploader une image</h2>
    <div class="drop-zone" id="dropZone" role="button" tabindex="0" aria-label="Zone de glisser-deposer ou cliquer pour selectionner">
      <div class="file-icon" id="dropIcon">+</div>
      <p id="dropText">Glissez des images ou un dossier ici, ou cliquez pour parcourir</p>
      <button type="button" class="drop-folder-link" id="folderLink" aria-label="Uploader un dossier entier">…ou choisissez un dossier</button>
    </div>
    <input type="file" id="fileInput" accept="image/*" multiple style="display:none" aria-hidden="true">
    <!-- Input dedie au dossier : webkitdirectory sur #fileInput ferait passer le
         selecteur natif en mode « dossier uniquement » et casserait la selection de
         fichiers individuels, qui est le parcours le plus utilise. -->
    <input type="file" id="folderInput" webkitdirectory directory multiple style="display:none" aria-hidden="true">
    <div id="uploadFilesize"></div>
    <div id="uploadFileList" style="max-height:180px;overflow-y:auto;margin-bottom:12px"></div>
</div>
    <div class="upload-progress" id="uploadProgress">
      <progress id="progressBar" value="0" max="100"></progress>
      <div class="progress-text" id="progressText">0%</div>
    </div>
    <div id="uploadError" style="color:#dc2626;font-size:.8125rem;margin-bottom:12px;display:none"></div>
    <div class="upload-actions">
      <button class="btn" id="uploadCancelBtn" aria-label="Annuler">Annuler</button>
      <button class="btn btn-primary" id="uploadSubmitBtn" disabled aria-label="Confirmer l'upload">Envoyer</button>
    </div>
  </div>
</div>

<div class="toast" id="toast" role="alert" aria-live="polite"></div>

<script>
const BASE_URL = "${env.PUBLIC_R2_BASE_URL}";
const WEIGHT_WARNING = ${weightWarningBytes};
// Extensions reellement acceptees par le serveur (upload.ts ALLOWED_MIMES), et non
// un « image/* » plus large : c'est ce qui faisait accepter un .bmp ou un .heic pour
// le rejeter apres coup, et refusait a tort ce que le serveur aurait accepte.
const ALLOWED_EXTS = new Set(${JSON.stringify(allowedExtensions)});
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

function publicUrl(key) {
  return BASE_URL + '/' + key.split('/').map(encodeURIComponent).join('/');
}

let currentPrefix = '';
let currentCursor = null;
let allObjects = [];
let displayedPrefixes = [];
let currentSort = 'name';
let currentSortDir = 'desc';
let searchQuery = '';

const treeCache = {};
const treeExpanded = new Set();
let navHistory = [''];
let navIndex = 0;
let focusedGridIndex = -1;

// --- Ordonnancement manuel (§ Plan 15) ---
// L'ordre manuel vit dans un TABLEAU de cles, pas dans le DOM : renderGrid()
// reconstruit innerHTML en entier a chaque rendu, donc tout ordre ecrit dans le DOM
// serait efface au rendu suivant. orderKeys est la seule source de verite de
// l'ordre visuel, et il prime sur le tri.
let orderingMode = false;
let orderObjects = [];
let orderKeys = [];
let dragKey = null;
// Distingue un ordre simplement INITIALISE (tri par nom/date) d'un ordre CHOISI par
// l'editeur. Seul le second declenche une confirmation a la sortie.
let orderTouched = false;

const breadcrumb = document.getElementById('breadcrumb');
const foldersContainer = document.getElementById('foldersContainer');
const gridContainer = document.getElementById('gridContainer');
const loadMoreWrap = document.getElementById('loadMoreWrap');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');

const searchInput = document.getElementById('searchInput');
const sortBtns = document.querySelectorAll('.sort-btn');
const orderBar = document.getElementById('orderBar');
const orderCount = document.getElementById('orderCount');
const orderBtn = document.getElementById('orderBtn');
const copyAllBtn = document.getElementById('copyAllBtn');


const uploadBtn = document.getElementById('uploadBtn');
const uploadModal = document.getElementById('uploadModal');
const uploadCancelBtn = document.getElementById('uploadCancelBtn');
const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const folderLink = document.getElementById('folderLink');
const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const dropIcon = document.getElementById('dropIcon');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const uploadError = document.getElementById('uploadError');
const uploadFilesize = document.getElementById('uploadFilesize');
const toast = document.getElementById('toast');

let selectedFiles = [];
let selectedTotalBytes = 0;
let dropDragDepth = 0;
let rejectedFiles = [];
let uploading = false;

function formatSize(bytes) {
  if (bytes < 1000000) return Math.round(bytes / 1000) + ' Ko';
  return (bytes / 1000000).toFixed(1) + ' Mo';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._hide);
  toast._hide = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function showError(message) {
  uploadError.textContent = message;
  uploadError.style.display = 'block';
}

function hideError() {
  uploadError.style.display = 'none';
}

function setLoading(loading) {
  loadingIndicator.style.display = loading ? '' : 'none';
}

function setEmpty(empty) {
  emptyState.style.display = empty ? '' : 'none';
}

function setError(err) {
  errorState.style.display = err ? '' : 'none';
}

function renderBreadcrumb() {
  if (!currentPrefix) {
    breadcrumb.innerHTML = '<span>Accueil</span>';
    return;
  }
  const parts = currentPrefix.replace(/\\/$/, '').split('/');
  let acc = '';
  let html = '<a href="#" data-prefix="">Accueil</a>';
  parts.forEach((p) => {
    acc += p + '/';
    html += ' <span>›</span> <a href="#" data-prefix="' + escapeHtml(acc) + '">' + escapeHtml(p) + '</a>';
  });
  breadcrumb.innerHTML = html;
  breadcrumb.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(a.dataset.prefix);
    });
  });
}

function navigateTo(prefix, pushHistory) {
  // Sortir du mode avant le rechargement, en confirmant si un ordre a ete choisi a
  // la main : un clic sur un dossier ne doit pas effacer sans bruit une sequence de
  // 70 images. Le return annule toute la navigation, donc la grille affichee et
  // l'ordre courant restent coherents entre eux.
  if (orderingMode && !confirmDiscardOrder()) return;
  if (orderingMode) exitOrderingMode();
  if (pushHistory !== false && prefix !== currentPrefix) {
    navHistory = navHistory.slice(0, navIndex + 1);
    navHistory.push(prefix);
    navIndex = navHistory.length - 1;
  }
  currentPrefix = prefix;
  currentCursor = null;
  allObjects = [];
  displayedPrefixes = [];
  setError(false);
  renderBreadcrumb();
  expandPathTo(prefix);
  updateNavButtons();
  loadItems();
}

function updateNavButtons() {
  document.getElementById('backBtn').disabled = navIndex <= 0;
  document.getElementById('forwardBtn').disabled = navIndex >= navHistory.length - 1;
  document.getElementById('upBtn').disabled = !currentPrefix;
  document.getElementById('copyAllBtn').style.display = currentPrefix ? '' : 'none';
  orderBtn.style.display = currentPrefix ? '' : 'none';
}

function renderFolders(prefixes) {
  if (!prefixes || prefixes.length === 0) {
    foldersContainer.style.display = 'none';
    return;
  }
  displayedPrefixes = prefixes;
  let html = '';
  prefixes.forEach(p => {
    const name = p.replace(/\\/$/, '').split('/').pop();
    html += '<div class="folder-card" role="button" tabindex="0" data-prefix="' + escapeHtml(p) + '" aria-label="Ouvrir le dossier ' + escapeHtml(name) + '">';
    html += '<span class="folder-icon">📁</span><span>' + escapeHtml(name) + '</span>';
    html += '</div>';
  });
  foldersContainer.innerHTML = html;
  foldersContainer.style.display = '';
  foldersContainer.querySelectorAll('.folder-card').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.prefix));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo(el.dataset.prefix); } });
  });
}

function sortObjects(list) {
  const sorted = [...list];
  switch (currentSort) {
    case 'name':
      sorted.sort((a, b) => a.key.localeCompare(b.key));
      break;
    case 'date':
      sorted.sort((a, b) => {
        const diff = new Date(a.uploaded).getTime() - new Date(b.uploaded).getTime();
        return currentSortDir === 'desc' ? -diff : diff;
      });
      break;
    case 'size':
      sorted.sort((a, b) => {
        const diff = a.size - b.size;
        return currentSortDir === 'desc' ? -diff : diff;
      });
      break;
  }
  return sorted;
}

// Ordre manuel applique a un ensemble arbitraire (le dossier courant complet).
// Les cles ordonnees viennent en tete, dans l'ordre choisi ; les autres suivent,
// dans l'ordre naturel. C'est LA source de verite de l'ordre pour TOUT export :
// tout chemin qui produit des URLs doit passer par ici.
function orderedObjects(source) {
  const byKey = new Map(source.map((o) => [o.key, o]));
  const out = [];
  const seen = new Set();
  for (const k of orderKeys) {
    const o = byKey.get(k);
    if (o && !seen.has(k)) { out.push(o); seen.add(k); }
  }
  for (const o of source) if (!seen.has(o.key)) out.push(o);
  return out;
}

function getSortedObjects() {
  // Court-circuit AVANT le filtre : l'ordre manuel porte sur le dossier entier.
  // Filtrer ici ferait croire a une selection, alors que rien n'est selectionne.
  if (orderingMode) return orderedObjects(orderObjects);
  const filtered = allObjects.filter(o => {
    if (!searchQuery) return true;
    const name = o.key.split('/').pop().toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });
  return sortObjects(filtered);
}

function renderGrid() {
  const objects = getSortedObjects();
  if (objects.length === 0 && displayedPrefixes.length === 0) {
    gridContainer.style.display = 'none';
    setEmpty(!currentCursor);
    return;
  }
  setEmpty(false);
  let html = '';
  // Construit UNE fois par rendu, avant la boucle : orderKeys.indexOf(key) serait
  // O(n) par card, donc O(n^2) par rendu sur un dossier de 70 images, et renverrait
  // -1 (position 0) pour une cle absente. Une Map donne O(1) et distingue l'absence.
  const posByKey = new Map(orderKeys.map((k, i) => [k, i + 1]));
  objects.forEach(obj => {
    const key = obj.key;
    const name = key.split('/').pop();
    const url = publicUrl(key);
    const sizeStr = formatSize(obj.size);
    const isWarning = obj.size > WEIGHT_WARNING;
    const posLabel = orderingMode
      ? (posByKey.has(key) ? 'Position ' + posByKey.get(key) + ' sur ' + orderKeys.length + ' : ' : '')
      : 'Copier l' + "'" + 'URL de ';
    html += '<div class="card" role="button" tabindex="0" data-key="' + escapeHtml(key) + '" aria-label="'
      + posLabel
      + escapeHtml(name) + '">';
    html += '<div class="card-image-wrap">';
    html += '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(name) + '" loading="lazy">';
    html += '<div class="error-fallback">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>';
    html += '<span>' + escapeHtml(name) + '</span>';
    html += '</div></div>';
    html += '<div class="card-info">';
    html += '<div class="card-size' + (isWarning ? ' warning' : '') + '">' + (isWarning ? '⚠ ' : '') + sizeStr + '</div>';
    html += '<div class="card-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div>';
    html += '</div>';
    if (orderingMode) {
      const pos = posByKey.get(key);
      // Ne pas retomber sur 1 : une cle absente de orderKeys est un etat
      // incoherent, et l'afficher en position 1 produirait un badge faux.
      // Mieux vaut un marqueur vide qu'un mensonge visible.
      const marker = pos === undefined ? '' : '<div class="card-order">' + pos + '</div>';
      html += marker;
      html += '<div class="card-nudge">'
        + '<button class="nudge-up" data-dir="-1" aria-label="Monter ' + escapeHtml(name) + '"' + (pos === 1 ? ' disabled' : '') + '>&#9650;</button>'
        + '<button class="nudge-down" data-dir="1" aria-label="Descendre ' + escapeHtml(name) + '"' + (pos === orderKeys.length ? ' disabled' : '') + '>&#9660;</button>'
        + '</div>';
    }
    html += '<div class="copy-overlay"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg><span>Copie !</span></div>';
    html += '</div>';
  });
  gridContainer.innerHTML = html;
  gridContainer.style.display = '';

  gridContainer.querySelectorAll('.card-image-wrap img').forEach(img => {
    img.addEventListener('error', function () {
      this.style.display = 'none';
      const fb = this.nextElementSibling;
      if (fb && fb.classList.contains('error-fallback')) {
        fb.style.display = 'flex';
      }
    });
  });

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
      // Pas de handler de clic en mode ordonnancement : le clic sur une card ne
      // copie plus l'URL, il ne fait rien. C'est voulu (le clic entre en conflit
      // avec le drag).
      return;
    }
    const url = publicUrl(key);
    const handler = () => copyUrl(el, key, url);
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });
}

// Repli tactile : le drag HTML5 ne se declenche pas au toucher. Les deux boutons
// font le meme mouvement que le drag, en reduit.
function nudge(dir, key) {
  const i = orderKeys.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= orderKeys.length) return;
  [orderKeys[i], orderKeys[j]] = [orderKeys[j], orderKeys[i]];
  orderTouched = true;
  renderGrid();
}

function onDragStart(e) {
  const card = e.currentTarget;
  dragKey = card.dataset.key;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragKey);
  card.classList.add('dragging');
}

// Idempotent : apres un drop, renderGrid() a deja reconstruit la grille et
// dragKey est remis a null, donc il n'y a plus rien a nettoyer. C'est ce qui rend
// sans consequence la destruction de l'element source par renderGrid().
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

function copyUrl(el, key, url) {
  navigator.clipboard.writeText(url).then(() => {
    const overlay = el.querySelector('.copy-overlay');
    if (overlay) overlay.classList.add('show');
    clearTimeout(el._copyTimer);
    el._copyTimer = setTimeout(() => {
      if (overlay) overlay.classList.remove('show');
    }, 2000);
  }).catch(() => {
    showToast('Erreur de copie', 'error');
  });
}

async function loadItems(append) {
  if (!append) {
    setLoading(true);
    setError(false);
  }
  try {
    const params = new URLSearchParams({ prefix: currentPrefix, limit: '24' });
    if (currentCursor) params.set('cursor', currentCursor);
    const res = await fetch('/api/list?' + params.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (!append) {
      allObjects = data.objects;
      renderFolders(data.prefixes);
    } else {
      allObjects = allObjects.concat(data.objects);
      if (data.prefixes && data.prefixes.length > 0) {
        displayedPrefixes = data.prefixes;
        renderFolders(data.prefixes);
      }
    }
    currentCursor = data.cursor;
    renderGrid();

    loadMoreWrap.style.display = data.truncated ? '' : 'none';
    setLoading(false);
  } catch (err) {
    console.error('Load error:', err);
    setLoading(false);
    if (!append) {
      setError(true);
      gridContainer.style.display = 'none';
      foldersContainer.style.display = 'none';
    } else {
      showToast('Erreur de chargement', 'error');
    }
  }
}

function uploadOne(file, prefix) {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prefix', prefix);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progressBar.value = Math.round((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
          resolve({ ok: true, obj: body });
        } else if (xhr.status === 413) {
          resolve({ ok: false, name: file.name, reason: 'Trop lourd (> 4 Mo)' });
        } else if (xhr.status === 415) {
          resolve({ ok: false, name: file.name, reason: 'Format non autorise' });
        } else {
          resolve({ ok: false, name: file.name, reason: body.error || 'Erreur serveur' });
        }
      } catch {
        resolve({ ok: false, name: file.name, reason: 'Reponse invalide' });
      }
    };
    xhr.onerror = () => resolve({ ok: false, name: file.name, reason: 'Erreur reseau' });
    // Sans ces deux handlers, une requete figee (page d'authentification Cloudflare
    // Access, connexion bloquee) ne resout jamais : le worker reste bloque sur son
    // index, Promise.all ne rend pas la main et le bouton reste desactive definitivement.
    // Chaque branche doit donc resoudre, y compris les cas non prevus plus bas.
    xhr.timeout = 120000;
    xhr.ontimeout = () => resolve({ ok: false, name: file.name, reason: 'Delai depasse' });
    xhr.onabort = () => resolve({ ok: false, name: file.name, reason: 'Annule' });
    xhr.send(formData);
  });
}

// Liste d'echecs tronquee : au-dela de 5 entrees le message devient illisible dans
// le panneau d'upload, alors que le compte exact est deja donne juste avant.
function summarizeFailures(list) {
  const shown = list.slice(0, 5).map((f) => f.name + ' (' + f.reason + ')');
  if (list.length > 5) shown.push('\u2026 et ' + (list.length - 5) + ' autres');
  return shown.join(', ');
}

async function uploadFiles() {
  if (uploading || selectedFiles.length === 0) return;
  uploading = true;
  uploadSubmitBtn.disabled = true;
  uploadProgress.className = 'upload-progress show';
  progressBar.value = 0;
  progressText.textContent = '0%';
  hideError();

  const files = selectedFiles;
  // Préalloué et rempli par indice : avec push(), le tableau se remplirait dans
  // l'ordre d'ARRIVÉE réseau des 3 requêtes concurrentes, donc les URL copiées
  // seraient dans le désordre de la sélection — un résultat valide mais faux (U1).
  // Chaque uploadOne() a un timeout, donc chaque worker résout toujours (U11).
  const results = new Array(files.length);
  let completed = 0;
  let index = 0;

  const CONCURRENCY = 3;
  const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
    while (index < files.length) {
      const i = index++;
      const res = await uploadOne(files[i], currentPrefix);
      results[i] = res;
      completed++;
      const pct = Math.round((completed / files.length) * 100);
      progressBar.value = pct;
      progressText.textContent = completed + '/' + files.length + ' \u00b7 ' + pct + '%';
    }
  });
  await Promise.all(workers);

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  ok.forEach((r) => {
    allObjects.unshift({ key: r.obj.key, size: r.obj.size, uploaded: r.obj.uploaded || new Date().toISOString(), contentType: r.obj.contentType || null });
  });
  if (ok.length > 0) renderGrid();

  uploading = false;
  uploadProgress.className = 'upload-progress';

  if (failed.length === 0) {
    const urls = ok.map((r) => r.obj.url);
    navigator.clipboard.writeText(urls.join('\\n')).catch(() => {});
    closeUploadModal();
    showToast(ok.length + ' upload\u00e9e(s), URL(s) copi\u00e9e(s) !', 'success');
  } else {
    showError(failed.length + ' \u00e9chec(s) : ' + summarizeFailures(failed));
    showToast(ok.length + ' upload\u00e9e(s), ' + failed.length + ' en \u00e9chec', 'error');
  }
}

function openUploadModal() {
  selectedFiles = [];
  selectedTotalBytes = 0;
  rejectedFiles = [];
  hideError();
  uploadProgress.className = 'upload-progress';
  uploadFilesize.style.display = 'none';
  uploadFilesize.textContent = '';
  uploadSubmitBtn.disabled = true;
  dropDragDepth = 0;
  refreshDropZoneChrome();
  dropIcon.textContent = '+';
  dropText.textContent = 'Glissez des images ou un dossier ici, ou cliquez pour parcourir';
  const fileListEl = document.getElementById('uploadFileList');
  if (fileListEl) fileListEl.innerHTML = '';
  uploadModal.className = 'upload-modal open';
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  uploadModal.className = 'upload-modal';
  document.body.style.overflow = '';
  selectedFiles = [];
  selectedTotalBytes = 0;
  rejectedFiles = [];
}

// dragenter/dragleave se declenchent aussi en franchissant un enfant de la zone :
// sans compteur, la zone clignote pendant le survol. Un seul point d'ecriture sur
// className evite que chaque appelant n'oublie de le remettre a zero.
function refreshDropZoneChrome() {
  dropZone.className = 'drop-zone'
    + (selectedFiles.length > 0 ? ' has-file' : '')
    + (dropDragDepth > 0 ? ' dragover' : '');
}

function renderFileList() {
  const list = document.getElementById('uploadFileList');
  list.innerHTML = '';
  selectedFiles.forEach((f) => {
    const div = document.createElement('div');
    div.textContent = '\u2713 ' + f.name + ' \u00b7 ' + formatSize(f.size);
    div.style.cssText = 'font-size:.8125rem;color:#166534;padding:2px 0';
    list.appendChild(div);
  });
  rejectedFiles.forEach((r) => {
    const div = document.createElement('div');
    div.textContent = '\u2717 ' + r.name + ' \u00b7 ' + r.reason;
    div.style.cssText = 'font-size:.8125rem;color:#dc2626;padding:2px 0';
    list.appendChild(div);
  });
}

// Fichiers systeme ignores silencieusement : un dossier de photos livre depuis macOS
// ou Windows en contient toujours, et les lister comme rejetes ferait croire a une
// erreur alors que le lot est parfaitement valide.
function isSystemFile(name) {
  return name.startsWith('.') || /^thumbs\.db$/i.test(name) || /^desktop\.ini$/i.test(name);
}

function selectFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList);
  const maxBytes = parseInt('${env.MAX_UPLOAD_BYTES}', 10);
  selectedFiles = [];
  selectedTotalBytes = 0;
  rejectedFiles = [];

  const candidates = files.filter((f) => !isSystemFile(f.name));
  const batchTotalBytes = candidates.reduce((s, f) => s + f.size, 0);

  // Plafonds de lot, au tout ou rien : 3 000 photos = 3 000 requetes et un onglet
  // gele. Refuser le lot entier est plus lisible que 500 echecs isoles, a condition
  // que le message dise pourquoi. selectedFiles est encore vide a ce stade : ne
  // jamais le citer ici, utiliser le nombre de fichiers recus.
  if (candidates.length > MAX_FILES) {
    rejectedFiles.push({ name: candidates.length + ' fichiers', reason: 'Lot trop volumineux (max ' + MAX_FILES + ')' });
  } else if (batchTotalBytes > MAX_TOTAL_BYTES) {
    rejectedFiles.push({ name: candidates.length + ' fichiers', reason: 'Poids total > 200 Mo' });
  } else {
    candidates.forEach((file) => {
      const dot = file.name.lastIndexOf('.');
      const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '';
      // L'extension fait foi : c'est la liste que le serveur applique (U4/U5).
      // Le type MIME ne sert que de garde-fou, et son absence ne doit pas faire
      // refuser un fichier que le serveur aurait accepte.
      const accepted = ALLOWED_EXTS.has(ext) && (!file.type || file.type.startsWith('image/'));
      if (!accepted) {
        rejectedFiles.push({ name: file.name, reason: 'Format non supporte' + (ext ? ' (' + ext + ')' : '') });
      } else if (file.size > maxBytes) {
        rejectedFiles.push({ name: file.name, reason: 'Trop lourd (> 4 Mo)' });
      } else {
        selectedFiles.push(file);
        selectedTotalBytes += file.size;
      }
    });
  }

  hideError();
  renderFileList();
  refreshDropZoneChrome();
  dropIcon.textContent = selectedFiles.length > 0 ? '\u2713' : '+';
  dropText.textContent = selectedFiles.length > 0
    ? selectedFiles.length + ' image(s) s\u00e9lectionn\u00e9e(s)'
    : 'Glissez des images ou un dossier ici, ou cliquez pour parcourir';
  uploadFilesize.textContent = formatSize(selectedTotalBytes);
  uploadFilesize.style.display = selectedFiles.length > 0 ? 'block' : 'none';
  uploadSubmitBtn.disabled = selectedFiles.length === 0;
  if (selectedFiles.length === 0 && rejectedFiles.length > 0) {
    showError('Aucun fichier valide : ' + summarizeFailures(rejectedFiles));
  }
}

// readEntries() est pagine (~100 entrees par appel) et renvoie un tableau vide
// quand il n'y a plus rien. Une seule iteration tronquerait le dossier SANS AUCUNE
// ERREUR : c'est la boucle qui distingue un dossier complet d'un dossier amputé.
function readAllEntries(reader) {
  return new Promise((resolve) => {
    const all = [];
    const read = () => reader.readEntries(
      (entries) => {
        if (!entries.length) return resolve(all);
        all.push(...entries);
        read();
      },
      () => resolve(all),
    );
    read();
  });
}

async function walkEntry(entry) {
  if (entry.isFile) {
    const file = await new Promise((res) => entry.file(res, () => res(null)));
    return file ? [file] : [];
  }
  if (!entry.isDirectory) return [];
  const children = await readAllEntries(entry.createReader());
  const out = [];
  for (const child of children) out.push(...await walkEntry(child));
  return out;
}

// Le drop d'un dossier via dataTransfer.files renvoie une liste vide en Chromium :
// il faut passer par les entrees. Aplatissement assume (option A du plan) :
// selectFiles() ne lit que file.name, donc les sous-dossiers disparaissent.
async function filesFromDrop(dt) {
  const items = dt.items;
  if (!items || !items.length) return Array.from(dt.files || []);

  // Extraire TOUTES les entrees AVANT le premier await : au-dela du microtask le
  // DataTransfer est deja neutered et les items suivants renverraient null, ce qui
  // reproduirait la troncature du dossier par un autre chemin. Snapshot d'abord.
  const entries = [];
  const loose = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      entries.push(entry);
    } else if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) loose.push(f);
    }
  }

  const out = [];
  for (const entry of entries) out.push(...await walkEntry(entry));
  out.push(...loose);
  // Repli final sur files : couvre le cas ou webkitGetAsEntry() renvoie null pour
  // tout (ancien Firefox). Il ne couvre PAS un dossier, d'ou le #folderInput.
  return out.length ? out : Array.from(dt.files || []);
}

async function loadTree(prefix) {
  if (treeCache[prefix]) return treeCache[prefix];
  const params = new URLSearchParams({ prefix });
  const res = await fetch('/api/tree?' + params);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  treeCache[prefix] = data.prefixes;
  return data.prefixes;
}

function renderTree() {
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  container.appendChild(createTreeNode('', 'Racine', 0));
}

function createTreeNode(prefix, label, depth) {
  const div = document.createElement('div');
  const hasChildren = treeCache[prefix]?.length > 0 || prefix === '';
  const isExpanded = treeExpanded.has(prefix);
  const isActive = currentPrefix === prefix;

  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle' + (isExpanded ? ' open' : '');
  toggle.textContent = '\u203A';
  if (!hasChildren && prefix !== '') toggle.style.visibility = 'hidden';

  const icon = document.createElement('span');
  icon.className = 'tree-item-icon';
  icon.textContent = isExpanded ? '\uD83D\uDCC2' : '\uD83D\uDCC1';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'tree-item-label';
  labelSpan.textContent = label;

  const item = document.createElement('div');
  item.className = 'tree-item' + (isActive ? ' active' : '');
  item.dataset.prefix = prefix;
  item.appendChild(toggle);
  item.appendChild(icon);
  item.appendChild(labelSpan);

  const children = document.createElement('div');
  children.className = 'tree-children' + (isExpanded ? ' open' : '');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTreeNode(prefix, children);
  });

  item.addEventListener('click', () => {
    navigateTo(prefix);
  });

  div.appendChild(item);
  div.appendChild(children);

  if (isExpanded) {
    loadChildren(prefix, children);
  }

  return div;
}

async function loadChildren(prefix, containerEl) {
  try {
    const children = await loadTree(prefix);
    containerEl.innerHTML = '';
    children.forEach(child => {
      const name = child.replace(/\\/$/, '').split('/').pop();
      containerEl.appendChild(createTreeNode(child, name, 0));
    });
  } catch {
    // silently fail
  }
}

async function toggleTreeNode(prefix, containerEl) {
  if (treeExpanded.has(prefix)) {
    treeExpanded.delete(prefix);
    containerEl.classList.remove('open');
    const parentItem = containerEl.previousElementSibling;
    if (parentItem) {
      const toggle = parentItem.querySelector('.tree-toggle');
      if (toggle) toggle.classList.remove('open');
      const icon = parentItem.querySelector('.tree-item-icon');
      if (icon) icon.textContent = '\uD83D\uDCC1';
    }
  } else {
    treeExpanded.add(prefix);
    containerEl.classList.add('open');
    const parentItem = containerEl.previousElementSibling;
    if (parentItem) {
      const toggle = parentItem.querySelector('.tree-toggle');
      if (toggle) toggle.classList.add('open');
      const icon = parentItem.querySelector('.tree-item-icon');
      if (icon) icon.textContent = '\uD83D\uDCC2';
    }
    if (!treeCache[prefix]) {
      await loadChildren(prefix, containerEl);
    }
  }
}

async function expandPathTo(prefix) {
  if (!prefix) return;
  const parts = prefix.replace(/\\/$/, '').split('/');
  let acc = '';
  for (const part of parts) {
    acc += part + '/';
    if (!treeExpanded.has(acc)) {
      treeExpanded.add(acc);
    }
    if (!treeCache[acc]) {
      try { await loadTree(acc); } catch { break; }
    }
  }
  renderTree();
  highlightTreeNode(prefix);
}

function highlightTreeNode(prefix) {
  document.querySelectorAll('.tree-item').forEach(el => {
    el.classList.toggle('active', el.dataset.prefix === prefix);
  });
  const active = document.querySelector('.tree-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function moveGridFocus(direction) {
  const cards = gridContainer.querySelectorAll('.card');
  if (cards.length === 0) return;

  if (focusedGridIndex < 0 || focusedGridIndex >= cards.length) {
    focusedGridIndex = direction > 0 ? 0 : cards.length - 1;
  } else {
    focusedGridIndex = Math.max(0, Math.min(cards.length - 1, focusedGridIndex + direction));
  }

  cards.forEach((c, i) => c.classList.toggle('focused', i === focusedGridIndex));
  cards[focusedGridIndex]?.focus();
  cards[focusedGridIndex]?.scrollIntoView({ block: 'nearest' });
}

function activateFocusedItem() {
  const cards = gridContainer.querySelectorAll('.card');
  if (focusedGridIndex >= 0 && focusedGridIndex < cards.length) {
    cards[focusedGridIndex]?.click();
  }
}

async function createFolder(form) {
  const input = form.querySelector('input');
  const name = input.value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/tree/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: currentPrefix, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Erreur', 'error');
      return;
    }
    form.remove();
    delete treeCache[currentPrefix];
    treeExpanded.add(currentPrefix);
    renderTree();
    loadTree(currentPrefix).then(() => renderTree());
    showToast('Dossier cree', 'success');
  } catch {
    showToast('Erreur reseau', 'error');
  }
}

// Chargement exhaustif : handleList plafonne limit a 100 et pagine via cursor.
// Factorise pour que l'ordonnancement et « Toutes les URLs » partagent le meme
// parcours, donc le meme perimetre (le dossier courant complet).
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
  orderBtn.disabled = true;
  orderBtn.textContent = 'Chargement\u2026';
  try {
    const all = await fetchAllObjects(currentPrefix);
    if (all.length === 0) {
      showToast('Aucune image dans ce dossier', 'error');
      return;
    }
    orderObjects = all;
    // Amorçage depuis l'ordre courant : si l'editeur a clique « Date » puis
    // « Ordonner », il s'attend a partir de cet ordre. Recherche IGNOREE ici,
    // sinon le reste de la galerie disparaitrait a la sortie du mode.
    // Set() car deux objets de meme key feraient pointer les positions fausses.
    orderKeys = [...new Set(sortObjects(all).map((o) => o.key))];
    orderTouched = false;
    orderingMode = true;
    focusedGridIndex = -1;
    // Le champ de recherche est masque pendant l'ordonnancement (applyOrderingChrome)
    // mais searchQuery resterait en memoire : a la sortie, getSortedObjects()
    // filtrerait sur une requete invisible et l'editeur verrait une grille amputee
    // sans comprendre pourquoi. Neutralise des deux cotes.
    searchQuery = '';
    searchInput.value = '';
    applyOrderingChrome();
    renderGrid();
    showToast(all.length + ' image(s) charg\u00e9e(s), glissez pour ordonner', 'success');
  } catch {
    showToast('Erreur lors du chargement du dossier', 'error');
  } finally {
    // finally s'execute aussi sur le return anticipe (dossier vide) et sur l'echec :
    // utiliser la valeur reelle de orderingMode, sinon le bouton afficherait
    // « Terminer » alors qu'on n'est jamais entre en mode.
    orderBtn.disabled = false;
    orderBtn.textContent = orderingMode ? 'Terminer' : 'Ordonner';
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
// une sequence de N images. Declencheurs ordonnes : navigation dossier, bouton
// « Terminer », touche Echap. Le repli confirm() est le seul confirm() de l'app.
function confirmDiscardOrder() {
  if (!orderTouched) return true;
  return confirm("Abandonner l'ordre manuel de " + orderKeys.length + ' image(s) ?');
}

function toggleOrderingMode() {
  if (orderingMode) {
    if (confirmDiscardOrder()) exitOrderingMode();
  } else {
    enterOrderingMode();
  }
}

function currentFolderName() {
  return currentPrefix.replace(/\\/+$/, '').split('/').pop() || '';
}

function refreshTitlePlaceholder() {
  const input = document.getElementById('galleryTitle');
  if (!input) return;
  const name = currentFolderName();
  input.placeholder = name ? 'Par exemple « ' + name + ' »' : 'Nom de la galerie';
}

function applyOrderingChrome() {
  orderBar.style.display = orderingMode ? 'flex' : 'none';
  document.body.className = orderingMode ? 'ordering' : '';
  orderBtn.textContent = orderingMode ? 'Terminer' : 'Ordonner';
  refreshTitlePlaceholder();
  // Le dossier est deja charge en entier : un « Charger 24 suivantes » residuel
  //'appellerait loadItems(), qui concatene dans allObjects alors que la grille
  // rend desormais depuis orderObjects. Bouton masque plutot que desactive, sinon
  // il reste un element interactif sans effet.
  if (orderingMode) loadMoreWrap.style.display = 'none';
  if (!orderingMode) {
    orderBtn.disabled = false;
    searchInput.style.display = '';
    copyAllBtn.style.display = currentPrefix ? '' : 'none';
    updateNavButtons();
    return;
  }
  orderCount.textContent = orderKeys.length + ' image(s)';
  // L'ordre porte sur le dossier entier : la recherche est desactivee pour ne pas
  // laisser croire a une selection.
  searchInput.style.display = 'none';
  // Un seul chemin d'export visible : « Toutes les URLs » rendrait l'ordre naturel,
  // qui differerait de l'ordre choisi — un resultat valide mais faux.
  copyAllBtn.style.display = 'none';
}

// --- Generateurs d'export (T6) ---
// orderedEntries() est le passage obligatoire : tout chemin qui produit des URLs
// passe par la, donc aucun ne peut rendre l'ordre naturel par megarde.
function orderedEntries() {
  return getSortedObjects().map((o) => ({
    key: o.key,
    url: publicUrl(o.key),
    name: o.key.split('/').pop(),
  }));
}

// Deux constantes distinctes, et la confusion entre elles produit un défaut
// invisible en lecture : le presse-papiers reçoit un antislash suivi de la lettre n,
// au lieu d'un saut de ligne, donc les URL arrivent sur UNE seule ligne et
// parseGalleryImages() n'en lit qu'une (§8.1).
//
// BS = antislash, pour l'ÉCHAPPEMENT YAML (doubler les antislashs d'une chaîne).
const BS = String.fromCharCode(92);
// NL = saut de ligne RÉEL (code 10). Ne pas écrire 'BS + n' : cela ne produirait
// que deux caractères, pas un saut de ligne.
const NL = String.fromCharCode(10);

function yamlStr(s) {
  return '"' + String(s).split(BS).join(BS + BS).split('"').join(BS + '"') + '"';
}

function buildUrlsText() {
  return orderedEntries().map((e) => e.url).join(NL);
}

function buildYaml(title, date, cover) {
  const lines = [];
  if (title) lines.push('title: ' + yamlStr(title));
  if (date) lines.push('date: ' + date);
  if (cover) lines.push('cover: ' + cover);
  // draft: false est le comportement retenu et le guide le signale : le schema Zod
  // a draft en defaut false alors que .pages.yml declare default true, donc une
  // galerie exportee est PUBLIEE des la creation. A corriger dans le .md avant
  // commit si la galerie doit rester brouillon.
  lines.push('draft: false');
  lines.push('images: |');
  orderedEntries().forEach((e) => lines.push('  ' + e.url));
  return lines.join(NL);
}

function buildMarkdown(title, date, cover) {
  return '---' + NL + buildYaml(title, date, cover) + NL + '---' + NL + NL + 'Description de la galerie.' + NL;
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
  // La couverture est la premiere image DANS L'ORDRE CHOISI. Prendre celle du tri
  // naturel ferait contredire la couverture par l'ordre que l'editeur vient de fixer.
  const cover = entries[0].url;
  const text = kind === 'urls' ? buildUrlsText() : buildMarkdown(title, date, cover);
  try {
    await navigator.clipboard.writeText(text);
    if (kind === 'urls') {
      showToast(entries.length + " URLs copiées — à coller dans « Images »", 'success');
    } else if (kind === 'md' && title) {
      showToast(entries.length + ' images — ' + suggestSlug(title) + '.md, à déposer dans src/content/galleries/', 'success');
    } else {
      showToast(entries.length + ' images copiées — à coller dans « Images »', 'success');
    }
  } catch {
    showToast('Erreur de copie', 'error');
  }
}

async function copyAllUrls() {
  const btn = copyAllBtn;
  btn.disabled = true;
  btn.textContent = 'Chargement\u2026';
  try {
    // Point non negociable : orderedObjects() fait aussi honors a l'ordre manuel.
    // Sans cela, un editeur qui ordonne puis clique « Toutes les URLs » obtiendrait
    // l'ordre naturel — un resultat valide mais faux (§8.4).
    const allImages = orderedObjects(await fetchAllObjects(currentPrefix));
    const urls = allImages.map((o) => publicUrl(o.key));
    await navigator.clipboard.writeText(urls.join('\\n'));
    showToast(urls.length + ' URL(s) copi\u00e9e(s) !', 'success');
  } catch {
    showToast('Erreur lors de la copie', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Copier les URLs';
  }
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderGrid();
});

sortBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const sort = btn.dataset.sort;
    if (sort === 'date' && currentSort === 'date') {
      currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
      btn.textContent = 'Date ' + (currentSortDir === 'desc' ? '\u2193' : '\u2191');
    } else if (sort === 'size' && currentSort === 'size') {
      currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
      btn.textContent = 'Poids ' + (currentSortDir === 'desc' ? '\u2193' : '\u2191');
    } else {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = sort;
      currentSortDir = 'desc';
      const dateBtn = document.querySelector('.sort-btn[data-sort="date"]');
      if (dateBtn) dateBtn.textContent = 'Date';
      const sizeBtn = document.querySelector('.sort-btn[data-sort="size"]');
      if (sizeBtn) sizeBtn.textContent = 'Poids';
    }
    renderGrid();
  });
});

loadMoreBtn.addEventListener('click', () => loadItems(true));

uploadBtn.addEventListener('click', openUploadModal);
uploadCancelBtn.addEventListener('click', closeUploadModal);

uploadModal.addEventListener('click', (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

uploadSubmitBtn.addEventListener('click', uploadFiles);

dropZone.addEventListener('click', () => fileInput.click());

// Le lien est dans la zone de depot : sans stopPropagation il declencherait aussi
// le clic de la zone et ouvrirait le selecteur de fichiers au lieu du dossier.
folderLink.addEventListener('click', (e) => {
  e.stopPropagation();
  folderInput.click();
});

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dropDragDepth++;
  refreshDropZoneChrome();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
});

dropZone.addEventListener('dragleave', () => {
  dropDragDepth = Math.max(0, dropDragDepth - 1);
  refreshDropZoneChrome();
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropDragDepth = 0;
  refreshDropZoneChrome();
  selectFiles(await filesFromDrop(e.dataTransfer));
});

// Reset de value : sans lui, rechoisir le meme dossier ne declenche aucun
// evenement change, et rien ne se passe sans aucun message.
function consumeInput(input) {
  selectFiles(input.files);
  input.value = '';
}

fileInput.addEventListener('change', () => consumeInput(fileInput));
folderInput.addEventListener('change', () => consumeInput(folderInput));

document.getElementById('backBtn').addEventListener('click', () => {
  if (navIndex > 0) navigateTo(navHistory[--navIndex], false);
});
document.getElementById('forwardBtn').addEventListener('click', () => {
  if (navIndex < navHistory.length - 1) navigateTo(navHistory[++navIndex], false);
});
document.getElementById('upBtn').addEventListener('click', () => {
  const parent = currentPrefix.replace(/\\/?[^/]+\\/?$/, '');
  navigateTo(parent);
});

document.getElementById('copyAllBtn').addEventListener('click', copyAllUrls);

// --- Ordonnancement (§ Plan 15) ---
orderBtn.addEventListener('click', toggleOrderingMode);
document.getElementById('exportUrlsBtn').addEventListener('click', () => copyExport('urls'));
document.getElementById('exportMdBtn').addEventListener('click', () => copyExport('md'));
document.getElementById('orderHelpBtn').addEventListener('click', () => {
  const panel = document.getElementById('orderHelpPanel');
  const open = panel.classList.toggle('open');
  document.getElementById('orderHelpBtn').setAttribute('aria-expanded', String(open));
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('show');
});

document.getElementById('sidebarBackdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
});

document.getElementById('newFolderBtn').addEventListener('click', () => {
  const existing = document.querySelector('.new-folder-form');
  if (existing) { existing.remove(); return; }
  const form = document.createElement('div');
  form.className = 'new-folder-form';
  form.innerHTML = '<input type="text" placeholder="Nom du dossier" maxlength="60">'
    + '<button class="btn" id="folderCreateSubmit">OK</button>'
    + '<button class="btn" id="folderCreateCancel">X</button>';
  document.querySelector('.sidebar-header').after(form);
  form.querySelector('input').focus();
  form.querySelector('#folderCreateSubmit').onclick = () => createFolder(form);
  form.querySelector('#folderCreateCancel').onclick = () => form.remove();
  form.querySelector('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createFolder(form);
    if (e.key === 'Escape') form.remove();
  });
});

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      moveGridFocus(-1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      moveGridFocus(1);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      activateFocusedItem();
      break;
    case 'Escape':
      if (uploadModal.className.includes('open')) {
        closeUploadModal();
      } else if (orderingMode && confirmDiscardOrder()) {
        exitOrderingMode();
      }
      break;
  }

  if (e.altKey) {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        document.getElementById('upBtn').click();
        break;
    }
  }

  if (e.ctrlKey) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        document.getElementById('backBtn').click();
        break;
      case 'ArrowRight':
        e.preventDefault();
        document.getElementById('forwardBtn').click();
        break;
    }
  }
});

renderTree();
loadTree('').then(() => renderTree());
loadItems(false);
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
