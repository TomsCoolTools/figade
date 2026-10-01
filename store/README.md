# [SITE NAME] store

Personalised motion graphics for creators. Visitors type their details, watch
their own version play, and pay a few dollars to download it clean. Everything
renders in the visitor's browser; the only server code is a small Cloudflare
Pages Function that confirms payments and signs unlocks.

This folder is Phase 1 of [`../SPEC.md`](../SPEC.md). It lives inside the figade
repo for now and is self-contained, so it can be moved to its own repo as is.

## Try it locally

You need [Node.js](https://nodejs.org) 22 or newer.

    cd store
    npm install
    npm run dev

Open http://localhost:8787 in Chrome.

**On Windows:** install Node.js (the LTS download from nodejs.org), download
the code as a ZIP from GitHub and unzip it, open the `store` folder in File
Explorer, type `cmd` in the address bar and press Enter, then run the two
`npm` commands above in the window that opens.

The dev server runs the whole shop offline. Buying opens a **test checkout**
(no real payment) that sends the same webhooks Lemon Squeezy sends, so you can
go through buy → unlock → clean download. The test licence keys are listed at
http://localhost:8787/mock-ls/keys for trying the "Already bought?" page.

## Tests

    npm test                  # everything (needs Google Chrome and ffmpeg)
    npm run test:worker       # just the payment/unlock server tests

- `worker/test/` — webhook signatures, claims, signed tokens, activation
  limits, refunds, rate limits (Node's test runner).
- `tests/` — Playwright in Google Chrome (`npx playwright install chrome` if
  needed; the bundled Chromium has no H.264 encoder):
  - `golden.spec.js` — every design matches its approved frames. The subscribe
    design is checked against frames rendered by the original `subscribe-demo`.
  - `exports.spec.js` — each format is opened with ffprobe/ffmpeg: codec, size,
    frame rate, frame count, duration, colour range, transparency, sound.
  - `purchase.spec.js` — buying, restoring on another browser, packs, refunds.
  - `protection.spec.js` — no clean export without a valid signed unlock.
  - `site.spec.js`, `a11y.spec.js` — 360px layouts, keyboard-only purchase,
    reduced motion, browsers without video encoding, axe accessibility checks.

After an intentional change to a design's look, refresh its reference frames:

    UPDATE_GOLDEN=1 npx playwright test golden --project=desktop

## Where things are

| Path | What it is |
|---|---|
| `engine/` | Shared runtime: motion curves, renderer (motion blur, watermark), effects, text, sound, exporters |
| `designs/<id>/index.js` | One design each. See [`designs/README.md`](designs/README.md) to add one |
| `packs/` | Packs and their shared look |
| `catalogue.js` | The list of designs and packs on sale |
| `store.config.js` | Name, domain, prices, Lemon Squeezy ids, activation limit |
| `site/` | Pages (Eleventy) and browser code (`site/js`) |
| `worker/handler.js` | The server code: webhooks, claims, unlocks |
| `functions/api/[[path]].js` | Mounts the handler at `/api/*` on Cloudflare Pages |
| `scripts/dev.js` | Dev server with the mock Lemon Squeezy |

## Going live

1. **Name and domain.** Set `name`, `domain` and `supportEmail` in `store.config.js`.
2. **Signing keys.** Run `npm run keys`. Commit `keys/public-key.json`; keep the
   private key it prints for step 5. Never commit the private key.
3. **Lemon Squeezy.**
   - Create the store and one product per design plus one per pack, each with
     **licence keys** turned on and an activation limit of 10.
   - For each variant, copy its numeric id into `variantId` and the id in its
     checkout link (the part after `/buy/`) into `checkoutId` in `store.config.js`.
     Put your store id and subdomain under `lemonSqueezy`.
   - Add a webhook pointing at `https://YOUR-DOMAIN/api/webhook` for
     `order_created`, `order_refunded` and `license_key_created`. Copy its
     signing secret.
4. **Cloudflare.** Create a D1 database called `store`, put its id in
   `wrangler.toml`, and apply the schema:
   `npx wrangler d1 execute store --remote --file=worker/schema.sql`.
   Create a Pages project from this folder: build command `npm run build`,
   output directory `dist`, D1 binding `DB`.
5. **Secrets** (Pages project → Settings → Variables and secrets, or
   `npx wrangler pages secret put NAME`): `LS_WEBHOOK_SECRET` and
   `UNLOCK_PRIVATE_KEY`.
6. **Analytics (optional).** Turn on Cloudflare Web Analytics and paste the
   token into `analyticsToken`.
7. **Check with a test-mode purchase**, then one real purchase that you refund.

## What hasn't been tested against the real services yet

Everything above runs against a mock of Lemon Squeezy built from its
documentation. Before launch, the Phase 0 checks in the spec need a real
test-mode store:

- the webhook payloads carry `custom_data.claim` on both `order_created` and
  `license_key_created`, and the licence key is in `license_key_created`;
- the public licence API's activate/validate responses match `worker/handler.js`;
- a refund disables the key (the Worker also blocks refunded orders itself);
- the Lemon.js overlay opens and fires `Checkout.Success`.

## Differences from the spec

- **Repo:** built in `store/` of the figade repo rather than a new repo.
- **Worker:** runs as a Cloudflare Pages Function in the same project as the
  site (same domain, no CORS, still the Workers free tier).
- **Storefront preview** is zoomed in and not watermarked, so the designs are
  legible at small sizes. Design pages, which show the visitor's own details
  at full frame, are watermarked.
- **Sound in MP4:** AAC is used when the browser can encode it (Chrome on
  Windows and macOS). Elsewhere, such as Chrome on Linux where the tests run,
  the MP4 is silent and a WAV file is downloaded alongside it.
- **Fonts for other scripts:** Japanese, Korean and Chinese fonts ship in one
  weight to keep the site small; the browser only downloads the pieces a name needs.

## Licences

Fonts are under the SIL Open Font License (`site/static/fonts/OFL-*.txt`).
Mediabunny is under the Mozilla Public License 2.0.
