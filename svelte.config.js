import adapter from '@sveltejs/adapter-cloudflare';

const runes = (options = { filename: '' }) =>
	options.filename.split(/[/\\]/).includes('node_modules')
		? undefined
		: true;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		experimental: { async: true },
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes,
	},
	kit: {
		adapter: adapter(),
		experimental: { remoteFunctions: true },
	},
};

export default config;
