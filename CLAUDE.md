# JhedAI Backend API - CLAUDE.md

## Project Overview

Backend API para JhedAI. Cloudflare Worker (vanilla, sin framework) con D1 SQLite. Maneja blog, contacto, autores y servicios.

## Stack

- **Runtime**: Cloudflare Workers
- **DB**: D1 SQLite (binding: `DB`, name: `jhedai-db`)
- **Email**: Resend API (vía `RESEND_API_KEY` secret)
- **Auth**: API key simple (`X-API-Key` header vs `API_KEY` secret)
- **Language**: TypeScript

## URLs

- **Worker**: https://jhedai-api.edison-985.workers.dev
- **D1 Database ID**: `29c3ab5b-17c2-436e-9216-3285866a024c`

## Development Commands

```bash
npm install              # Instalar dependencias
npm run build            # TypeScript compile (tsc)
npx wrangler dev         # Dev server local
npx wrangler deploy      # Deploy a producción

# Migraciones D1
npx wrangler d1 execute jhedai-db --remote --file=migrations/XXX.sql
npx wrangler d1 execute jhedai-db --remote --command="SELECT ..."

# Secrets
npx wrangler secret put API_KEY
npx wrangler secret put RESEND_API_KEY
```

## Architecture

```
src/
  index.ts             # Main entry point — switch-based router
  routes/
    api.ts             # All route handlers + formatPost() + BLOG_SELECT JOIN
  utils/
    cors.ts            # CORS helpers (corsResponse, handleCors, corsHeaders)
migrations/
  002-create-authors.sql   # Tabla authors (Person | Organization)
  003-blog-seo-aeo.sql     # Campos SEO/GEO/AEO en blog_posts
schema.sql                 # Tabla original: contacts, blog_posts, services
migrate-blog.sql           # Migración: +8 campos blog (tags, read_time, etc.)
seed-blog.sql              # Seed data: 10 posts iniciales
```

## D1 Schema

### authors
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | AUTOINCREMENT |
| slug | TEXT UNIQUE | e.g. `jhedai-org`, `ignacio-lopez` |
| name | TEXT | Display name |
| type | TEXT | `'Person'` or `'Organization'` |
| job_title | TEXT | Solo Person |
| bio | TEXT | |
| avatar | TEXT | URL imagen |
| url | TEXT | Web personal u org |
| same_as | TEXT (JSON) | `["https://linkedin.com/in/x"]` |
| email | TEXT | |
| created_at | DATETIME | |

### blog_posts (23 columns)
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| slug | TEXT UNIQUE | |
| title | TEXT | |
| excerpt | TEXT | |
| content | TEXT | HTML |
| category | TEXT | |
| author | TEXT | Legacy (nombre plano) |
| published_date | DATE | |
| created_at | DATETIME | |
| updated_at | DATETIME | |
| tags | TEXT (JSON) | `["tag1", "tag2"]` |
| read_time | TEXT | `"5 min"` |
| featured | INTEGER | 0/1 |
| featured_image | TEXT | URL |
| featured_image_alt | TEXT | |
| meta_title | TEXT | |
| meta_description | TEXT | |
| author_avatar | TEXT | Legacy |
| **author_id** | INTEGER FK | → authors(id), default 1 |
| **faq_items** | TEXT (JSON) | `[{question, answer}]` |
| **word_count** | INTEGER | |
| **primary_answer** | TEXT | Respuesta directa ~150 chars |
| **speakable_selectors** | TEXT (JSON) | `["h1",".post-excerpt"]` |

### contacts
id, nombre, email, empresa, telefono, servicio, mensaje, status, created_at

## API Endpoints

### Public (no auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` `/health` | Health check |
| GET | `/api/services` | Servicios (hardcoded) |
| GET | `/api/blog/posts` | Posts paginados (?page, ?limit, ?category) |
| GET | `/api/blog/posts/:slug` | Post individual con author enriched |
| GET | `/api/blog/posts/:slug/related` | Posts relacionados (misma categoría) |
| GET | `/api/blog/categories` | Categorías distintas |
| GET | `/api/authors` | Lista autores |
| GET | `/api/sitemap-data` | slugs + updated_at para sitemap |
| GET | `/api/contacts` | Admin: lista contactos |

### Protected (X-API-Key header)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/blog/posts` | Crear post |
| PUT | `/api/blog/posts/:slug` | Actualizar post (parcial) |
| DELETE | `/api/blog/posts/:slug` | Eliminar post |
| POST | `/api/authors` | Crear autor |
| PUT | `/api/authors/:slug` | Actualizar autor |

## Key Patterns

- **BLOG_SELECT**: Todas las queries blog usan `LEFT JOIN authors` para devolver author enriched
- **formatPost()**: Parsea JSON fields (tags, faq_items, speakable_selectors, same_as) y estructura el author object con E-E-A-T fields
- **corsResponse()**: Wrapper que agrega CORS headers automáticamente
- **requireApiKey()**: Middleware inline para endpoints write
- **No framework**: Router manual con switch(true) en index.ts

## Configuration

- `wrangler.toml` — D1 binding, env vars (FRONTEND_URL, ALLOWED_ORIGINS)
- Secrets (via wrangler): `API_KEY`, `RESEND_API_KEY`

## Pending / Known Issues

- `GET /api/contacts` no tiene auth — agregar requireApiKey
- Poblar faq_items, word_count, primary_answer en los 10 posts existentes
- Crear autores Person del equipo JhedAI
- wrangler 4.68.0 desactualizado (4.76.0 disponible)
