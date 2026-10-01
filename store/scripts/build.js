// Builds the site into dist/: esbuild bundles the browser code, Eleventy
// writes the pages and copies site/static.
//   node scripts/build.js            production build
//   node scripts/build.js --dev      unminified, dev keys, test harness

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { Eleventy } from '@11ty/eleventy';
import { devKeys } from './keys.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// STORE_OUT lets the test server build somewhere else while `npm run dev` runs.
const out = path.resolve(root, process.env.STORE_OUT || 'dist');

export async function publicKey(dev) {
  if (dev) return (await devKeys(root)).publicJwk;
  const file = path.join(root, 'keys', 'public-key.json');
  if (!fs.existsSync(file)) throw new Error('keys/public-key.json is missing. Run `npm run keys` first.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function jsOptions({ dev = false } = {}) {
  const entryPoints = ['storefront', 'design', 'restore'].map((n) => path.join(root, 'site/js', `${n}.js`));
  if (dev) entryPoints.push(path.join(root, 'tests/fixtures/harness.js'));
  return {
    absWorkingDir: root,
    entryPoints,
    outdir: path.join(out, 'js'),
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    target: ['chrome110', 'safari16', 'firefox115'],
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'none',
    logLevel: 'warning',
    define: {
      __UNLOCK_PUBLIC_KEY__: JSON.stringify(await publicKey(dev)),
      __DEV__: JSON.stringify(dev),
    },
  };
}

export function eleventy({ dev = false } = {}) {
  process.env.STORE_DEV = dev ? '1' : '';
  return new Eleventy(path.join(root, 'site'), out, {
    pathPrefix: '/',
    configPath: path.join(root, 'eleventy.config.js'),
    quietMode: true,
  });
}

export function copyHarness() {
  fs.mkdirSync(path.join(out, '__test'), { recursive: true });
  fs.copyFileSync(path.join(root, 'tests/fixtures/harness.html'), path.join(out, '__test/index.html'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dev = process.argv.includes('--dev');
  fs.rmSync(out, { recursive: true, force: true });
  await esbuild.build(await jsOptions({ dev }));
  await eleventy({ dev }).write();
  if (dev) copyHarness();
  console.log(`Built ${dev ? "dev" : "production"} site into ${path.relative(root, out)}/`);
}
