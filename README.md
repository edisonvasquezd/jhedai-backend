# JhedAI Backend API

Backend API para JhedAI construido con Cloudflare Workers.

## 🚀 Features

- ⚡ **Serverless**: Desplegado en Cloudflare Workers Edge Network
- 🌍 **Global**: Edge computing con baja latencia mundial
- 🔒 **CORS**: Configuración CORS completa
- 📝 **TypeScript**: Tipado estático completo
- 🎯 **REST API**: Endpoints RESTful organizados

## 📦 Estructura del Proyecto

```
jhedai-backend/
├── src/
│   ├── index.ts          # Entry point principal
│   ├── routes/
│   │   └── api.ts        # Handlers de API endpoints
│   └── utils/
│       └── cors.ts       # Utilidades CORS
├── wrangler.toml         # Configuración de Cloudflare
├── tsconfig.json         # Configuración TypeScript
└── package.json
```

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Autenticarse en Cloudflare
npx wrangler login
```

## 💻 Desarrollo

```bash
# Servidor de desarrollo local
npm run dev

# El servidor estará disponible en http://localhost:8787
```

## 📡 API Endpoints

### Health Check
```http
GET /
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-02-24T00:00:00.000Z",
  "service": "jhedai-api",
  "version": "1.0.0"
}
```

### Servicios
```http
GET /api/services
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "slug": "analisis-datos",
      "title": "Análisis de Datos",
      "description": "...",
      "category": "data"
    }
  ],
  "count": 7
}
```

### Formulario de Contacto
```http
POST /api/contact
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "empresa": "Empresa S.A.",
  "telefono": "+56912345678",
  "servicio": "Machine Learning",
  "mensaje": "Necesito información..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mensaje recibido correctamente",
  "data": {
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  }
}
```

### Blog Posts
```http
GET /api/blog?page=1&limit=10
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

## 🚀 Deployment

### Deploy a Producción

```bash
# Deploy directo
npm run deploy

# O con wrangler
npx wrangler deploy
```

### Deploy con CI/CD (GitHub Actions)

Crear `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 🔧 Configuración

### Variables de Entorno

Editar `wrangler.toml`:

```toml
[vars]
FRONTEND_URL = "https://jhedai-redesign.vercel.app"
ALLOWED_ORIGINS = "https://jhedai-redesign.vercel.app,http://localhost:5173"
```

### Secrets

```bash
# Agregar secrets (API keys, etc.)
npx wrangler secret put API_KEY
npx wrangler secret put DATABASE_URL
```

### D1 Database (SQL)

```bash
# Crear database
npx wrangler d1 create jhedai-db

# Ejecutar migrations
npx wrangler d1 execute jhedai-db --file=./schema.sql
```

Actualizar `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "jhedai-db"
database_id = "your-database-id"
```

### KV Storage (Key-Value)

```bash
# Crear KV namespace
npx wrangler kv:namespace create KV

# Para producción
npx wrangler kv:namespace create KV --preview
```

Actualizar `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"
preview_id = "your-preview-kv-id"
```

## 📊 Monitoring

### Ver logs en tiempo real

```bash
npm run tail

# O con filtros
npx wrangler tail --format pretty
```

### Métricas

Acceder al dashboard de Cloudflare:
- https://dash.cloudflare.com/
- Workers & Pages → jhedai-api → Metrics

## 🧪 Testing

```bash
# Test local con curl
curl http://localhost:8787/health

# Test producción
curl https://jhedai-api.workers.dev/health
```

### Testing CORS

```bash
curl -H "Origin: https://jhedai-redesign.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8787/api/contact
```

## 🔐 Security

### Rate Limiting

Agregar rate limiting en `src/index.ts`:

```typescript
// TODO: Implementar rate limiting
// Cloudflare ofrece rate limiting a nivel de Worker
```

### Input Validation

- ✅ Email validation implementada
- ✅ Required fields validation
- ⚠️ TODO: Schema validation con Zod

### CORS Configuration

Configurado para aceptar requests desde:
- `https://jhedai-redesign.vercel.app`
- `http://localhost:5173` (desarrollo)

## 📚 Recursos

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [KV Storage](https://developers.cloudflare.com/kv/)
- [R2 Storage](https://developers.cloudflare.com/r2/)

## 🤝 Integración con Frontend

### Actualizar Frontend API Client

En el frontend (Vercel), crear `src/lib/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'https://jhedai-api.workers.dev';

export async function submitContactForm(data: any) {
  const response = await fetch(`${API_URL}/api/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to submit form');
  }

  return response.json();
}
```

### Variables de Entorno (Frontend)

Crear `.env` en el proyecto frontend:

```bash
VITE_API_URL=https://jhedai-api.workers.dev
```

En Vercel dashboard, agregar la variable de entorno.

## 📝 TODO

- [ ] Implementar autenticación JWT
- [ ] Agregar rate limiting
- [ ] Configurar D1 database
- [ ] Implementar email notifications (SendGrid/Resend)
- [ ] Agregar schema validation (Zod)
- [ ] Unit tests
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Error tracking (Sentry)

## 📄 License

MIT

---

**Creado por:** Claude Sonnet 4.5
**Fecha:** 2025-02-24
