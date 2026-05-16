import { handleList, handleTree, handleCreateFolder } from './api';
import { handleUpload } from './upload';
import { renderUI } from './ui';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (pathname === '/' && method === 'GET') {
      return renderUI(env);
    }

    if (pathname === '/api/list' && method === 'GET') {
      return handleList(request, env);
    }

    if (pathname === '/api/upload' && method === 'POST') {
      return handleUpload(request, env);
    }

    if (pathname === '/api/tree' && method === 'GET') {
      return handleTree(request, env);
    }

    if (pathname === '/api/tree/folder' && method === 'POST') {
      return handleCreateFolder(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};
