# Next Dynamic Revalidate

By default, time-based revalidation in nextjs behaves differently for **dynamic routes** than it does for statically generated pages.
Instead of revalidating in the background, it revalidates while the user [waits for the page to load](https://github.com/vercel/next.js/issues/53324).

This seemed at odds with [these docs](https://nextjs.org/docs/app/building-your-application/caching#time-based-revalidation), so I set out to create a workaround that behaved like I expected.
It turned out that all the pieces were there, provided by nextjs and vercel, they just needed to be assembled in a particular way.

I hope that this type of functionality might one day work out of the box in nextjs so that dynamic routes can take advantage of incredibly useful stale-while-revalidate behavior.

## Here's how it works

1. We use a [modified version of unstable_cache](./src/lib/caching/our-unstable-cache.ts) to, like normal, decide whether or not a particular cache entry is stale, but instead of immediately revalidating the data while the user waits, we make a request to /api/async-revalidate.
1. [async-revalidate](./src/pages/api/async-revalidate.ts) responds immediately, but uses waitUntil to revalidate the data cache.

This process could be simplified if either:

1. This behavior came out of the box with nextjs, or
1. waitUntil was exposed as a function which accepts a promise-returning callback and could be used in the App Router.
