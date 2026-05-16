import type { Env, ListResponse, R2ObjectMeta, TreeResponse } from './types';

const EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg',
]);

function getAllowedExtensions(raw: string): Set<string> {
  const exts = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return new Set(exts.length > 0 ? exts : EXTENSIONS);
}

function isImageKey(key: string, allowed: Set<string>): boolean {
  const dot = key.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = key.slice(dot + 1).toLowerCase();
  return allowed.has(ext);
}

function formatObject(obj: R2Object): R2ObjectMeta {
  return {
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
    contentType: obj.httpMetadata?.contentType ?? null,
  };
}

export async function handleList(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') ?? '';
    const cursor = url.searchParams.get('cursor') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '24', 10) || 24, 1), 100);

    const result = await env.MEDIA_BUCKET.list({ prefix, cursor, limit, delimiter: '/' });

    const allowed = getAllowedExtensions(env.ALLOWED_EXTENSIONS);

    const objects: R2ObjectMeta[] = result.objects
      .filter(obj => isImageKey(obj.key, allowed))
      .map(formatObject);

    const prefixes: string[] = (result.delimitedPrefixes ?? []).map(p => p);

    const response: ListResponse = {
      objects,
      prefixes,
      cursor: 'cursor' in result ? (result.cursor ?? null) : null,
      truncated: result.truncated,
    };

    return Response.json(response, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('R2 list error:', err);
    return Response.json(
      { error: 'Erreur listing R2', code: 500 },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export async function handleTree(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix');
    if (prefix === null) {
      return Response.json({ error: 'Parametre prefix requis', code: 400 }, { status: 400 });
    }
    const result = await env.MEDIA_BUCKET.list({ prefix, delimiter: '/', limit: 1000 });
    const prefixes: string[] = (result.delimitedPrefixes ?? []).map(p => p);
    const response: TreeResponse = { prefixes };
    return Response.json(response, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('R2 tree error:', err);
    return Response.json(
      { error: 'Erreur listing arborescence', code: 500 },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export async function handleCreateFolder(request: Request, env: Env): Promise<Response> {
  try {
    const { prefix, name } = await request.json() as { prefix?: string; name?: string };
    if (!name || !name.trim()) {
      return Response.json({ error: 'Nom de dossier requis', code: 400 }, { status: 400 });
    }
    const sanitized = name.trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
    if (!sanitized) {
      return Response.json({ error: 'Nom invalide apres nettoyage', code: 400 }, { status: 400 });
    }
    const cleanPrefix = prefix ? prefix.replace(/\/$/, '') + '/' : '';
    const key = cleanPrefix + sanitized + '/';
    const existing = await env.MEDIA_BUCKET.head(key);
    if (existing) {
      return Response.json({ error: 'Ce dossier existe deja', code: 409 }, { status: 409 });
    }
    await env.MEDIA_BUCKET.put(key, new Uint8Array(0));
    return Response.json({ key }, { status: 201 });
  } catch (err) {
    console.error('R2 create folder error:', err);
    return Response.json(
      { error: 'Erreur creation dossier', code: 500 },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
