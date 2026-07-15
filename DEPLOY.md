# Deploying to Cloudflare (Workers) + Neon

Your URL is `*.workers.dev`, so this is a **Cloudflare Worker** serving static
assets — not Cloudflare Pages. Three things must be right or you get a blank page.

## 1. Build-time env vars (the #1 blank-page cause)
Vite inlines `VITE_*` variables **at build time**. They must be set where the
build runs — NOT as runtime Worker variables.

- Local build:  put them in `.env` (see `.env.example`), then `npm run build`.
- Cloudflare git build (Workers Builds): set them under
  **Settings → Build → Variables & Secrets** (build environment), then redeploy.
  Setting them under the Worker's *runtime* "Variables" does nothing for a static
  Vite build.

Required:
```
VITE_NEON_DATA_API_URL=https://ep-....apirest....neon.tech/neondb/rest/v1
VITE_NEON_AUTH_URL=https://ep-....neonauth....neon.tech/neondb/auth
```

## 2. SPA asset serving
`wrangler.jsonc` (included) points the Worker at `./dist` with
`not_found_handling: "single-page-application"`. Deploy with:
```
npm install
npm run build
npx wrangler deploy
```
(If you deploy through the Cloudflare dashboard's git integration instead, set
Build command = `npm run build`, and the assets/output directory = `dist`.)

## 3. Neon CORS
Once the page loads, the browser calls Neon directly. In the Neon Console →
**Data API → Settings**, add your origins to the allowed list:
```
http://localhost:5173
https://pactics-inventory-ecosystem.hoeurnhello.workers.dev
```
Without this, the page renders but data calls fail.

## Diagnosing a blank page
This build now fails LOUD, not blank: a missing config or a runtime error paints
a red message into the page (and logs to the console). If you still see white,
open DevTools (F12) → Console and read the first red line.

> Alternative: Cloudflare **Pages** (a `*.pages.dev` deploy) is simpler for a
> pure SPA — the included `public/_redirects` handles routing there and you skip
> `wrangler.jsonc`. Either works; just don't mix them up.
