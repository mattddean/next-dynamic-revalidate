// @ts-check

import { env } from './src/env.cjs'

// Simple access to make sure TypeScript doesn't strip out our env import when compiling
env.NEXT_PUBLIC_SITE_URL

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
}

export default config
