# Pactics Factory Inventory (Neon edition)

React (Vite) + **Neon** (Serverless Postgres · Data API · Neon Auth), deployable
on Cloudflare Pages. Bilingual EN / ខ្មែរ. Modules: Dashboard, Registry Lookup,
Add Asset/Part, Draw Requests, QR-scan simulation, CSV export, stock chart.

Migrated from Supabase: the data layer is unchanged (`@neondatabase/neon-js`
speaks the same PostgREST/Supabase-style API — `.from().select()`, `.rpc()`),
and auth now uses Neon Auth.

---

## 1. Neon setup

1. Create a project at https://neon.com (Free plan is fine — up to 100 projects).
2. **Data API** page → enable the Data API, check **Use Neon Auth** and
   **Grant public schema access**.
3. **SQL Editor** → paste [`neon/schema.sql`](neon/schema.sql) and **Run**.
   Creates the tables, the `draw_part` / `adjust_stock` functions, RLS policies,
   role grants, and seed data. It's idempotent, so re-running is safe.
4. **Data API** page → **Refresh schema cache** (so `/rpc/draw_part` etc. appear).
5. Copy your two URLs:
   - **Data API URL** (Data API page) → `VITE_NEON_DATA_API_URL`
   - **Auth URL** (Auth page → Configuration) → `VITE_NEON_AUTH_URL`

> The first user: launch the app and use **"Create account"** on the login
> screen (calls Neon Auth `signUp`). If sign-in is blocked by email
> verification, either verify the email or turn verification off in the Neon
> Auth settings while testing.

## 2. Run locally

```bash
cp .env.example .env      # fill in the two VITE_NEON_* values
npm install
npm run dev               # http://localhost:5173
```

## 3. Deploy to Cloudflare Pages

Same as any Vite SPA:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables** (Production + Preview): `VITE_NEON_DATA_API_URL`,
  `VITE_NEON_AUTH_URL`
- `public/_redirects` (`/* /index.html 200`) is included for SPA routing.

Git integration, or `wrangler pages deploy dist`. Vite inlines `VITE_*` at build
time, so re-deploy after changing them in Cloudflare.

> **CORS:** in the Neon **Data API → Settings**, add your Cloudflare Pages origin
> (e.g. `https://your-app.pages.dev`) and `http://localhost:5173` to the allowed
> origins so the browser can call the API.

## 4. Project structure

```
neon/schema.sql            SQL: roles, tables, RPCs, RLS, grants, seed
src/neonClient.js          Neon client (Data API + Neon Auth)
src/i18n.js                EN/KH dictionary
src/App.jsx                auth gate, data loading, nav, QR sim
src/components/            Dashboard, Registry, AddItem, DrawRequests, Login
src/lib/csv.js             CSV export (UTF-8 BOM for Khmer)
public/_redirects          Cloudflare SPA fallback
```

## Notes

- The Data API is currently in beta.
- RLS here is "any signed-in user can read/write" — right for an internal tool.
  Add `auth.user_id()`-based policies if you ever need per-user isolation.
- Khmer strings in `src/i18n.js` should be reviewed by a native speaker.
