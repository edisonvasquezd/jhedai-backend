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

      // Blog posts
      case path === '/api/blog' && method === 'GET':
        return handleGetBlogPosts(request, env);

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
              'GET /api/blog',
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
