/**
 * JhedAI Backend API - Cloudflare Worker
 * Main entry point for the API
 */

import { handleCors } from './utils/cors';
import {
  handleHealth,
  handleGetServices,
  handleContactForm,
  handleGetBlogPosts,
  handleGetBlogPost,
  handleGetRelatedPosts,
  handleGetCategories,
  handleGetContacts,
  handleGetSitemapData,
  handleGetAuthors,
  handleCreateBlogPost,
  handleUpdateBlogPost,
  handleDeleteBlogPost,
  handleCreateAuthor,
  handleUpdateAuthor,
  type Env,
} from './routes/api';

/**
 * Router - Maps paths to handlers
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return handleCors(request, {
      origin: env.ALLOWED_ORIGINS?.split(',') || '*',
    });
  }

  try {
    // Route matching
    switch (true) {
      // Health check
      case path === '/' || path === '/health':
        return handleHealth(request, env);

      // Services API
      case path === '/api/services' && method === 'GET':
        return handleGetServices(request, env);

      // Contact form
      case path === '/api/contact' && method === 'POST':
        return handleContactForm(request, env);

      // Blog posts (list)
      case path === '/api/blog/posts' && method === 'GET':
        return handleGetBlogPosts(request, env);

      // Blog posts (create)
      case path === '/api/blog/posts' && method === 'POST':
        return handleCreateBlogPost(request, env);

      // Blog categories
      case path === '/api/blog/categories' && method === 'GET':
        return handleGetCategories(request, env);

      // Blog single post — /api/blog/posts/:slug/related
      case path.startsWith('/api/blog/posts/') && path.endsWith('/related') && method === 'GET': {
        const slug = path.replace('/api/blog/posts/', '').replace('/related', '');
        return handleGetRelatedPosts(request, env, slug);
      }

      // Blog single post — GET / PUT / DELETE
      case path.startsWith('/api/blog/posts/') && method === 'GET': {
        const slug = path.replace('/api/blog/posts/', '');
        return handleGetBlogPost(request, env, slug);
      }
      case path.startsWith('/api/blog/posts/') && method === 'PUT': {
        const slug = path.replace('/api/blog/posts/', '');
        return handleUpdateBlogPost(request, env, slug);
      }
      case path.startsWith('/api/blog/posts/') && method === 'DELETE': {
        const slug = path.replace('/api/blog/posts/', '');
        return handleDeleteBlogPost(request, env, slug);
      }

      // Legacy blog endpoint
      case path === '/api/blog' && method === 'GET':
        return handleGetBlogPosts(request, env);

      // Authors
      case path === '/api/authors' && method === 'GET':
        return handleGetAuthors(request, env);
      case path === '/api/authors' && method === 'POST':
        return handleCreateAuthor(request, env);
      case path.startsWith('/api/authors/') && method === 'PUT': {
        const slug = path.replace('/api/authors/', '');
        return handleUpdateAuthor(request, env, slug);
      }

      // Sitemap data (for build-time sitemap generation)
      case path === '/api/sitemap-data' && method === 'GET':
        return handleGetSitemapData(request, env);

      // Get contacts (admin)
      case path === '/api/contacts' && method === 'GET':
        return handleGetContacts(request, env);

      // 404 Not Found
      default:
        return new Response(
          JSON.stringify({
            error: 'Not Found',
            path,
            message: 'The requested endpoint does not exist',
            availableEndpoints: [
              'GET /',
              'GET /health',
              'GET /api/services',
              'POST /api/contact',
              'GET /api/contacts',
              'GET /api/blog/posts',
              'POST /api/blog/posts',
              'GET /api/blog/posts/:slug',
              'PUT /api/blog/posts/:slug',
              'DELETE /api/blog/posts/:slug',
              'GET /api/blog/posts/:slug/related',
              'GET /api/blog/categories',
              'GET /api/authors',
              'POST /api/authors',
              'PUT /api/authors/:slug',
              'GET /api/sitemap-data',
            ],
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
    }
  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Cloudflare Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};
