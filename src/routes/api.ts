/**
 * API Routes for JhedAI Backend
 */

import { corsResponse } from '../utils/cors';

export interface Env {
  FRONTEND_URL: string;
  ALLOWED_ORIGINS: string;
  // D1 database binding (when configured)
  // DB?: D1Database;
  // KV storage binding (when configured)
  // KV?: KVNamespace;
}

/**
 * Health check endpoint
 */
export async function handleHealth(request: Request, env: Env): Promise<Response> {
  const data = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'jhedai-api',
    version: '1.0.0',
  };

  return corsResponse(data, request, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get services endpoint
 */
export async function handleGetServices(request: Request, env: Env): Promise<Response> {
  // Ejemplo de datos - reemplazar con datos reales de DB o KV
  const services = [
    {
      id: 1,
      slug: 'analisis-datos',
      title: 'Análisis de Datos',
      description: 'Transformación de datos brutos en insights accionables',
      category: 'data',
    },
    {
      id: 2,
      slug: 'machine-learning',
      title: 'Machine Learning',
      description: 'Modelos de ML personalizados para clasificación y predicción',
      category: 'ai',
    },
    // ... más servicios
  ];

  return corsResponse(
    { data: services, count: services.length },
    request,
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    }
  );
}

/**
 * Contact form endpoint
 */
export async function handleContactForm(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Validación básica
    if (!body.nombre || !body.email || !body.mensaje) {
      return corsResponse(
        {
          error: 'Missing required fields',
          required: ['nombre', 'email', 'mensaje'],
        },
        request,
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return corsResponse(
        { error: 'Invalid email format' },
        request,
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Guardar en DB o enviar email
    // await env.DB.prepare('INSERT INTO contacts ...')
    // O enviar email via SendGrid, Resend, etc.

    console.log('Contact form submission:', {
      nombre: body.nombre,
      email: body.email,
      empresa: body.empresa,
      mensaje: body.mensaje?.substring(0, 50) + '...',
    });

    return corsResponse(
      {
        success: true,
        message: 'Mensaje recibido correctamente',
        data: {
          nombre: body.nombre,
          email: body.email,
        },
      },
      request,
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return corsResponse(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      request,
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get blog posts endpoint
 */
export async function handleGetBlogPosts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  // Ejemplo de datos - reemplazar con datos reales de DB
  const posts = [
    {
      id: 1,
      slug: 'introduccion-ia-industrial',
      title: 'Introducción a IA Industrial',
      excerpt: 'Descubre cómo la IA está transformando la industria...',
      date: '2025-02-01',
      category: 'IA Industrial',
    },
    // ... más posts
  ];

  return corsResponse(
    {
      data: posts,
      pagination: {
        page,
        limit,
        total: posts.length,
        pages: Math.ceil(posts.length / limit),
      },
    },
    request,
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    }
  );
}
