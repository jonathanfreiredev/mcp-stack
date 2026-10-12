# Backend — FastAPI

The API for the [Next.js + FastAPI Starter](../README.md). It exposes the application's domain data (the user profile) on top of an async SQLAlchemy / PostgreSQL stack.

Authentication is delegated to [**Supabase Auth**](https://supabase.com/docs/guides/auth), which owns credentials, email verification, social login and sessions. This service is a **resource server**: it verifies the Supabase access token (an asymmetric JWT) against the project's **JWKS** and provisions a local profile the first time it sees a user. It never issues tokens or stores passwords.

## Tech stack

- **FastAPI** — HTTP layer
- **SQLAlchemy 2.0** (async) with **asyncpg** — ORM and driver
- **Alembic** — database migrations
- **Pydantic v2 / pydantic-settings** — schemas and configuration
- **PyJWT** with **cryptography** — verifying Supabase access tokens (RS256/ES256)
- **uv** — dependency management
- **ruff** — linting and formatting

## Project structure

```
backend/
├── app/
│   ├── auth/
│   │   ├── verifier.py        # Verify a Supabase JWT against the project's JWKS
│   │   └── dependencies.py    # Bearer token -> TokenClaims
│   ├── users/
│   │   ├── models.py          # User (profile) ORM model
│   │   ├── schemas.py         # UserRead / UserUpdate
│   │   ├── service.py         # Just-in-time profile provisioning
│   │   ├── dependencies.py    # TokenClaims -> local User
│   │   └── router.py          # /users endpoints (read, update, delete me)
│   ├── organizations/
│   │   ├── models.py          # Organization + Membership (the tenant model)
│   │   ├── schemas.py         # OrganizationRead / MembershipRead
│   │   ├── service.py         # Create with an owner, list, resolve memberships
│   │   ├── dependencies.py    # Path organization -> the caller's membership
│   │   └── router.py          # /organizations endpoints
│   ├── health/
│   │   └── router.py          # /health liveness + /health/ready readiness
│   ├── middleware/
│   │   └── request_id.py      # Request id + structured access log
│   ├── db/
│   │   ├── session.py         # Async engine + session factory
│   │   └── models.py          # Declarative Base and BaseModel (id, timestamps)
│   ├── api.py                 # Versioned API entrypoint (mounts /v1)
│   ├── settings.py            # Settings loaded from .env
│   ├── logging_config.py      # structlog setup (dev text / prod JSON)
│   ├── pagination.py          # Offset pagination + sorting for list endpoints
│   └── main.py                # FastAPI app, routers, CORS
├── alembic/                   # Migrations (async env.py)
├── alembic.ini
├── start-database.sh          # Starts a local PostgreSQL container
├── pyproject.toml
└── .python-version            # 3.14
```

## Requirements

- Python **3.14+**
- [uv](https://docs.astral.sh/uv/)
- Docker or Podman (for the local database), or a PostgreSQL server you can point `DATABASE_URL` at
- A **Supabase project** (see the [frontend README](../frontend/README.md) for the auth setup)

## Setup

```bash
cd backend

# Install dependencies into .venv
uv sync

# Create your environment file
cp .env.example .env

# Start PostgreSQL
./start-database.sh

# Apply migrations
uv run alembic upgrade head
```

`start-database.sh` reads `DATABASE_URL` from `.env`, extracts the database name, port, and password, and runs a matching `postgres` container. If the password is still the default `password`, it offers to generate a random one and updates `.env` for you.

## Environment variables

Create `backend/.env`:

```dotenv
# DATABASE
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/app

# Supabase project URL (the issuer and JWKS are derived from it)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated

# Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL=INFO

# Environment: production (default) or development (enables SQL echo)
ENV=development

# Comma-separated browser origins allowed to call the API (CORS)
CORS_ORIGINS=http://localhost:3000
```

| Variable                | Required | Default                 | Description                                                          |
| ----------------------- | -------- | ----------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`          | Yes      | –                       | Async connection string. Must use the `postgresql+asyncpg://` driver. |
| `SUPABASE_URL`          | Yes      | –                       | Supabase project URL. The issuer (`<url>/auth/v1`) and JWKS (`<url>/auth/v1/.well-known/jwks.json`) are derived from it. |
| `SUPABASE_JWT_AUDIENCE` | No       | `authenticated`         | Audience claim the access tokens carry.                              |
| `ENV`                   | No       | `production`            | `development` enables SQL echo and text logs.                        |
| `LOG_LEVEL`             | No       | `INFO`                  | Minimum level for the application logs.                              |
| `FRONTEND_URL`          | No       | `http://localhost:3000` | Base URL of the frontend, used for redirects and documentation.      |
| `CORS_ORIGINS`          | No       | `http://localhost:3000` | Comma-separated browser origins allowed to call the API.             |

Settings are defined in `app/settings.py` and loaded from `backend/.env`.

## Running the server

```bash
# Development (auto-reload) — http://localhost:8000
uv run fastapi dev

# Production
uv run fastapi run
```

The OpenAPI docs are at `/docs`, and the raw schema at `/openapi.json`.

## Logging

Logging is [structlog](https://www.structlog.org/) on top of the standard library, configured in `app/logging_config.py`:

- **Development** (`ENV=development`) renders human-readable lines; **production** renders one JSON object per line, ready for any log aggregator.
- Uvicorn's own logs go through the same pipeline, so the process emits a single format.
- Every request gets a **`request_id`** — reused from an inbound `X-Request-ID` header or generated — attached to all its log lines and echoed back in the `X-Request-ID` response header. Authenticated requests also carry `user_id`.

Verbosity is controlled with `LOG_LEVEL` (default `INFO`).

## Health checks

Two unauthenticated probes, for orchestrators, load balancers and uptime monitors:

- `GET /health` — **liveness**: the process is running. It checks nothing external on purpose, so a failure means "restart the container".
- `GET /health/ready` — **readiness**: runs `SELECT 1` against the database and returns `503` when it is unreachable, so traffic is routed away without restarting the process.

On **Render** or **Railway**, set the health check path to `/health`. An external monitor can point at the same path for alerts. In local development, `docker-compose.yml` probes `/health` and the frontend waits for the backend to be healthy.

## Linting and formatting

The project uses [ruff](https://docs.astral.sh/ruff/) for both linting and formatting, configured in `pyproject.toml`.

```bash
# Lint
uv run ruff check .

# Lint and auto-fix
uv run ruff check --fix .

# Format
uv run ruff format .
```

## Tests

The suite has two layers, split by directory:

- **Integration tests** (`tests/integration/`) exercise the API **through its HTTP interface** against a real PostgreSQL database, using `httpx`'s ASGI transport. They forge Supabase-style access tokens with a local RSA key (`tests/auth_stub.py`), so no Supabase project is needed and the real signature, issuer, audience and expiry checks still run.
- **Unit tests** (`tests/unit/`) cover single functions in isolation, with no database (token verification edge cases).

Run everything:

```bash
uv run pytest
```

Run one layer:

```bash
uv run pytest tests/unit          # no database required
uv run pytest tests/integration   # needs the test database
```

### Test database

The integration tests use a dedicated PostgreSQL database. Create it once, next to your development one:

```bash
# the container name is "<db_name>-postgres" (see start-database.sh)
docker exec <db_name>-postgres createdb -U postgres app_test
```

By default they connect to `app_test` on the same host as `DATABASE_URL`; set `TEST_DATABASE_URL` to point somewhere else. Each test creates the tables before it runs and drops them afterwards, so it never touches your development data.

## Database migrations

Alembic is configured for async migrations (`alembic/env.py`) and imports the models so autogenerate can detect changes.

```bash
# Generate a migration after changing a model
uv run alembic revision --autogenerate -m "describe change"

# Apply all pending migrations
uv run alembic upgrade head

# Roll back one migration
uv run alembic downgrade -1
```

When you add a new model, import it in `alembic/env.py` so it is included in autogenerate.

## API reference

Protected endpoints require an `Authorization: Bearer <supabase_access_token>` header.

| Method | Path                             | Auth | Description                                             |
| ------ | -------------------------------- | :--: | ------------------------------------------------------- |
| GET    | `/health`                        |      | Liveness: the process is up (no external checks)        |
| GET    | `/health/ready`                  |      | Readiness: the database is reachable (`503` if not)     |
| GET    | `/v1/users/me`                   |  ✓   | Return the current profile (provisions it on first use) |
| PATCH  | `/v1/users/me`                   |  ✓   | Update the profile name                                 |
| DELETE | `/v1/users/me`                   |  ✓   | Delete the profile (hard delete)                        |
| POST   | `/v1/organizations`              |  ✓   | Create an organization; the caller becomes its owner    |
| GET    | `/v1/organizations`              |  ✓   | List the organizations the caller belongs to            |
| GET    | `/v1/organizations/{id}`         |  ✓   | Read one organization the caller belongs to             |
| GET    | `/v1/organizations/{id}/members` |  ✓   | List the members of an organization                     |

The application API is versioned under `/v1` (`app/api.py`); the health checks
stay unversioned so a future `/v2` never breaks orchestrators.

### Request / response examples

**PATCH `/v1/users/me`** — the name is domain data owned by this service; the email lives in Supabase and is changed from the client.

```json
{ "full_name": "Jane Smith" }
```

### Pagination and sorting

List endpoints paginate with **offset** and sort through a **per-endpoint
allowlist**. The reusable pieces live in `app/pagination.py`.

| Parameter | Default          | Bounds | Meaning                                              |
| --------- | ---------------- | ------ | ---------------------------------------------------- |
| `limit`   | `20`             | 1–100  | Page size                                            |
| `offset`  | `0`              | ≥ 0    | Rows to skip                                         |
| `sort`    | endpoint default | –      | Comma-separated fields; a leading `-` means descending |

Responses use the `OffsetPage` envelope:

```json
{ "items": [ ... ], "total": 137, "limit": 20, "offset": 40 }
```

`total` counts every row matching the filters (ignoring pagination) so a client
can render "page X of Y"; it costs an extra `COUNT` query. Example:
`GET /v1/organizations?limit=20&offset=40&sort=-created_at`.

Implementation notes:

- Resolve `sort` against a per-endpoint allowlist and pass the result to
  `select(...).order_by(...)`. Never build `ORDER BY` from raw client input.
- A list endpoint receives its parameters as one model:
  `Annotated[ListParams, Query()]`. FastAPI expands a single model into query
  parameters but only handles one per endpoint, so `ListParams` combines
  `PaginationParams` and `SortParams`. Unknown parameters are rejected, so a typo
  is a `422` instead of a silently ignored filter.
- `SortParams.order_by(...)` always appends a unique tiebreaker (`id`), so the
  order is total and rows cannot repeat or vanish between pages.
- Filter rows the endpoint owns with typed query parameters, and keep
  soft-deleted rows out with `deleted_at IS NULL`.
- Text search: `ILIKE '%term%'` is fine for small tables; move to a `pg_trgm`
  or full-text index when it matters.

#### Keyset (cursor) pagination

Offset is the default, but it has two weaknesses: it is unstable under
concurrent writes (rows can repeat or be skipped) and `OFFSET` degrades with
depth. For **large or high-churn collections** — infinite scroll, activity
feeds, a native app — use keyset instead:

- Sort by a **unique, ordered** key: `created_at` plus the `id` tiebreaker, or a
  time-ordered UUID (v7) as the key on its own.
- Accept an opaque `cursor` (base64 of the last row's sort values) instead of
  `offset`, and return `{ "items": [ ... ], "next_cursor": "..." | null }`.
- Compare with a row expression: `WHERE (created_at, id) < (:last_created_at, :last_id)`.
- Fetch `limit + 1` rows to know whether a next page exists.
- The cursor is tied to the sort: reject it if the `sort` changed.

Keyset cannot return `total` or jump to page N; that is the price of being
stable and fast at any depth. Pick **one mode per endpoint**, never both.

## Organizations and tenancy

An **organization** is the tenant: every domain row you add belongs to exactly
one, and a **membership** grants a user a role (`owner` or `member`) inside it.
Authorization resolves permissions through memberships, never through the user,
so adding a resource means adding an `organization_id` and filtering by the
caller's membership.

Rules these endpoints follow:

- **The tenant comes from the token, never from the request.** A caller's
  organizations are resolved from their memberships, so no request can ask for a
  tenant the caller does not belong to.
- **A non-member gets a 404, not a 403.** A 403 would confirm that the
  organization exists, which leaks the tenant map to anyone who can guess an id.
  `app/organizations/dependencies.py` is the single place that rule lives.
- **Roles are validated in the database too** (`ck_memberships_role_valid`), so a
  manual query cannot introduce a role the authorization layer does not know.

Creating an organization writes the organization and its owner membership in one
transaction: an organization nobody belongs to would be unreachable, because
every read is gated on a membership.

Two things to decide when you adapt this:

- Deleting a profile cascades to its memberships, but an organization whose last
  owner is deleted is left with no members. Decide what your product does: block
  deletion for sole owners, transfer ownership, or delete the tenant.
- Organizations have no UI yet; they are managed through the API.

## Authentication notes

- **Supabase Auth owns the user lifecycle**: signup, email verification, password reset, social login and sessions. This service stores no passwords and issues no tokens.
- Access tokens are **asymmetric JWTs** (RS256 by default, ES256 also accepted). `app/auth/verifier.py` validates the signature against the project's **JWKS**, plus the `iss`, `aud` and `exp` claims, so tokens from another project — or expired ones — are rejected.
- **Just-in-time provisioning**: the first time a valid token is seen, `app/users/service.py` creates the local profile keyed by `supabase_user_id` (the token's `sub`, a stable UUID). Later requests keep the mirrored email in sync. Concurrent first requests are safe: the insert is `ON CONFLICT DO NOTHING` on `supabase_user_id`, so a race never surfaces as a 500. The profile's own `id` is what you should use for relations.
- **Deleting an account** is a hard delete of the local profile (`DELETE /v1/users/me`). The Supabase identity is removed separately by the frontend, through the admin API. Since the row is gone — and `email` is not unique — the same address can sign up again.
- `app/auth/dependencies.py` resolves the bearer token into `TokenClaims`; `app/users/dependencies.py` resolves those claims into a local `User`. Inactive or unverified checks are handled by Supabase at authentication time, not here.

## Conventions

- Imports are **absolute** and rooted at the `app` package (`from app.users.service import ...`). Avoid relative imports so the dependency direction stays easy to read.
- Every directory is a regular package with an empty `__init__.py`. Nothing is re-exported there on purpose, so import cycles remain visible instead of being hidden behind package-level imports.
- The `app` package is imported from the working directory (`backend/`). Run the CLI commands from `backend/` so `app` is on `sys.path`.

## CORS

Allowed origins come from the `CORS_ORIGINS` setting (comma-separated), read in
`app/main.py`. The default is `http://localhost:3000` for local development — set
your real frontend domain(s) before deploying.

## Notes

- `app/db/models.py` defines a shared `BaseModel` with a UUID primary key plus `created_at`, `updated_at`, and `deleted_at` columns for every table.
- The `User` model is a **profile**: `supabase_user_id` (unique, links to Supabase), `email`, `full_name`. Add your own fields and relations on top of `id`.
- `Organization` and `Membership` (`app/organizations/models.py`) are the tenant model: resources belong to an organization and roles are resolved through memberships. See "Organizations and tenancy".
- `email` is **indexed but not unique**: it mirrors a Supabase-owned value, so Supabase is the source of truth. The identity key is `supabase_user_id`.
