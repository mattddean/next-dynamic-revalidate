import type { uniqueFnKeys } from '~/lib/caching/next-cache'

type Primitive = string | number | boolean
type PrimitiveObj = Record<string, Primitive>
type Args = (Primitive | string[] | number[] | boolean[] | PrimitiveObj)[]

export type RevalidateField = {
  uniqueFnId: keyof typeof uniqueFnKeys
  tags: string[]
  revalidate: number | false | undefined
  args: Args
  cacheKey: string
}
