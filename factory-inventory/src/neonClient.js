import { createClient } from '@neondatabase/neon-js'

// From the Neon Console:
//   VITE_NEON_DATA_API_URL  -> Data API page -> "API URL"  (…/rest/v1)
//   VITE_NEON_AUTH_URL      -> Auth page -> Configuration -> "Auth URL"
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL
const authUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!dataApiUrl || !authUrl) {
  console.error('Missing VITE_NEON_DATA_API_URL or VITE_NEON_AUTH_URL. Copy .env.example to .env and fill them in.')
}

// Default adapter (Better Auth, promise-based). Data queries use the same
// PostgREST/Supabase-style builder: client.from(...).select(), client.rpc(...).
export const client = createClient({
  auth: { url: authUrl },
  dataApi: { url: dataApiUrl },
})
