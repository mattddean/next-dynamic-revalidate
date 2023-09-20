import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { env } from '~/env.cjs'
import { fetchPage } from '~/app/_supporting/data'
import { our_unstable_cache } from './our-unstable-cache'

export const uniqueFnKeys = {
  '/page:fetchPage': fetchPage,
}

export const DEFAULT_REVALIDATE = 60

type Primitive = string | number | boolean
type PrimitiveObj = Record<string, Primitive>
type Args = (Primitive | string[] | number[] | boolean[] | PrimitiveObj)[]

function stringifyArg(arg: Args[number]) {
  if (typeof arg === 'string') return arg
  if (Array.isArray(arg)) return arg.join(',')
  if (typeof arg === 'object') return JSON.stringify(arg)
  if (typeof arg === 'boolean') return arg ? 'true' : 'false'
  if (typeof arg === 'number') return `${arg}`
  throw new Error('Invalid arg type passed to stringifyArg')
}

export type RevalidateKvField = {
  uniqueFnId: keyof typeof uniqueFnKeys
  tags: string[]
  revalidate: number | false
  args: Args
}

type Callback<T extends Args, U> = (...args: T) => U
type OurUnstableCacheCallback = Parameters<typeof our_unstable_cache>[0]
type UnstableCacheCallback = Parameters<typeof unstable_cache>[0]

type NextCacheOptions<T extends string> = {
  /** A unique identifier for this function */
  uniqueFnId: T
  /** `revalidate` option for unstable_cache (seconds). To pass `false`, call `nextCacheNoRevalidate` instead. */
  revalidate: number
}

/**
 * Cache an arbitrary function's results locally (per-request) and globally (in Vercel's Data Cache).
 *
 * Based on https://github.com/Fredkiss3/nextjs-13-react-router-contacts/blob/1080aea01cf4a4132a0ee3f47849e72c931d2d16/src/lib/server-utils.ts#L20-L28
 */
export function nextCache<T extends keyof typeof uniqueFnKeys, A extends Parameters<(typeof uniqueFnKeys)[T]> & Args>(
  options: NextCacheOptions<T>,
  ...args: A
) {
  const cb = uniqueFnKeys[options.uniqueFnId]

  const fn = cache((uniqId: string, ...cbArgs: A) => {
    // do only request-level caching in development, not global caching
    if (process.env.NODE_ENV === 'development') return (cb as OurUnstableCacheCallback)(...cbArgs)

    const stringifiedArgs = cbArgs.map(stringifyArg)
    const tags = [uniqId, ...stringifiedArgs]
    // TODO: avoid type assertion
    const cached = our_unstable_cache(cb as OurUnstableCacheCallback, tags, {
      revalidate: options.revalidate,
      tags,
      uniqueFnId: options.uniqueFnId,
    })
    return cached(...cbArgs)
  })

  return fn(options.uniqueFnId, ...args) as Promise<ReturnType<typeof cb>> // TODO: avoid type assertion
}

type NextCacheNoRevalidateOptions = {
  /** A unique identifier for this function */
  uniqueFnId: string
  /** `revalidate` option for unstable_cache. To pass a number, call `nextCache` instead. */
  revalidate: false
}

/**
 * Cache an arbitrary function's results locally (per-request) and globally (in Vercel's Data Cache).
 * Don't perform our custom async revalidation; this function never needs to be revalidated.
 */
export function nextCacheNoRevalidate<R, A extends Args>(cb: Callback<A, R>, options: NextCacheNoRevalidateOptions, ...args: A) {
  const fn = cache((uniqId: string, ...cbArgs: A) => {
    const stringifiedArgs = cbArgs.map(stringifyArg)
    const tags = [uniqId, ...stringifiedArgs]
    // TODO: avoid type assertion
    const cached = unstable_cache(cb as unknown as UnstableCacheCallback, tags, {
      revalidate: options.revalidate,
      tags,
    })
    return cached(...cbArgs)
  })

  return fn(options.uniqueFnId, ...args) as Promise<R> // TODO: avoid type assertion
}
