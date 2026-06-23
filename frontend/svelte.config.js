import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// DEMO=1 builds the static, backend-less demo for GitHub Pages (served from a
// /rolodex subpath). The normal build uses adapter-node for the real deployment.
// Each adapter is imported lazily so a production build never needs the demo-only
// adapter-static installed (and vice-versa).
const DEMO = process.env.DEMO === '1';
const base = process.env.BASE_PATH ?? (DEMO ? '/rolodex' : '');

const adapter = DEMO
  ? (await import('@sveltejs/adapter-static')).default({ fallback: 'index.html', precompress: false, strict: false })
  : (await import('@sveltejs/adapter-node')).default();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    paths: { base },
  },
};

export default config;
