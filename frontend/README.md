# Frontend — Next.js

The web client for the [Next.js + FastAPI Starter](../README.md). It renders the UI, validates forms, and authenticates users with **Supabase Auth** through `@supabase/ssr`. The session lives in cookies managed by the Next.js server; domain data is read from the FastAPI backend.

## Tech stack

- **Next.js 16** (App Router) and **React 19**
- **TypeScript**
- **Tailwind CSS 4** with **shadcn/ui** components (base-nova style, Lucide icons)
- **React Hook Form** + **Zod** for forms and validation
- **next-safe-action** for type-safe server actions
- **@supabase/ssr** + **@supabase/supabase-js** for authentication
- **@t3-oss/env-nextjs** for environment variable validation
- **Motion** for animations
- **pnpm** as the package manager

## Project structure

```
frontend/
├── app/
│   ├── (root)/            # Public shell: home page + header layout
│   ├── auth/              # login, signup, forgot-password, reset-password, verify-email
│   │   └── confirm/       # Route handler for email links and the OAuth callback
│   ├── profile/           # Protected profile page
│   ├── layout.tsx         # Root layout (fonts, Toaster)
│   └── globals.css        # Tailwind + theme tokens
├── components/
│   ├── auth/              # Auth, profile, change-password and verification components
│   ├── ui/                # shadcn/ui primitives
│   └── ...                # Header, avatar menu, sidebar, background
├── server/
│   ├── auth/              # Session helper, server actions, schemas
│   └── users/             # Profile + password server actions and schemas
├── lib/
│   ├── env.js             # Validated env vars
│   ├── auth-providers.ts  # Which login methods are enabled
│   ├── supabase/server.ts # Supabase server client (cookies)
│   ├── safe-action.ts     # Public / protected action clients
│   └── utils.ts           # cn() helper
├── proxy.ts               # Refreshes the Supabase session on every request
├── __tests__/             # Unit tests (Vitest), mirroring the source tree
├── vitest.config.mts      # Vitest configuration
└── package.json
```

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/)
- A **Supabase project** (see below)
- The backend running (see `../backend/README.md`)

## Setup

```bash
pnpm install
```

Copy the example environment file and fill in your Supabase project URL and anon key:

```bash
cp .env.example .env
```

Then start the dev server:

```bash
pnpm dev
```

Open http://localhost:3000. Both Supabase and the backend must be reachable for auth and profile data to work.

## Environment variables

| Variable                        | Required | Description                                                          |
| ------------------------------- | -------- | -------------------------------------------------------------------- |
| `BACKEND_URL`                   | Yes      | Base URL of the FastAPI backend.                                     |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL (Project Settings > API).                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anon (publishable) key.                                     |
| `NEXT_PUBLIC_AUTH_PROVIDERS`    | No       | Enabled login methods, comma-separated: `email,google`. Default `email`. |
| `NODE_ENV`                      | No       | Set automatically by Next.js.                                        |

Variables are validated with `@t3-oss/env-nextjs` in `lib/env.js`. Set `SKIP_ENV_VALIDATION=1` to bypass validation (useful for Docker builds).

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication > Providers**: enable **Email** (and **Google** if you want social login). Google needs a Client ID/Secret from Google Cloud, pasted into Supabase.
3. **Authentication > URL Configuration**: set the **Site URL** and add redirect URLs for your environments, e.g. `http://localhost:3000/auth/confirm` (and the production equivalent). The `emailRedirectTo` / `redirectTo` values used by the actions must be allow-listed here.
4. Copy the project URL and anon key into `frontend/.env`.

### Toggling login methods

Supabase is the source of truth: a provider only works if it is enabled in the dashboard. On top of that, `NEXT_PUBLIC_AUTH_PROVIDERS` controls which options the UI renders. The template ships with **`email` only**; add `google` to enable the social button.

## How it works

- **Session** — `@supabase/ssr` stores the Supabase session in cookies. `proxy.ts` refreshes it on every request, so Server Components always see a valid token. `server/auth/auth.lib.ts` (`getSession()`, memoised with React `cache()`) validates the user with Supabase and fetches the profile from the backend, returning `{ session, user }` or `null`.
- **Server actions** — `server/auth/auth.actions.ts` and `server/users/users.actions.ts` call Supabase (`signUp`, `signInWithPassword`, `signOut`, `signInWithOAuth`, `resetPasswordForEmail`, `updateUser`, `resend`) and the backend. Client components invoke them through `next-safe-action`.
- **Auth flows** — `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` and `/auth/verify-email`. Supabase sends the emails; `app/auth/confirm/route.ts` handles the links (email confirmation, password recovery) and the OAuth callback, exchanges the credential for a session and redirects.
- **Protected actions** — `protectedProcedure` in `lib/safe-action.ts` requires a valid session and exposes the token and user to the action. The token is forwarded to the backend in the `Authorization` header.
- **Guards** — `app/auth/layout.tsx` redirects authenticated users away from the auth pages, while `app/profile/page.tsx` redirects unauthenticated users to `/auth/login`. The root layout shows a resend-verification banner while the email is unverified.

## Scripts

| Command         | Description                |
| --------------- | -------------------------- |
| `pnpm dev`      | Start the dev server       |
| `pnpm build`    | Production build           |
| `pnpm start`    | Serve the production build |
| `pnpm lint`     | Run ESLint                 |
| `pnpm test`     | Run unit tests (watch)     |
| `pnpm test:run` | Run unit tests once        |

## Testing

Unit tests use **Vitest** and **React Testing Library**, configured the way the
[Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest)
recommends (see `vitest.config.mts`). Tests live in `__tests__/`, mirroring the
source tree, and import modules through the `@/` alias.

```bash
pnpm test       # watch mode
pnpm test:run   # single run (CI)
```

Scope: pure logic only — no network, no `next/headers`. Code that depends on the
session, cookies or async Server Components is left to integration/E2E tests.

## UI components

Components under `components/ui/` are generated with [shadcn/ui](https://ui.shadcn.com/) (config in `components.json`). Add more with:

```bash
pnpm dlx shadcn@latest add <component>
```

## Notes for agents

`AGENTS.md` warns that this project uses a Next.js version whose APIs may differ from older training data. Read the bundled guides under `node_modules/next/dist/docs/` before writing Next.js code.
