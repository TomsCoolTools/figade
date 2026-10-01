// Local dev server: builds the site (and rebuilds on changes), serves dist/,
// runs the Worker for /api/* against a local SQLite database, and stands in
// for Lemon Squeezy at /mock-ls/* so the whole purchase flow works offline.
//
//   npm run dev                       http://localhost:8787
//   node scripts/dev.js --port 9000 --no-watch --fresh

import fs from 'node:fs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import config from '../store.config.js';
import { handle, SCHEMA } from '../worker/handler.js';
import { createD1 } from '../worker/d1-node.js';
import { createMockLemon } from '../worker/mock-lemonsqueezy.js';
import { jsOptions, eleventy, copyHarness } from './build.js';
import { devKeys } from './keys.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, process.env.STORE_OUT || 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(url, res) {
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) return false;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    const notFound = path.join(dist, '404.html');
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
    return true;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(file));
  return true;
}

export async function startDevServer({ port = 8787, watch = true, fresh = false, quiet = false, dataDir = '.dev' } = {}) {
  const log = quiet ? () => {} : console.log;
  const data = path.resolve(root, dataDir);
  fs.mkdirSync(data, { recursive: true });
  const dbFile = path.join(data, 'db.sqlite');
  const lsFile = path.join(data, 'mock-ls.json');
  if (fresh) for (const f of [dbFile, lsFile]) fs.rmSync(f, { force: true });

  // Build
  fs.rmSync(dist, { recursive: true, force: true });
  const js = await esbuild.context(await jsOptions({ dev: true }));
  await js.rebuild();
  const elev = eleventy({ dev: true });
  await elev.write();
  copyHarness();
  if (watch) {
    await js.watch();
    // Pages are rebuilt in a fresh process so edits to designs, packs and the
    // config (which the page templates import) are picked up.
    let timer;
    const rebuildPages = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const r = spawnSync(process.execPath, ['scripts/build.js', '--dev', '--pages-only'], { cwd: root, env: process.env, encoding: 'utf8' });
        log(r.status === 0 ? 'Pages rebuilt' : `Page build failed:\n${r.stderr}`);
      }, 150);
    };
    for (const p of ['site', 'designs', 'packs', 'engine', 'catalogue.js', 'store.config.js']) {
      fs.watch(path.join(root, p), { recursive: true }, rebuildPages);
    }
    log('Watching for changes…');
  }

  // Worker environment
  const DB = createD1(dbFile);
  await DB.exec(SCHEMA);
  const keys = await devKeys(root);
  const env = {
    DB,
    LS_WEBHOOK_SECRET: 'dev-webhook-secret',
    UNLOCK_PRIVATE_KEY: JSON.stringify(keys.privateJwk),
    LS_API_BASE: `http://localhost:${port}/mock-ls`,
  };
  const deliverWebhook = async (body, signature) => {
    const r = await handle(new Request(`http://localhost:${port}/api/webhook`, { method: 'POST', headers: { 'x-signature': signature }, body }), env);
    if (!r.ok) throw new Error(`Webhook rejected: ${r.status}`);
  };
  const mock = createMockLemon({ config, secret: env.LS_WEBHOOK_SECRET, deliverWebhook, stateFile: lsFile });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    try {
      if (url.pathname.startsWith('/mock-ls/')) return await mock.handle(req, res, url, raw);
      if (url.pathname.startsWith('/api/')) {
        const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw }), env);
        res.writeHead(r.status, Object.fromEntries(r.headers));
        return res.end(Buffer.from(await r.arrayBuffer()));
      }
      serveStatic(url, res);
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end('Dev server error');
    }
  });
  await new Promise((r) => server.listen(port, r));
  log(`Store running at http://localhost:${port}  (test checkout, no real payments)`);
  return {
    url: `http://localhost:${port}`,
    mock,
    env,
    async close() {
      server.close();
      await js.dispose();
    },
  };
}

// Run directly (not imported)? pathToFileURL makes this work on Windows paths too.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name, d) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : d;
  };
  await startDevServer({
    port: Number(arg('--port', 8787)),
    watch: !process.argv.includes('--no-watch'),
    fresh: process.argv.includes('--fresh'),
    dataDir: arg('--data', '.dev'),
  });
}
