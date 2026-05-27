import type { Env } from './types';

export function renderUI(env: Env): Response {
  const weightWarningBytes = parseInt(env.WEIGHT_WARNING_BYTES, 10);

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
      <p id="dropText">Glissez une image ici ou cliquez pour parcourir</p>
    </div>
    <input type="file" id="fileInput" accept="image/*" style="display:none" aria-hidden="true">
    <div id="uploadFilesize"></div>
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

const uploadBtn = document.getElementById('uploadBtn');
const uploadModal = document.getElementById('uploadModal');
const uploadCancelBtn = document.getElementById('uploadCancelBtn');
const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const dropIcon = document.getElementById('dropIcon');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const uploadError = document.getElementById('uploadError');
const uploadFilesize = document.getElementById('uploadFilesize');
const toast = document.getElementById('toast');

let selectedFile = null;
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

function getSortedObjects() {
  const filtered = allObjects.filter(o => {
    if (!searchQuery) return true;
    const name = o.key.split('/').pop().toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });
  const sorted = [...filtered];
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

function renderGrid() {
  const objects = getSortedObjects();
  if (objects.length === 0 && displayedPrefixes.length === 0) {
    gridContainer.style.display = 'none';
    setEmpty(!currentCursor);
    return;
  }
  setEmpty(false);
  let html = '';
  objects.forEach(obj => {
    const key = obj.key;
    const name = key.split('/').pop();
    const url = BASE_URL + '/' + key;
    const sizeStr = formatSize(obj.size);
    const isWarning = obj.size > WEIGHT_WARNING;
    html += '<div class="card" role="button" tabindex="0" data-key="' + escapeHtml(key) + '" aria-label="Copier l' + "'" + 'URL de ' + escapeHtml(name) + '">';
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
    const url = BASE_URL + '/' + key;
    const handler = () => copyUrl(el, key, url);
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });
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

async function uploadFile(file, prefix) {
  if (uploading) return;
  uploading = true;
  uploadSubmitBtn.disabled = true;
  uploadProgress.className = 'upload-progress show';
  progressBar.value = 0;
  progressText.textContent = '0%';
  hideError();

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('prefix', prefix);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.value = pct;
        progressText.textContent = pct + '%';
      }
    };

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        try {
          resolve({ status: xhr.status, body: JSON.parse(xhr.responseText) });
        } catch { reject(new Error('Reponse invalide')); }
      };
      xhr.onerror = () => reject(new Error('Erreur reseau'));
      xhr.send(formData);
    });

    if (result.status === 200) {
      const obj = result.body;
      navigator.clipboard.writeText(obj.url).catch(() => {});
      closeUploadModal();
      showToast('Uploade et URL copiee !', 'success');
      const newObj = { key: obj.key, size: obj.size, uploaded: new Date().toISOString(), contentType: null };
      allObjects.unshift(newObj);
      renderGrid();
    } else if (result.status === 413) {
      showError('Fichier trop lourd : maximum 4 Mo autorise.');
    } else if (result.status === 415) {
      showError('Type de fichier non autorise. Formats acceptes : JPEG, PNG, WebP, GIF, AVIF, SVG.');
    } else {
      showError('Erreur serveur : ' + (result.body.error || 'reponse inconnue'));
    }
  } catch (err) {
    showError('Erreur reseau ou serveur');
  } finally {
    uploading = false;
    uploadSubmitBtn.disabled = !selectedFile;
  }
}

function openUploadModal() {
  selectedFile = null;
  hideError();
  uploadProgress.className = 'upload-progress';
  uploadFilesize.style.display = 'none';
  uploadSubmitBtn.disabled = true;
  dropZone.className = 'drop-zone';
  dropIcon.textContent = '+';
  dropText.textContent = 'Glissez une image ici ou cliquez pour parcourir';
  uploadModal.className = 'upload-modal open';
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  uploadModal.className = 'upload-modal';
  document.body.style.overflow = '';
  selectedFile = null;
}

function selectFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showError('Veuillez selectionner une image');
    return;
  }
  if (file.size > parseInt('${env.MAX_UPLOAD_BYTES}', 10)) {
    showError('Fichier trop lourd : maximum 4 Mo.');
    return;
  }
  selectedFile = file;
  hideError();
  dropZone.className = 'drop-zone has-file';
  dropIcon.textContent = '✓';
  dropText.textContent = file.name;
  uploadFilesize.textContent = formatSize(file.size);
  uploadFilesize.style.display = 'block';
  uploadSubmitBtn.disabled = false;
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

async function copyAllUrls() {
  const btn = document.getElementById('copyAllBtn');
  btn.disabled = true;
  btn.textContent = 'Chargement\u2026';
  try {
    let allImages = [];
    let cursor = null;
    let hasMore = true;
    while (hasMore) {
      const params = new URLSearchParams({ prefix: currentPrefix, limit: '100' });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch('/api/list?' + params);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allImages = allImages.concat(data.objects);
      cursor = data.cursor;
      hasMore = data.truncated;
    }
    const urls = allImages.map(o => BASE_URL + '/' + o.key);
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

uploadSubmitBtn.addEventListener('click', () => {
  if (selectedFile) uploadFile(selectedFile, currentPrefix);
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) selectFile(files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) selectFile(fileInput.files[0]);
});

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
      if (uploadModal.className.includes('open')) closeUploadModal();
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
