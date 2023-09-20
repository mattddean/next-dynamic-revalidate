// @ts-check

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { createEnv } = require('@t3-oss/env-nextjs')
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { z } = require('zod')

const env = createEnv({
  server: {},
  client: {},
  shared: {
    // e.g. "next-dynamic-revalidate.vercel.app"
    // nullish because we have set NEXT_PUBLIC_SITE_URL only set in vercel's production environment
    NEXT_PUBLIC_SITE_URL: z.string().nullish(),
    // nullish because this is not set in development
    NEXT_PUBLIC_VERCEL_URL: z.string().nullish(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  },
  skipValidation: !!process.env.GITHUB_ACTION || !!process.env.SKIP_ENV_VALIDATION,
})

module.exports = { env }
