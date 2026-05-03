# SvelteKit `query.live` Wikimedia demo

A small SvelteKit app demonstrating experimental remote functions with
`query.live`.

The page streams Wikimedia RecentChanges from
`https://stream.wikimedia.org/v2/stream/recentchange` on the server,
converts the SSE feed into an async generator, and renders live
Wikipedia edits in the browser. It includes live/slow-mo pacing,
start/stop controls, reconnect handling, and bounded in-memory state
so the stream can run without growing the page forever.

## What it shows

- `query.live` in `src/routes/wikimedia.remote.ts`
- Remote functions enabled in `svelte.config.js`
- Top-level `await` in `src/routes/+page.svelte`
- Server-side stream cleanup via `AbortController` and reader
  cancellation
- Cloudflare Workers adapter setup

## Developing

```sh
pnpm install
pnpm dev
```

## Validation

```sh
pnpm lint
pnpm check
pnpm build
```

## Notes

Remote functions and Svelte async rendering are experimental, so this
project opts into:

```js
compilerOptions: {
	experimental: {
		async: true;
	}
}
kit: {
	experimental: {
		remoteFunctions: true;
	}
}
```

Wrangler type checks are run before check/build; the scripts clean
generated Cloudflare output first so `worker-configuration.d.ts` stays
stable.
