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
4. Migrations are applied automatically when the backend starts (or run them manually with `go run ./cmd/migrate`)

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
| `JWT_TTL_MINUTES` | Access token lifetime in minutes; clients renew it with the refresh token | `60` |
| `REFRESH_TTL_DAYS` | Refresh token lifetime in days | `90` |
| `REFRESH_GRACE_SECONDS` | Window in which a just-rotated refresh token may be retried (lost responses) | `300` |
| `CORS_ORIGINS` | Comma-separated allowed origins (`*` for all) | `http://localhost:5173,http://localhost:4173` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `API_URL`, `APP_URL` | Optional. Resend sends the email-confirmation message. `EMAIL_FROM` must use a domain verified in Resend (e.g. `Contacts <no-reply@example.com>`); `API_URL` is the public URL of this backend (the email link points at it) and `APP_URL` the public URL of the web app (where the link redirects after confirming), both without a trailing slash. Without all four, registration works and no email is sent | - |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Optional. Supabase Storage for contact photos; photo endpoints answer 503 when unset | - |

Migrations run automatically every time the backend starts and are idempotent, so deploying is enough to apply new ones.

## Authentication

- **Email confirmation**: when `RESEND_API_KEY`, `EMAIL_FROM`, `API_URL` and `APP_URL` are all set, an account must confirm its email before it can sign in. Registering sends a link valid for 24 hours (the token is stored hashed and is single use) and returns `verification_required` instead of tokens; login answers `403 email not verified` until the link is opened, and every data route does too, so a session cannot outlive a change of email. A locked account can still read, change or delete itself (`/api/auth/me`). Changing the email makes the account unconfirmed again, sends a new link and ends the session. Existing accounts count as confirmed. With any of the four variables missing nothing is enforced, so a broken mail setup can never lock everyone out.
- **Passwords** are hashed with bcrypt (8 to 72 bytes). Emails are trimmed, lowercased and unique regardless of letter case.
- **Access token**: a short-lived JWT (`JWT_TTL_MINUTES`, 60 by default) sent as `Authorization: Bearer <token>`.
- **Refresh token**: opaque, stored hashed, rotated on every use and revoked as a family when reuse is detected. Clients call `/api/auth/refresh` when the access token expires; the web client does this automatically and retries the request once.
- **Rate limits** are stored in PostgreSQL, so they hold across serverless instances: 30 requests per minute per IP on `/api/auth/*`, and 10 login attempts per 15 minutes per account. Both answer `429` with `Retry-After`.
- Changing the email or password requires the current password and revokes every other session.

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8080` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login; returns an access token and a refresh token |
| POST | `/api/auth/refresh` | Exchange a refresh token for a new access and refresh token |
| POST | `/api/auth/logout` | Revoke the session's refresh token |
| GET | `/api/auth/verify-email?token=` | Confirm an email from the link sent by email; redirects to `APP_URL/login?email_verified=ok\|invalid\|error` |
| POST | `/api/auth/resend-verification` | Send the confirmation email again. Public: takes `email` and `password` (the account has no session yet), shares the login attempt limit, once per 10 minutes per account |
| GET | `/api/auth/me` | Current user, including `email_verified` (requires auth) |
| PUT | `/api/auth/me` | Change email and/or password (requires auth and the current password) |
| DELETE | `/api/auth/me` | Permanently delete the account, its contacts and their photos (requires auth and `current_password` in the body; answers `204`) |
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
