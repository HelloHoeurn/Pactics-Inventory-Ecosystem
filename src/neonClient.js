import { createClient } from '@neondatabase/neon-js'

const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL
const authUrl = import.meta.env.VITE_NEON_AUTH_URL

export const configError =
  !dataApiUrl || !authUrl
    ? 'Missing VITE_NEON_DATA_API_URL and/or VITE_NEON_AUTH_URL.\n\n' +
      'On Cloudflare these must be set as BUILD-TIME variables, then re-deploy.'
    : null
if (configError) console.error(configError)

export const client = configError
  ? null
  : createClient({ auth: { url: authUrl }, dataApi: { url: dataApiUrl } })
