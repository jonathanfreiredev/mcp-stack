# Next.js + FastAPI Starter

A full-stack starter template pairing a **Next.js 16** frontend with a **FastAPI** backend, wired together with a complete authentication flow, server actions, and a PostgreSQL database.

Authentication is delegated to [**Supabase Auth**](https://supabase.com/docs/guides/auth) (OAuth 2.1 / OIDC): it owns credentials, email verification, social login and sessions, while the FastAPI backend acts as a **resource server** that verifies the access token against Supabase's JWKS. The template ships with signup, login, email verification, password reset, profile editing and password change as working examples, so you can start building features on top of a real, end-to-end setup instead of a blank page.

## Tech stack

| Layer      | Technology                                                                        |
| ---------- | --------------------------------------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Motion  |
| Forms      | React Hook Form, Zod, next-safe-action                                             |
| Auth       | Supabase Auth (`@supabase/ssr`), asymmetric JWTs verified via JWKS                 |
| Backend    | FastAPI, SQLAlchemy 2 (async), PyJWT, Pydantic v2                                   |
| Database   | PostgreSQL, Alembic migrations                                                     |

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────┐        ┌───────────────┐
│  Browser                 │        │  Next.js (server)        │        │  FastAPI      │
│                          │        │                          │        │               │
│  React components  ──────┼───────▶│  server actions  ────────┼───────▶│  /v1/users/me │
│  (client)                │        │  (@supabase/ssr)         │        │  verify JWT   │
│                          │◀───────┼──  Supabase session      │◀───────┼──  JWKS       │
│  session via getSession  │        │  cookies                 │        │  SQLAlchemy   │
└──────────────────────────┘        └────────────┬─────────────┘        └──────┬────────┘
                                                  │                             │
                                       ┌──────────▼──────────┐         ┌────────▼────────┐
                                       │  Supabase Auth       │         │  PostgreSQL     │
                                       │  (credentials, JWT)  │         │  (your data)    │
                                       └──────────────────────┘         └─────────────────┘
```

The browser authenticates against Supabase through Next.js server actions; the session is a cookie managed by `@supabase/ssr`. The browser never talks to FastAPI directly: the Next.js server calls it with the Supabase access token, and the backend verifies that token against Supabase's JWKS before touching the database.

## Repository structure

```
.
├── backend/                 # FastAPI application (resource server)
│   ├── app/
│   │   ├── auth/            # JWT verification + bearer dependency
│   │   ├── users/           # Profile model, schemas, JIT provisioning, /users router
│   │   ├── health/          # Liveness + readiness probes
│   │   ├── middleware/      # Request id + structured access log
│   │   ├── db/              # Async engine, session, base model
│   │   ├── api.py           # Versioned API entrypoint (mounts /v1)
│   │   ├── settings.py      # Pydantic settings (reads .env)
│   │   ├── logging_config.py # structlog setup (text in dev, JSON in prod)
│   │   └── main.py          # App entrypoint, CORS, routers
│   ├── alembic/             # Database migrations
│   ├── tests/               # Unit + integration tests
│   ├── Dockerfile           # Dev image (+ production stage)
│   ├── start-database.sh    # Local PostgreSQL container helper
│   └── pyproject.toml       # Dependencies (managed with uv)
│
├── frontend/                # Next.js application
│   ├── app/                 # App Router pages, layouts, confirm route handler
│   ├── components/          # UI + auth components (shadcn/ui based)
│   ├── server/              # Server actions, schemas, session helper
│   ├── lib/                 # Env validation, Supabase client, safe-action, providers
│   ├── proxy.ts             # Refreshes the Supabase session per request
│   ├── Dockerfile           # Dev image
│   └── package.json         # Dependencies (managed with pnpm)
│
├── .github/workflows/       # CI (backend + frontend)
├── docker-compose.yml       # Local development stack
└── LICENSE                  # MIT
```

## Prerequisites

- **Node.js** 20+ and **pnpm**
- **Python** 3.14+ and [**uv**](https://docs.astral.sh/uv/)
- **Docker** or **Podman** if you want the containerized stack (or a local database via `start-database.sh`)
- A **Supabase project** (free tier is enough)

## Getting started

### 1. Supabase

Create a project and configure auth (enable Email and, optionally, Google; set the Site URL and redirect URLs to `/auth/confirm`). Copy the project URL and anon key — you will paste them into the frontend env. The full walkthrough is in [`frontend/README.md`](./frontend/README.md#supabase-setup).

### 2. Backend

```bash
cd backend

# Install dependencies
uv sync

# Create your environment file and set SUPABASE_URL
cp .env.example .env

# Start a local PostgreSQL container (reads DATABASE_URL from .env)
./start-database.sh

# Apply database migrations
uv run alembic upgrade head

# Run the dev server on http://localhost:8000
uv run fastapi dev
```

Interactive API docs are available at http://localhost:8000/docs.

### 3. Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Create your environment file and set the Supabase URL / anon key
cp .env.example .env

# Run the dev server on http://localhost:3000
pnpm dev
```

Open http://localhost:3000 and sign up. Supabase sends a verification email (check its logs while developing) — open the link, then log in.

## Run with Docker

`docker-compose.yml` is a **local development** stack: PostgreSQL plus the API and the web app, with the source mounted and the dev servers running with reload.

```bash
docker compose up
```

A one-shot `migrate` service runs `alembic upgrade head` before the API starts, so the schema is always up to date. The backend and frontend read their environment from **`backend/.env`** and **`frontend/.env`** respectively (`env_file` in `docker-compose.yml`), so there is no separate root file to maintain — only the Docker-internal hostnames (`postgres`, `backend`) are overridden.

Deployment is not handled here: the frontend goes to Vercel (which builds it natively) and the backend to its own service. The `backend/Dockerfile` also has a production stage if you deploy it as a container.

## Health checks

The backend exposes two unauthenticated probes for orchestrators, load balancers and uptime monitors:

- `GET /health` — **liveness**: the process is running. It checks nothing external, so a failure means "restart the container".
- `GET /health/ready` — **readiness**: pings the database with `SELECT 1` and returns `503` when it is unreachable, so traffic is routed away without restarting the process.

On **Render** or **Railway**, set the health check path to `/health`. Locally, `docker-compose.yml` probes `/health` and the frontend waits for the backend to be healthy.

## Environment variables

### `backend/.env`

| Variable                | Required | Description                                                                 |
| ----------------------- | -------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`          | Yes      | Async PostgreSQL URL, e.g. `postgresql+asyncpg://postgres:password@localhost:5432/app`. |
| `SUPABASE_URL`          | Yes      | Supabase project URL. Used to derive the issuer and the JWKS endpoint.       |
| `SUPABASE_JWT_AUDIENCE` | No       | Audience claim on access tokens (default `authenticated`).                   |
| `ENV`                   | No       | `production` (default) or `development`. Enables SQL echo when in development. |
| `LOG_LEVEL`             | No       | Minimum level for the application logs (default `INFO`).                     |
| `FRONTEND_URL`          | No       | Base URL of the frontend, used for redirects.                                |
| `CORS_ORIGINS`          | No       | Comma-separated browser origins allowed to call the API (default `http://localhost:3000`). |

### `frontend/.env`

| Variable                        | Required | Description                                             |
| ------------------------------- | -------- | ------------------------------------------------------- |
| `BACKEND_URL`                   | Yes      | Base URL of the FastAPI backend, e.g. `http://localhost:8000`. |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL.                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes      | Supabase publishable key (replaces the legacy anon key). |
| `SUPABASE_SECRET_KEY`                  | Yes      | Supabase secret key. **Server-only**; deletes a user's account. |
| `NEXT_PUBLIC_AUTH_PROVIDERS`    | No       | Enabled login methods (`email,google`). Default `email`. |
| `NODE_ENV`                      | No       | Set automatically by Next.js.                           |

Environment variables in the frontend are validated at startup with `@t3-oss/env-nextjs` (`lib/env.js`). The publishable and secret keys are Supabase's current keys; they replace the legacy `anon` and `service_role` keys (deprecated at the end of 2026).

## API reference

All endpoints live on the FastAPI backend. Protected routes expect an `Authorization: Bearer <supabase_access_token>` header.

| Method | Path            | Auth | Description                                             |
| ------ | --------------- | :--: | ------------------------------------------------------- |
| GET    | `/health`       |      | Liveness: the process is up (no external checks)        |
| GET    | `/health/ready` |      | Readiness: the database is reachable (`503` if not)     |
| GET    | `/v1/users/me`  |  ✓   | Return the current profile (provisions it on first use) |
| PATCH  | `/v1/users/me`  |  ✓   | Update the profile name                                 |
| DELETE | `/v1/users/me`  |  ✓   | Delete the profile (hard delete)                        |

The application API is versioned under `/v1`. The health checks stay unversioned so a future `/v2` never breaks orchestrators.

Errors use FastAPI's default body (`{"detail": ...}`). Migrating to RFC 9457 ("Problem Details") is deliberately deferred until FastAPI supports it natively.

Authentication (signup, login, verification, reset) is handled by **Supabase Auth**, not this API.

## Authentication flow

1. The user signs up or logs in through a **server action**, which calls **Supabase Auth** (`@supabase/ssr`). The session is stored in cookies managed by the Next.js server.
2. `proxy.ts` refreshes the session on every request (Next.js 16 renamed `middleware` to `proxy`).
3. `getSession()` (`frontend/server/auth/auth.lib.ts`) validates the user with Supabase and fetches the profile from the backend, returning the session and user.
4. Protected server actions use `protectedProcedure`, which rejects the request when there is no valid session and forwards the Supabase access token to the backend.
5. The backend **verifies** the token against Supabase's **JWKS** (`iss`, `aud`, `exp`) and **provisions a local profile** keyed by the token's `sub` the first time it sees the user.
6. Supabase sends verification and password-reset emails; `frontend/app/auth/confirm/route.ts` handles the links and the OAuth callback.
7. **Account deletion** is a hard delete on both sides: the backend removes the local profile and the frontend then deletes the Supabase identity through the admin API. The email is freed, so the same address can sign up again.

## Common commands

### Backend (`backend/`)

| Command                                            | Description                        |
| -------------------------------------------------- | ---------------------------------- |
| `uv run fastapi dev`                               | Start the dev server with reload   |
| `uv run fastapi run`                               | Start the production server        |
| `uv run alembic revision --autogenerate -m "msg"`  | Create a migration from model changes |
| `uv run alembic upgrade head`                      | Apply migrations                   |
| `uv run alembic downgrade -1`                      | Roll back the last migration        |
| `uv run ruff check .`                              | Lint the backend                   |
| `uv run ruff format .`                             | Format the backend                 |
| `uv run pytest`                                    | Run all backend tests              |
| `uv run pytest tests/unit`                         | Run unit tests (no database needed) |

### Frontend (`frontend/`)

| Command        | Description                     |
| -------------- | ------------------------------- |
| `pnpm dev`     | Start the dev server            |
| `pnpm build`   | Production build                |
| `pnpm start`   | Serve the production build      |
| `pnpm lint`    | Run ESLint                      |

## Continuous integration

GitHub Actions runs two path-filtered workflows, so a change in one app does not trigger the other:

- `.github/workflows/backend.yml` — lints, checks formatting, applies migrations and runs the tests against a PostgreSQL service container.
- `.github/workflows/frontend.yml` — lints, type-checks, runs the unit tests, builds the app and runs the Playwright end-to-end tests.

## License

[MIT](./LICENSE) © 2026 Jonathan Freire
