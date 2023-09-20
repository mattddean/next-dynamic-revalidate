/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */

import {
  staticGenerationAsyncStorage as _staticGenerationAsyncStorage,
  type StaticGenerationAsyncStorage,
  type StaticGenerationStore,
} from 'next/dist/client/components/static-generation-async-storage'
import type { uniqueFnKeys } from '~/lib/caching/next-cache'
import { buildBaseUrl } from '~/lib/routes'
// import { addImplicitTags } from 'next/dist/server/lib/patch-fetch'
import type { RevalidateField } from './revalidate-field'

// https://github.com/vercel/next.js/blob/2cf5d3a8aa325f8bece1094c9e566311e604e114/packages/next/src/server/web/spec-extension/unstable-cache.ts

const CACHE_ONE_YEAR = 31_536_000

type Callback = (...args: any[]) => Promise<any>

export function our_unstable_cache<T extends Callback>(
  cb: T,
  keyParts?: string[],
  options?: {
    revalidate?: number | false
    tags?: string[]
    uniqueFnId: keyof typeof uniqueFnKeys
  },
): T {
  if (!options) {
    throw new Error('our_unstable_cache is missing options parameter')
  }

  const staticGenerationAsyncStorage: StaticGenerationAsyncStorage = _staticGenerationAsyncStorage
  const store: undefined | StaticGenerationStore = staticGenerationAsyncStorage?.getStore()
  const incrementalCache: import('next/dist/server/lib/incremental-cache').IncrementalCache | undefined = (globalThis as any).__incrementalCache
  if (!incrementalCache) {
    throw new Error(`Invariant: incrementalCache missing in async-revalidate ${cb.toString()}`)
  }

  if (!incrementalCache) {
    throw new Error(`Invariant: incrementalCache missing in our_unstable_cache ${cb.toString()}`)
  }
  if (options.revalidate === 0) {
    throw new Error(`Invariant revalidate: 0 can not be passed to our_unstable_cache(), must be "false" or "> 0" ${cb.toString()}`)
  }
  if (!options.uniqueFnId) {
    throw new Error('missing uniqueFnId')
  }

  const cachedCb = async (...args: any[]) => {
    const joinedKey = `${cb.toString()}-${Array.isArray(keyParts) && keyParts.join(',')}-${JSON.stringify(args)}`

    // We override the default fetch cache handling inside of the
    // cache callback so that we only cache the specific values returned
    // from the callback instead of also caching any fetches done inside
    // of the callback as well
    return staticGenerationAsyncStorage.run(
      {
        ...store,
        // use force-no-store instead of only-no-store to avoid throwing an error when a third party
        // library sets the cache to something else
        fetchCache: 'force-no-store',
        isStaticGeneration: !!store?.isStaticGeneration,
        pathname: store?.pathname || '/',
      },
      async () => {
        const cacheKey = await incrementalCache?.fetchCacheKey(joinedKey)
        const cacheEntry =
          cacheKey &&
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
          !(store?.isOnDemandRevalidate || incrementalCache!.isOnDemandRevalidate) &&
          (await incrementalCache?.get(cacheKey, true, options.revalidate))

        const tags = options.tags || []

        if (Array.isArray(tags) && store) {
          if (!store.tags) {
            store.tags = []
          }
          for (const tag of tags) {
            if (!store.tags.includes(tag)) {
              store.tags.push(tag)
            }
          }
        }

        // don't add tags from route pate; we want complete control over the tags, and we want to
        // be able to cache across routes

        // const implicitTags = addImplicitTags(store)

        // for (const tag of implicitTags) {
        //   if (!tags.includes(tag)) {
        //     tags.push(tag)
        //   }
        // }

        const invokeCallback = async () => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const result = await cb(...args)

          if (cacheKey && incrementalCache) {
            await incrementalCache.set(
              cacheKey,
              {
                kind: 'FETCH',
                data: {
                  headers: {},
                  // TODO: handle non-JSON values?
                  body: JSON.stringify(result),
                  status: 200,
                  tags,
                  url: '',
                },
                revalidate: typeof options.revalidate !== 'number' ? CACHE_ONE_YEAR : options.revalidate,
              },
              options.revalidate,
              true,
            )
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return result
        }

        /**
         * Make a request to /api/async-revalidate, which will return immediately but begin
         * refetching and updating the data on this cache key in the background
         */
        const requestAsyncRevalidation = async () => {
          // const label = `requesting async revalidation for ${options.uniqueFnId} on key ${cacheKey}`
          // prodConsole.time(label)

          const field: RevalidateField = {
            args,
            cacheKey,
            revalidate: options.revalidate,
            tags,
            uniqueFnId: options.uniqueFnId,
          }
          const baseUrl = buildBaseUrl()
          await fetch(`${baseUrl}/api/async-revalidate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(field),
            cache: 'no-store',
          })

          // prodConsole.timeEnd(label)
        }

        if (!cacheEntry || !cacheEntry.value) {
          console.warn(`Making user wait for ${options.uniqueFnId} because no cache entry at ${cacheKey}, args: ${args}`)
          return invokeCallback()
        }

        if (cacheEntry.value.kind !== 'FETCH') {
          console.warn(`Making user wait for ${options.uniqueFnId} because invalid cacheEntry at ${cacheKey}, args: ${args}`)
          return invokeCallback()
        }
        let cachedValue: any
        const isStale = cacheEntry.isStale

        if (cacheEntry) {
          const resData = cacheEntry.value.data
          // JSON.stringify(undefined) is undefined, but JSON.parse(undefined) throws an error
          cachedValue = resData.body ? JSON.parse(resData.body) : undefined
        }
        const currentTags = cacheEntry.value.data.tags

        if (isStale) {
          if (!store) {
            console.error('our_unstable_cache has no store')
            return invokeCallback()
          } else {
            // console.debug(`pushing key ${cacheKey} into pendingRevalidates for ${options.uniqueFnId}`)
            if (!store.pendingRevalidates) {
              store.pendingRevalidates = []
            }
            // making api requests to /api/async-revalidate is fast, but not instant, so we parallelize them
            store.pendingRevalidates.push(
              requestAsyncRevalidation()
                .then(() => {
                  // console.debug(`finished requesting async revalidation for ${cacheKey} on ${options.uniqueFnId}`)
                })
                .catch((err) => console.error(`failed requesting async revalidation for key: ${cacheKey} on ${options.uniqueFnId}`, err)),
            )
          }
        } else if (tags && !tags.every((tag) => currentTags?.includes(tag))) {
          if (!cacheEntry.value.data.tags) {
            cacheEntry.value.data.tags = []
          }

          for (const tag of tags) {
            if (!cacheEntry.value.data.tags.includes(tag)) {
              cacheEntry.value.data.tags.push(tag)
            }
          }
          // this was previously not awaited, not sure why
          await incrementalCache?.set(cacheKey, cacheEntry.value, options.revalidate, true)
          // console.debug(`synchronously setting incremental cache for ${cacheKey} on ${options.uniqueFnId}`)
        }
        // console.debug('returning cached value for %s on key', options.uniqueFnId, cacheKey)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return cachedValue
      },
    )
  }
  // TODO: once AsyncLocalStorage.run() returns the correct types this override will no longer be necessary
  return cachedCb as unknown as T
}
