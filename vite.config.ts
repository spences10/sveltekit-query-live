import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite-plus';
import adapter from '@sveltejs/adapter-cloudflare';
import { playwright } from 'vite-plus/test/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter(),
			compilerOptions: {
				experimental: { async: true },
				runes: ({ filename }) =>
					filename?.split(/[/\\\\]/).includes('node_modules')
						? undefined
						: true,
			},
			experimental: { remoteFunctions: true },
		}),
	],
	fmt: {
		useTabs: true,
		singleQuote: true,
		printWidth: 70,
		trailingComma: 'all',
		proseWrap: 'always',
		svelte: true,
		sortTailwindcss: { stylesheet: './src/routes/layout.css' },
		ignorePatterns: [
			'.svelte-kit/**',
			'.wrangler/**',
			'worker-configuration.d.ts',
			'static/**',
			'pnpm-lock.yaml',
			'test-results/**',
			'playwright-report/**',
		],
	},
	lint: {
		ignorePatterns: [
			'.svelte-kit/**',
			'.wrangler/**',
			'worker-configuration.d.ts',
			'test-results/**',
			'playwright-report/**',
		],
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
		],
	},
});
