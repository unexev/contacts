# Contacts SaaS

A contact management SaaS application built with Go, SvelteKit, and PostgreSQL.

## Deployment

### Backend (Vercel)
1. Create a new project in Vercel pointing to `backend/`
2. Add `DATABASE_URL` and `JWT_SECRET` in Environment Variables
3. The `api/index.go` is the entry point for Vercel

### Frontend (Cloudflare Pages)
1. Create a new project in Cloudflare Pages pointing to `web/`
2. Add `VITE_API_BASE_URL` pointing to your backend
3. Build command: `npm run build`
4. Output directory: `build`

### Database (Supabase)
1. Create a project in Supabase
2. Use **Transaction Pooler** (IPv4 compatible with Vercel)
3. Add `?sslmode=require&pgbouncer=true` to the URL
4. Run migrations: `go run ./cmd/migrate`

## Tech Stack

- **Backend**: Go + Chi router + pgx + PostgreSQL
- **Frontend**: SvelteKit 5 + Vite + adapter-static
- **Database**: PostgreSQL 16
- **Deployment**: Vercel (backend) + Cloudflare Pages (frontend) + Supabase (DB)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.22+
- Node.js 18+

### 1. Start the database

```bash
docker compose up -d
```

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
go run ./cmd/server
```

### 3. Set up the frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

The app will be available at http://localhost:5173.

## Environment Variables

## Product Requirements

- The database schema and persisted business values must use English, stable machine-readable identifiers.
- User-facing labels must be translated in the frontend through the i18n layer.
- Identity document types use these database values: `national_id`, `passport`, `drivers_license`, `residence_permit`, and `other`.
- Contact location types use these database values: `birth`, `residence`, `work`, and `other`.
- Location coordinates (`latitude` and `longitude`) are optional numeric values.

### Root / Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/contacts` |
| `JWT_SECRET` | Secret key for JWT signing | - |
| `JWT_TTL_HOURS` | JWT token lifetime in hours | `72` |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8080` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts` | Create contact |
| GET | `/api/contacts/:id` | Get contact |
| PUT | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Delete contact |
| GET | `/api/contacts/:id/phones` | List phones |
| POST | `/api/contacts/:id/phones` | Add phone |
| GET | `/api/contacts/:id/emails` | List emails |
| POST | `/api/contacts/:id/emails` | Add email |
| GET | `/api/contacts/:id/urls` | List URLs |
| POST | `/api/contacts/:id/urls` | Add URL |
| GET | `/api/contacts/:id/notes` | List notes |
| POST | `/api/contacts/:id/notes` | Add note |
| GET | `/api/contacts/:id/keywords` | List keywords |
| POST | `/api/contacts/:id/keywords` | Add keyword |
| GET | `/api/contacts/:id/identity-cards` | List identity cards |
| POST | `/api/contacts/:id/identity-cards` | Add identity card |
| GET | `/api/contacts/:id/bank-accounts` | List bank accounts |
| POST | `/api/contacts/:id/bank-accounts` | Add bank account |
| GET | `/api/contacts/:id/relationships` | List relationships |
| POST | `/api/contacts/:id/relationships` | Add relationship |
| GET | `/api/contacts/:id/organizations` | List organizations |
| POST | `/api/contacts/:id/organizations` | Add organization |
| GET | `/api/marital-statuses` | List marital statuses |
| GET | `/api/relationship-types` | List relationship types |
| GET | `/api/organizations` | List organizations |
