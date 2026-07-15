import { createClient } from '@neondatabase/neon-js'

// From the Neon Console:
//   VITE_NEON_DATA_API_URL  -> Data API page -> "API URL"  (…/rest/v1)
//   VITE_NEON_AUTH_URL      -> Auth page -> Configuration -> "Auth URL"
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL
const authUrl = import.meta.env.VITE_NEON_AUTH_URL

// If the env vars are missing (the #1 cause of a deployed blank page), surface
// a readable message instead of throwing at import time and white-screening.
export const configError =
  !dataApiUrl || !authUrl
    ? 'Missing VITE_NEON_DATA_API_URL and/or VITE_NEON_AUTH_URL.\n\n' +
      'On Cloudflare these must be set as BUILD-TIME variables (not runtime),\n' +
      'then re-deploy so Vite can inline them into the bundle.'
    : null

if (configError) console.error(configError)

export const client = configError
  ? null
  : createClient({ auth: { url: authUrl }, dataApi: { url: dataApiUrl } })
