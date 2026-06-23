import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// DEMO=1 builds the static, backend-less demo for GitHub Pages (served from a
// /rolodex subpath). The normal build uses adapter-node for the real deployment.
const DEMO = process.env.DEMO === '1';
const base = process.env.BASE_PATH ?? (DEMO ? '/rolodex' : '');

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: DEMO
      ? adapterStatic({ fallback: 'index.html', precompress: false, strict: false })
      : adapterNode(),
    paths: { base },
  },
};

export default config;
