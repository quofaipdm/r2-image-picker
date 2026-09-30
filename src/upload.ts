import type { Env, UploadResponse, ErrorResponse } from './types';

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

// HEIC n'en fait pas partie, et c'est un choix produit : les membres photographient
// au telephone, mais ni le worker ni Cloudflare Image Resizing ne savent traiter un
// HEIC. Le convertir avant upload (cf. GUIDE_Editeur.md §10) vaut mieux que
// l'accepter puis echouer a l'affichage.

let collisionCounter = 0;

function sanitizeFilename(raw: string): string {
  const dot = raw.lastIndexOf('.');
  const ext = dot !== -1 ? raw.slice(dot).toLowerCase() : '';
  const base = dot !== -1 ? raw.slice(0, dot) : raw;
  const clean = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return (clean || 'upload') + ext;
}

function errorResponse(code: number, error: string): Response {
  return Response.json({ error, code } satisfies ErrorResponse, {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const prefix = (formData.get('prefix') as string | null) ?? '';

    if (!file || !file.name) {
      return errorResponse(400, 'Champ file manquant');
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return errorResponse(415, `Type non autorisé : ${file.type}`);
    }

    const maxBytes = parseInt(env.MAX_UPLOAD_BYTES, 10);
    if (file.size > maxBytes) {
      return errorResponse(413, `Fichier trop lourd : ${file.size} octets (max ${maxBytes})`);
    }

    const filename = sanitizeFilename(file.name);
    const prefixClean = prefix.replace(/\/$/, '');
    const baseKey = prefixClean ? `${prefixClean}/${filename}` : filename;

    const existing = await env.MEDIA_BUCKET.head(baseKey);
    let key = baseKey;
    if (existing) {
      const dot = filename.lastIndexOf('.');
      const ext = dot !== -1 ? filename.slice(dot) : '';
      const base = dot !== -1 ? filename.slice(0, dot) : filename;
      // Date.now() seul n'est pas unique : deux fichiers de meme nom envoyes dans
      // la meme milliseconde se marcheraient dessus, l'un ecrase l'autre. Le
      // compteur rend le suffixe unique dans le lot comme dans la seconde.
      const stamp = `${Date.now()}-${collisionCounter++}`;
      key = prefixClean
        ? `${prefixClean}/${base}-${stamp}${ext}`
        : `${base}-${stamp}${ext}`;
    }

    const buffer = await file.arrayBuffer();
    await env.MEDIA_BUCKET.put(key, buffer, {
      httpMetadata: { contentType: file.type },
    });

    // uploaded est l'instant reel du put : le client s'en sert pour le tri par date
    // au lieu de new Date(), qui vaut l'heure du navigateur et pas celle du serveur.
    const uploaded = new Date().toISOString();
    const url = `${env.PUBLIC_R2_BASE_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
    return Response.json(
      { key, url, size: file.size, uploaded, contentType: file.type } satisfies UploadResponse,
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('R2 upload error:', err);
    return errorResponse(500, 'Erreur d\'écriture R2');
  }
}
