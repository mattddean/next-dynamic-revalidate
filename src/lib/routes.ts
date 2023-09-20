import { env } from '~/env.cjs'

export function buildBaseUrl() {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3004'
  if (env.NEXT_PUBLIC_SITE_URL) return 'https://' + env.NEXT_PUBLIC_SITE_URL // we have set NEXT_PUBLIC_SITE_URL only set in vercel's production environment
  return 'https://' + env.NEXT_PUBLIC_VERCEL_URL // in vercel preview environments, the preview url specific to this deployment
}
