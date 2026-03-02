# Sprygram Frontend

## Stack
- Next.js App Router (TypeScript)
- TailwindCSS
- Mantine UI

## Run
1. `cd frontend`
2. `npm install`
3. `cp .env.example .env.local` (or create `.env.local`)
4. `npm run dev`

Dev URL: `http://localhost:5177`

You can also run from `d:\GitHub\sprygram` now:
1. `npm install`
2. `npm run dev`

## API Base
Set in `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_AUTH_MODE=dev
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.sprylogin.com
NEXT_PUBLIC_KEYCLOAK_REALM=sprylogin
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=spryslides-spa
NEXT_PUBLIC_APP_URL=http://localhost:5177
NEXT_PUBLIC_OIDC_REDIRECT_URI=http://localhost:5177/auth/oidc/callback
NEXT_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5177/profiles
NEXT_PUBLIC_OIDC_SCOPE=openid profile email
```

`NEXT_PUBLIC_AUTH_MODE=dev` disables forced OIDC redirect and enables local seeded login flow in `/profiles`.
When `sprygram-spa` is provisioned in SpryLogin, set `NEXT_PUBLIC_AUTH_MODE=oidc` and update client/redirect values.

## Authentication
For local development:
- Run backend seed: `npm run sprygram:seed` in `spryworkspace-backend`
- Open `/profiles`
- Use one-click seeded sign-in (Ava/Milo/Zara/Noah)

OIDC mode remains available when enabled via env.

## Pages
- `/feed`
- `/create`
- `/u/[username]`
- `/profiles`
- `/search`
- `/activity`

## Dev Notes
- If Next.js chunk/layout files 404 during rapid changes, run `npm run dev:clean` and restart `npm run dev`.
- Browser-extension logs like MetaMask connection errors are external to Sprygram and can be ignored.
