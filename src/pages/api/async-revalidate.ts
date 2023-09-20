import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { uniqueFnKeys } from '~/lib/caching/next-cache'
import type { RevalidateField } from '~/lib/caching/revalidate-field'

const CACHE_ONE_YEAR = 31_536_000

export const config = {
  runtime: 'edge',
  unstable_allowDynamic: [
    '**/.pnpm/**/node_modules/gqty/Utils/cycle.mjs',
    '**/.pnpm/**/node_modules/@gqty/utils/cycle.mjs',
    '**/.pnpm/**/node_modules/@gqty/utils/mergeWith.mjs',
  ],
}

// https://github.com/vercel/next.js/blob/fa88095f4402357c9cdaf797d25f2b40e02d9d22/packages/next/src/server/web/spec-extension/unstable-cache.ts#L86
const invokeCallback = async (options: RevalidateField) => {
  const cb = uniqueFnKeys[options.uniqueFnId]
  const { args, cacheKey } = options

  const incrementalCache: import('next/dist/server/lib/incremental-cache').IncrementalCache | undefined = (globalThis as any).__incrementalCache
  if (!incrementalCache) {
    throw new Error(`Invariant: incrementalCache missing in async-revalidate ${cb.toString()}`)
  }

  // console.debug('async-revalidate: performing async revalidation for', options.uniqueFnId)

  // @ts-expect-error TODO: fix
  const result = await cb(...args)

  // console.debug('async-revalidate: finished calling callback for', options.uniqueFnId)

  if (options.cacheKey && incrementalCache) {
    await incrementalCache.set(
      cacheKey,
      {
        kind: 'FETCH',
        data: {
          headers: {},
          // TODO: handle non-JSON values?
          body: JSON.stringify(result),
          status: 200,
          tags: options.tags,
          url: '',
        },
        revalidate: typeof options.revalidate !== 'number' ? CACHE_ONE_YEAR : options.revalidate,
      },
      options.revalidate,
      true,
    )
    console.debug('async-revalidate: finished setting cache for %s on key %s, args:', options.uniqueFnId, cacheKey, args)
  }

  return result
}

/**
 * This route is necessary because waitUntil is not supported in the app router yet.
 * https://github.com/vercel/next.js/issues/50522
 */
export default async function handler(request: NextRequest, context: NextFetchEvent) {
  const options = (await request.json()) as RevalidateField

  // this will cause the edge function to exist until invokeCallback has completed, but won't
  // wait until invokeCallback has completed to return a response
  context.waitUntil(invokeCallback(options)) // TODO: cache and console error?

  return NextResponse.json({
    name: `Hello, from ${request.url} I'm an Edge Function!`,
  })
}
