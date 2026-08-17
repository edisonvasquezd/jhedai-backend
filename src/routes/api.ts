/**
 * API Routes for JhedAI Backend
 */

import { corsResponse } from '../utils/cors';

export interface Env {
  FRONTEND_URL: string;
  ALLOWED_ORIGINS: string;
  DB: D1Database;
  JHEDAI_CACHE: KVNamespace;
  RESEND_API_KEY?: string;
  API_KEY?: string;
  PAGES_DEPLOY_HOOK?: string;
  PAGES_DEPLOY_TOKEN?: string;
}

// KV TTLs in seconds
const TTL = {
  post: 3600,       // 1 hour — individual posts
  posts: 900,       // 15 min — paginated list
  related: 3600,    // 1 hour — related posts
  categories: 86400, // 24 hours — rarely changes
  authors: 86400,   // 24 hours — rarely changes
  sitemap: 3600,    // 1 hour
} as const;

async function kvGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

async function kvSet(kv: KVNamespace, key: string, value: unknown, ttl: number): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

/**
 * Health check endpoint
 */
export async function handleHealth(request: Request, _env: Env): Promise<Response> {
  return corsResponse(
    { status: 'ok', timestamp: new Date().toISOString(), service: 'jhedai-api', version: '1.0.0' },
    request,
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Get services endpoint
 */
export async function handleGetServices(request: Request, _env: Env): Promise<Response> {
  const services = [
    { id: 1, slug: 'analisis-datos', title: 'Análisis de Datos', description: 'Transformación de datos brutos en insights accionables', category: 'data' },
    { id: 2, slug: 'machine-learning', title: 'Machine Learning', description: 'Modelos de ML personalizados para clasificación y predicción', category: 'ai' },
  ];

  return corsResponse(
    { data: services, count: services.length },
    request,
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } }
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendEmailNotification(apiKey: string, body: Record<string, string>): Promise<void> {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${label}</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(value)}</td></tr>`;

  const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>
<body style="font-family:sans-serif;color:#222;">
    <h2>Nuevo contacto desde jhedai.com</h2>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      ${row('Nombre', body.nombre)}
      ${row('Email', body.email)}
      ${body.empresa ? row('Empresa', body.empresa) : ''}
      ${body.telefono ? row('Teléfono', body.telefono) : ''}
      ${body.servicio ? row('Servicio', body.servicio) : ''}
      ${row('Mensaje', body.mensaje)}
    </table>
    <p style="color:#888;font-size:12px;margin-top:16px;">Enviado desde el formulario de contacto de jhedai.com</p>
</body>
</html>`;

  const payload = {
    from: 'JhedAi Contacto <contacto@send.jhedai.com>',
    to: ['contacto@jhedai.com'],
    bcc: ['ignacio@jhedai.com', 'edison@jhedai.com'],
    subject: `[Contacto Web] ${body.nombre} - ${body.servicio || 'General'}`,
    html: htmlBody,
    reply_to: body.email,
  };

  console.log('[Email] Sending with payload:', JSON.stringify({ ...payload, html: '(omitted)' }));

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();
  console.log('[Email] Resend response:', response.status, responseBody);

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status} - ${responseBody}`);
  }
}

/**
 * Contact form endpoint
 */
export async function handleContactForm(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;

    if (!body.nombre || !body.email || !body.mensaje) {
      return corsResponse(
        { error: 'Missing required fields', required: ['nombre', 'email', 'mensaje'] },
        request,
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return corsResponse(
        { error: 'Invalid email format' },
        request,
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = await Promise.allSettled([
      env.DB.prepare(
        `INSERT INTO contacts (nombre, email, empresa, telefono, servicio, mensaje) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(body.nombre, body.email, body.empresa || null, body.telefono || null, body.servicio || null, body.mensaje).run(),
      env.RESEND_API_KEY ? sendEmailNotification(env.RESEND_API_KEY, body) : Promise.resolve(),
    ]);

    const [dbResult, emailResult] = results;

    if (dbResult.status === 'rejected') {
      console.error('[Contact DB Error]', dbResult.reason);
      return corsResponse(
        { error: 'Error al guardar el mensaje. Intenta nuevamente.' },
        request,
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (emailResult.status === 'rejected') {
      console.error('[Contact Email Error]', emailResult.reason);
    }

    const insertResult = dbResult.value as D1Result;
    console.log('Contact form saved:', {
      nombre: body.nombre,
      email: body.email,
      id: insertResult.meta.last_row_id,
      emailSent: emailResult.status === 'fulfilled',
    });

    return corsResponse(
      { success: true, message: 'Mensaje recibido correctamente', data: { id: insertResult.meta.last_row_id, nombre: body.nombre, email: body.email } },
      request,
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Shared SELECT with author JOIN */
const BLOG_SELECT = `
  SELECT bp.*,
    a.slug AS a_slug, a.name AS a_name, a.type AS a_type,
    a.job_title AS a_job_title, a.bio AS a_bio, a.avatar AS a_avatar,
    a.url AS a_url, a.same_as AS a_same_as
  FROM blog_posts bp
  LEFT JOIN authors a ON bp.author_id = a.id`;

function formatPost(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    published_at: row.published_date,
    updated_at: row.updated_at,
    read_time: row.read_time,
    featured: row.featured,
    featured_image: row.featured_image,
    featured_image_alt: row.featured_image_alt,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
    og_title: row.og_title || null,
    og_description: row.og_description || null,
    og_image: row.og_image || null,
    twitter_title: row.twitter_title || null,
    twitter_description: row.twitter_description || null,
    canonical_url: row.canonical_url || null,
    status: row.status || 'published',
    word_count: row.word_count || 0,
    primary_answer: row.primary_answer || null,
    faq_items: row.faq_items ? JSON.parse(row.faq_items as string) : [],
    key_takeaways: row.key_takeaways ? JSON.parse(row.key_takeaways as string) : [],
    speakable_selectors: row.speakable_selectors ? JSON.parse(row.speakable_selectors as string) : [],
    author: {
      id: row.author_id,
      slug: row.a_slug || 'jhedai-org',
      name: (row.a_name as string) || (row.author as string) || 'JhedAi',
      type: row.a_type || 'Organization',
      jobTitle: row.a_job_title || null,
      bio: row.a_bio || null,
      avatar: (row.a_avatar as string) || (row.author_avatar as string) || null,
      url: row.a_url || null,
      sameAs: row.a_same_as ? JSON.parse(row.a_same_as as string) : [],
    },
  };
}

/**
 * GET /api/blog/posts — paginated list, optional ?category=
 */
export async function handleGetBlogPosts(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '9');
    const category = url.searchParams.get('category') || '';
    const offset = (page - 1) * limit;

    const cacheKey = `blog:posts:p${page}:l${limit}:c${category}`;
    const cached = await kvGet<unknown>(env.JHEDAI_CACHE, cacheKey);
    if (cached) {
      return corsResponse(
        { data: cached },
        request,
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT' } }
      );
    }

    let countQuery = 'SELECT COUNT(*) as total FROM blog_posts bp';
    let query = BLOG_SELECT;

    if (category) {
      countQuery += ' WHERE bp.category = ?';
      query += ' WHERE bp.category = ?';
    }
    query += ' ORDER BY bp.published_date DESC LIMIT ? OFFSET ?';

    const [countResult, result] = await Promise.all([
      category
        ? env.DB.prepare(countQuery).bind(category).first<{ total: number }>()
        : env.DB.prepare(countQuery).first<{ total: number }>(),
      category
        ? env.DB.prepare(query).bind(category, limit, offset).all()
        : env.DB.prepare(query).bind(limit, offset).all(),
    ]);

    const total = countResult?.total || 0;
    const data = {
      data: result.results.map(formatPost),
      page,
      totalPages: Math.ceil(total / limit),
      total,
    };

    await kvSet(env.JHEDAI_CACHE, cacheKey, data, TTL.posts);

    return corsResponse(
      { data },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('Get blog posts error:', error);
    return corsResponse({ error: 'Internal server error' }, request, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/blog/posts/:slug — single post by slug
 */
export async function handleGetBlogPost(request: Request, env: Env, slug: string): Promise<Response> {
  try {
    const cacheKey = `blog:post:${slug}`;
    const cached = await kvGet<unknown>(env.JHEDAI_CACHE, cacheKey);
    if (cached) {
      return corsResponse(
        { data: cached },
        request,
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'HIT' } }
      );
    }

    const row = await env.DB.prepare(`${BLOG_SELECT} WHERE bp.slug = ?`).bind(slug).first();
    if (!row) {
      return corsResponse({ error: 'Post not found' }, request, { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const post = formatPost(row);
    await kvSet(env.JHEDAI_CACHE, cacheKey, post, TTL.post);

    return corsResponse(
      { data: post },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('Get blog post error:', error);
    return corsResponse({ error: 'Internal server error' }, request, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/blog/posts/:slug/related — related posts (same category, exclude current)
 */
export async function handleGetRelatedPosts(request: Request, env: Env, slug: string): Promise<Response> {
  try {
    const cacheKey = `blog:related:${slug}`;
    const cached = await kvGet<unknown[]>(env.JHEDAI_CACHE, cacheKey);
    if (cached) {
      return corsResponse(
        { data: cached },
        request,
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'HIT' } }
      );
    }

    const current = await env.DB.prepare('SELECT category FROM blog_posts WHERE slug = ?').bind(slug).first<{ category: string }>();
    if (!current) {
      return corsResponse({ data: [] }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await env.DB.prepare(
      `${BLOG_SELECT} WHERE bp.category = ? AND bp.slug != ? ORDER BY bp.published_date DESC LIMIT 3`
    ).bind(current.category, slug).all();

    const posts = result.results.map(formatPost);
    await kvSet(env.JHEDAI_CACHE, cacheKey, posts, TTL.related);

    return corsResponse(
      { data: posts },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('Get related posts error:', error);
    return corsResponse({ data: [] }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/blog/categories — distinct categories
 */
export async function handleGetCategories(request: Request, env: Env): Promise<Response> {
  try {
    const cacheKey = 'blog:categories';
    const cached = await kvGet<string[]>(env.JHEDAI_CACHE, cacheKey);
    if (cached) {
      return corsResponse(
        { data: cached },
        request,
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'HIT' } }
      );
    }

    const result = await env.DB.prepare('SELECT DISTINCT category FROM blog_posts WHERE category IS NOT NULL ORDER BY category').all();
    const categories = result.results.map((r: any) => r.category);
    await kvSet(env.JHEDAI_CACHE, cacheKey, categories, TTL.categories);

    return corsResponse(
      { data: categories },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('Get categories error:', error);
    return corsResponse({ data: [] }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/sitemap-data — slugs + lastmod for sitemap generation
 */
export async function handleGetSitemapData(request: Request, env: Env): Promise<Response> {
  try {
    const cacheKey = 'blog:sitemap';
    const cached = await kvGet<unknown[]>(env.JHEDAI_CACHE, cacheKey);
    if (cached) {
      return corsResponse(
        { data: cached },
        request,
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'HIT' } }
      );
    }

    const result = await env.DB.prepare(
      'SELECT slug, updated_at, category FROM blog_posts ORDER BY published_date DESC'
    ).all();

    await kvSet(env.JHEDAI_CACHE, cacheKey, result.results, TTL.sitemap);

    return corsResponse(
      { data: result.results },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('Sitemap data error:', error);
    return corsResponse({ data: [] }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * GET /api/authors — list all authors
 */
export async function handleGetAuthors(request: Request, env: Env): Promise<Response> {
  try {
    const cacheKey = 'authors:all';
    const cached = await kvGet<unknown[]>(env.JHEDAI_CACHE, cacheKey);
    if (cached) {
      return corsResponse(
        { data: cached },
        request,
        { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'HIT' } }
      );
    }

    const result = await env.DB.prepare('SELECT * FROM authors ORDER BY id').all();
    const authors = result.results.map((r: Record<string, unknown>) => ({
      ...r,
      same_as: r.same_as ? JSON.parse(r.same_as as string) : [],
    }));
    await kvSet(env.JHEDAI_CACHE, cacheKey, authors, TTL.authors);

    return corsResponse(
      { data: authors },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'MISS' } }
    );
  } catch (error) {
    console.error('Get authors error:', error);
    return corsResponse({ data: [] }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

/** Check X-API-Key header */
function requireApiKey(request: Request, env: Env): Response | null {
  const key = request.headers.get('X-API-Key');
  if (!key || !env.API_KEY || key !== env.API_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

/** Invalidate all KV keys affected by a post write */
async function invalidatePostCache(kv: KVNamespace, slug: string): Promise<void> {
  await Promise.all([
    kv.delete(`blog:post:${slug}`),
    kv.delete(`blog:related:${slug}`),
    kv.delete('blog:categories'),
    kv.delete('blog:sitemap'),
    // Invalidate first 5 pages (covers most common list views)
    ...[1, 2, 3, 4, 5].flatMap((p) =>
      [9, 6, 3].map((l) => kv.delete(`blog:posts:p${p}:l${l}:c`))
    ),
  ]);
}

async function triggerDeploy(env: Env): Promise<void> {
  if (!env.PAGES_DEPLOY_HOOK) return;
  const headers: Record<string, string> = {};
  if (env.PAGES_DEPLOY_TOKEN) headers['Authorization'] = `Bearer ${env.PAGES_DEPLOY_TOKEN}`;
  await fetch(env.PAGES_DEPLOY_HOOK, { method: 'POST', headers });
}

/**
 * POST /api/blog/posts — create a new blog post (auth required)
 */
export async function handleCreateBlogPost(request: Request, env: Env): Promise<Response> {
  const authErr = requireApiKey(request, env);
  if (authErr) return authErr;

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body.slug || !body.title) {
      return corsResponse({ error: 'slug and title are required' }, request, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await env.DB.prepare(`
      INSERT INTO blog_posts (slug, title, excerpt, content, category, author, author_avatar, tags, read_time, featured,
        featured_image, featured_image_alt, meta_title, meta_description, published_date,
        author_id, faq_items, word_count, primary_answer, speakable_selectors,
        og_title, og_description, og_image, twitter_title, twitter_description,
        key_takeaways, canonical_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.slug, body.title, body.excerpt || null, body.content || null,
      body.category || null, body.author || 'JhedAi', body.author_avatar || null,
      JSON.stringify(body.tags || []), body.read_time || '5 min', body.featured ? 1 : 0,
      body.featured_image || null, body.featured_image_alt || null,
      body.meta_title || null, body.meta_description || null,
      body.published_date || new Date().toISOString().split('T')[0],
      body.author_id || 1, JSON.stringify(body.faq_items || []),
      body.word_count || 0, body.primary_answer || null,
      JSON.stringify(body.speakable_selectors || ['h1', '.article-intro', 'h2']),
      body.og_title || null, body.og_description || null, body.og_image || null,
      body.twitter_title || null, body.twitter_description || null,
      JSON.stringify(body.key_takeaways || []), body.canonical_url || null,
      body.status || 'published',
    ).run();

    await invalidatePostCache(env.JHEDAI_CACHE, body.slug as string);
    await triggerDeploy(env);

    return corsResponse(
      { success: true, data: { id: result.meta.last_row_id, slug: body.slug } },
      request,
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create blog post error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /api/blog/posts/:slug — update a blog post (auth required)
 */
export async function handleUpdateBlogPost(request: Request, env: Env, slug: string): Promise<Response> {
  const authErr = requireApiKey(request, env);
  if (authErr) return authErr;

  try {
    const body = await request.json() as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowedFields: Record<string, (v: unknown) => unknown> = {
      title: (v) => v, excerpt: (v) => v, content: (v) => v, category: (v) => v,
      author: (v) => v, author_avatar: (v) => v, read_time: (v) => v,
      featured: (v) => v ? 1 : 0, featured_image: (v) => v, featured_image_alt: (v) => v,
      meta_title: (v) => v, meta_description: (v) => v, published_date: (v) => v,
      updated_at: (v) => v,
      author_id: (v) => v, word_count: (v) => v, primary_answer: (v) => v,
      og_title: (v) => v, og_description: (v) => v, og_image: (v) => v,
      twitter_title: (v) => v, twitter_description: (v) => v,
      canonical_url: (v) => v, status: (v) => v,
      tags: (v) => JSON.stringify(v), faq_items: (v) => JSON.stringify(v),
      key_takeaways: (v) => JSON.stringify(v), speakable_selectors: (v) => JSON.stringify(v),
    };

    for (const [key, transform] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(transform(body[key]));
      }
    }

    if (fields.length === 0) {
      return corsResponse({ error: 'No fields to update' }, request, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!body.updated_at) fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(slug);

    await env.DB.prepare(`UPDATE blog_posts SET ${fields.join(', ')} WHERE slug = ?`).bind(...values).run();

    const newSlug = body.slug as string | undefined;
    if (newSlug && newSlug !== slug) {
      await env.DB.prepare('UPDATE blog_posts SET slug = ? WHERE slug = ?').bind(newSlug, slug).run();
      await invalidatePostCache(env.JHEDAI_CACHE, newSlug);
    }

    await invalidatePostCache(env.JHEDAI_CACHE, slug);
    await triggerDeploy(env);

    return corsResponse({ success: true }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Update blog post error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/blog/posts/:slug — delete a blog post (auth required)
 */
export async function handleDeleteBlogPost(request: Request, env: Env, slug: string): Promise<Response> {
  const authErr = requireApiKey(request, env);
  if (authErr) return authErr;

  try {
    const result = await env.DB.prepare('DELETE FROM blog_posts WHERE slug = ?').bind(slug).run();
    if (result.meta.changes === 0) {
      return corsResponse({ error: 'Post not found' }, request, { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await invalidatePostCache(env.JHEDAI_CACHE, slug);
    await triggerDeploy(env);

    return corsResponse({ success: true }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Delete blog post error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/authors — create author (auth required)
 */
export async function handleCreateAuthor(request: Request, env: Env): Promise<Response> {
  const authErr = requireApiKey(request, env);
  if (authErr) return authErr;

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body.slug || !body.name) {
      return corsResponse({ error: 'slug and name are required' }, request, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await env.DB.prepare(`
      INSERT INTO authors (slug, name, type, job_title, bio, avatar, url, same_as, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.slug, body.name, body.type || 'Person',
      body.job_title || null, body.bio || null, body.avatar || null,
      body.url || null, JSON.stringify(body.same_as || []), body.email || null,
    ).run();

    await env.JHEDAI_CACHE.delete('authors:all');

    return corsResponse(
      { success: true, data: { id: result.meta.last_row_id, slug: body.slug } },
      request,
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create author error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /api/authors/:slug — update author (auth required)
 */
export async function handleUpdateAuthor(request: Request, env: Env, slug: string): Promise<Response> {
  const authErr = requireApiKey(request, env);
  if (authErr) return authErr;

  try {
    const body = await request.json() as Record<string, unknown>;
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowedFields: Record<string, (v: unknown) => unknown> = {
      name: (v) => v, type: (v) => v, job_title: (v) => v, bio: (v) => v,
      avatar: (v) => v, url: (v) => v, email: (v) => v,
      same_as: (v) => JSON.stringify(v),
    };

    for (const [key, transform] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(transform(body[key]));
      }
    }

    if (fields.length === 0) {
      return corsResponse({ error: 'No fields to update' }, request, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    values.push(slug);
    await env.DB.prepare(`UPDATE authors SET ${fields.join(', ')} WHERE slug = ?`).bind(...values).run();

    const newSlug = body.slug as string | undefined;
    if (newSlug && newSlug !== slug) {
      await env.DB.prepare('UPDATE authors SET slug = ? WHERE slug = ?').bind(newSlug, slug).run();
    }

    await env.JHEDAI_CACHE.delete('authors:all');

    return corsResponse({ success: true }, request, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Update author error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/contacts — admin list of contact form submissions
 */
export async function handleGetContacts(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status') || 'all';
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM contacts';
    let countQuery = 'SELECT COUNT(*) as total FROM contacts';

    if (status !== 'all') {
      query += ' WHERE status = ?';
      countQuery += ' WHERE status = ?';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const [countResult, result] = await Promise.all([
      status !== 'all'
        ? env.DB.prepare(countQuery).bind(status).first()
        : env.DB.prepare(countQuery).first(),
      status !== 'all'
        ? env.DB.prepare(query).bind(status, limit, offset).all()
        : env.DB.prepare(query).bind(limit, offset).all(),
    ]);

    const total = (countResult as any)?.total || 0;

    return corsResponse(
      { data: result.results, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      request,
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } }
    );
  } catch (error) {
    console.error('Get contacts error:', error);
    return corsResponse(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
