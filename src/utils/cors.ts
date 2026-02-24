/**
 * CORS utility for Cloudflare Workers
 * Handles Cross-Origin Resource Sharing headers
 */

export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_OPTIONS: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Add CORS headers to a response
 */
export function corsHeaders(
  request: Request,
  options: CorsOptions = {}
): HeadersInit {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const origin = request.headers.get('Origin') || '*';

  // Check if origin is allowed
  let allowedOrigin = '*';
  if (opts.origin && opts.origin !== '*') {
    const origins = Array.isArray(opts.origin) ? opts.origin : [opts.origin];
    if (origins.includes(origin)) {
      allowedOrigin = origin;
    }
  } else {
    allowedOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': opts.methods?.join(', ') || '*',
    'Access-Control-Allow-Headers': opts.allowedHeaders?.join(', ') || '*',
    'Access-Control-Expose-Headers': opts.exposedHeaders?.join(', ') || '',
    'Access-Control-Allow-Credentials': opts.credentials ? 'true' : 'false',
    'Access-Control-Max-Age': String(opts.maxAge || 86400),
  };
}

/**
 * Handle OPTIONS preflight request
 */
export function handleCors(request: Request, options: CorsOptions = {}): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, options),
  });
}

/**
 * Create a response with CORS headers
 */
export function corsResponse(
  body: any,
  request: Request,
  init?: ResponseInit,
  corsOptions?: CorsOptions
): Response {
  const headers = new Headers(init?.headers || {});
  const cors = corsHeaders(request, corsOptions);

  Object.entries(cors).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}
