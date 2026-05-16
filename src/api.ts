import type { Env, ListResponse, R2ObjectMeta } from './types';

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
