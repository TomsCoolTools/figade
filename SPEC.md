# [SITE NAME] — personalised motion graphics store

Spec v1, 1 October 2026. Built on the answers from the interview. The prototype in
[`subscribe-demo/`](subscribe-demo/) is the starting point and sets the quality bar:
nothing ships that looks or moves worse than it.

This file lives in the figade repo for now. In Phase 0 it moves to the store's own repo.

---

## 1. What we're building

Creators enter their details (channel name, subscriber count, profile picture,
colours). They see their own version animate live in the browser, then pay a few
dollars to download it clean. There's no freelancer to wait for and no After Effects
to learn.

Hard constraints:

- **Everything renders in the visitor's browser.** There are no rendering servers and
  customer files are never stored. The profile picture never leaves the device.
- **Static hosting on a free tier** (Cloudflare Pages). The only server code is one
  small Cloudflare Worker, plus a D1 database, that confirms payments and issues unlocks.
- **Free preview with a watermark. Paying unlocks the clean export.**
- **Exports work in Premiere Pro.** That means a green-screen MP4 and a transparent
  version: a PNG sequence now, ProRes 4444 later.
- **Every design is a self-contained module** that plugs into a shared engine.
  Adding a design means adding one folder.
- **Designs can be sold together as matching packs.**

### Decisions from the interview

| Topic | Decision |
|---|---|
| Payments | Lemon Squeezy. It's the merchant of record, so it handles VAT and sales tax, and it has built-in licence keys |
| What a purchase unlocks | The whole design, with any details, as many times as the buyer likes |
| Protection | Server-held unlock: a clean export needs a token signed by the Worker after payment |
| Price | $4 per design. A pack of four is $9 (both are config values) |
| Buyers | Desktop editors, phone editors and streamers |
| Launch formats | 1080p at 60 or 30 fps: green-screen MP4, transparent PNG zip, transparent WebM |
| Later formats | Vertical 9:16 and 4K in Phase 2, ProRes 4444 in Phase 3 |
| Sound | Optional click, pop and bell sounds, generated in code so there's no licensing |
| Browsers | Full export in desktop Chrome and Edge, plus green MP4 on Android Chrome. Elsewhere, preview and buy, then export on a computer |
| Authoring | Designs are code modules (canvas JavaScript), like the demo |
| Branding | Inspired by platform UI, but no platform logos or names in products |
| Re-downloads | Licence key plus email. Settings are saved in the browser |
| Launch catalogue | One matching pack of four designs |
| Packs | A pack's key unlocks every design in that pack, including ones added later |
| Hosting | A new repo and its own domain, separate from figade |
| Look | "Edit bay": the site looks like an editing timeline (section 7) |
| Buyer licence | Use in their own content, forever, including monetised videos. No reselling and no making them for others |
| Name | Undecided. Ideas are in section 11 |

---

## 2. Architecture

```
Browser (everything that matters)                 Cloudflare (tiny)
┌──────────────────────────────────────────┐      ┌─────────────────────────┐
│ Static site (Pages)                      │      │ Worker  /api/*          │
│  ├─ storefront, design pages, legal      │      │  ├─ POST /webhook       │◄── Lemon Squeezy
│  ├─ engine: player, render, export       │◄────►│  ├─ GET  /claim/:id     │    webhooks
│  ├─ designs/* (one module each)          │      │  └─ POST /unlock        │
│  └─ Lemon.js checkout overlay            │      │ D1: claims, refunds     │
└──────────────────────────────────────────┘      └─────────────────────────┘
          │ checkout (in an overlay, so the page and the uploaded picture stay put)
          ▼
   Lemon Squeezy: payment, tax, receipt email with licence key
```

### Repo layout (new repo)

```
/site                 Eleventy pages: storefront, design pages, legal, restore
/engine               shared runtime (no design-specific code)
  motion.js           easing, springs, press, wiggle, rng  (from the demo)
  render.js           Renderer: sub-frame motion blur, scaling, watermark
  player.js           preview player: play, scrub, frame step, speed, loop
  options.js          builds the options panel from a design's option schema
  text.js             fonts, measuring, truncation, fallback scripts
  fx/                 shared effects: cursor, ripple, particle burst, bell
  sfx.js              sounds generated with OfflineAudioContext
  export/             mp4.js, webm.js, pngzip.js, zip.js, capabilities.js
  unlock.js           token storage, signature check, restore
/designs
  subscribe-pop/      index.js (the module), README.md, golden/ (reference frames)
  like-bell/ follow-card/ lower-third/
/packs
  studio.js           pack definition: designs, shared style tokens, product ids
/worker               Worker source, wrangler.toml, D1 schema, tests
/tests                Playwright: golden frames, export checks, checkout (test mode)
```

The build uses Eleventy for the HTML, as figade does, and esbuild to bundle and
minify the engine and designs. No framework.

---

## 3. The engine and design modules

### What moves out of the demo

| Demo file | Becomes |
|---|---|
| `motion.js` | `engine/motion.js`, unchanged |
| `Renderer` (motion blur) in `scene.js` | `engine/render.js`. The shutter is based on the export frame rate (`0.5 / fps`) |
| cursor, ripple, press, particle burst, bell wiggle | `engine/fx/*`, with parameters, so the like and bell reminders reuse them |
| `formatSubscribers`, initials, avatar colour, cover-crop | `engine/text.js` and `engine/fx/avatar.js` |
| `export.js` and `zip.js` | `engine/export/*`, taking any size, frame rate and format |
| the rest of `scene.js` | `designs/subscribe-pop/index.js` |

### Design module interface

```js
// designs/subscribe-pop/index.js
import { defineDesign, opt, fx, motion } from '../../engine/index.js';

export default defineDesign({
  id: 'subscribe-pop',
  name: 'Subscribe pop-up',
  duration: 5,                     // seconds
  layouts: ['landscape'],          // 'vertical' added in Phase 2
  poster: 2.6,                     // time used for static poster frames
  options: {
    name:   opt.text({ label: 'Channel name', max: 60, shared: 'name' }),
    subs:   opt.subscribers({ shared: 'subs' }),
    avatar: opt.image({ shared: 'avatar' }),
    theme:  opt.choice(['dark', 'light'], { shared: 'theme' }),
    button: opt.choice(['classic', 'modern']),
    accent: opt.colour({ shared: 'accent' }),
    position: opt.choice(['center', 'left']),
  },
  sounds: (o) => [{ at: 1.94, sfx: 'click' }, { at: 2.02, sfx: 'pop' }, { at: 3.39, sfx: 'bell' }],
  prepare(o, ctx, frame) { /* measure text, fix layout; returns a scene */ },
  render(ctx, t, scene, frame) { /* draw one moment; pure function of t */ },
});
```

Rules for every design:

1. **`render` depends only on `t` and the prepared scene.** No wall clock and no
   `Math.random`; use `motion.rng(seed)`. This is what keeps preview, scrubbing and
   export identical, and what makes golden-frame tests work.
2. **Draw in design units.** Units are 1920×1080 for landscape and 1080×1920 for
   vertical. The engine scales for 4K and for small previews.
3. **Options with `shared` keys** are entered once per visit and fill every design
   that uses them. A pack becomes "type your name once, see all four update".
4. **Pack style tokens** (corner radius, type, shadow, how the accent is used) come
   from the pack definition, so designs in a pack match.
5. **A design never draws the watermark or deals with exporting.** The engine does both.

Adding a design: copy a design folder, edit `index.js`, add it to a pack, and add
golden frames. The site's pages, option panels, storefront track and product mapping
are all generated from the design and pack definitions.

### Fonts and names in any script

The demo only has Latin Roboto. A creator called "Ксюша", "さくら" or "🔥Gaming🔥"
would get blank boxes. The engine loads Noto fallback subsets (Cyrillic, Greek, CJK,
Arabic and Hebrew, plus emoji) only when the typed name needs them, and handles
right-to-left text. Designs only use fonts under the SIL Open Font License, which
allows embedding them in exported video.

---

## 4. Payment, unlocking and protection

### Products in Lemon Squeezy

- One product per design ($4), and one product per pack ($9).
- Licence keys are switched on for every product, with an activation limit of 10
  browsers per key.
- The mapping from product variant to what it unlocks lives in the Worker's config,
  generated from `/packs` and `/designs` at build time.

### Purchase flow (no accounts)

```
1. Buyer clicks "Buy for $4". The page makes a random claimId and opens the
   Lemon.js overlay with checkout[custom][claim]=claimId.
   The page stays loaded, so the uploaded picture and settings are still there.
2. Payment completes. Lemon Squeezy sends webhooks (order_created and
   license_key_created) to /api/webhook. The Worker checks the signature and stores
   claimId → { licenceKey, variantId, orderId } in D1.
3. The overlay reports success. The page polls GET /api/claim/:claimId for up to
   90 s and receives the licence key.
4. The page calls POST /api/unlock { licenceKey, instanceId }. The Worker activates
   or validates the key with Lemon Squeezy's licence API, checks it belongs to our
   store and isn't refunded or disabled, and returns a signed token.
5. The page stores the token and key in localStorage. The export buttons switch to
   clean exports straight away.
```

If the claim hasn't arrived after 90 s, the page says: "Payment received. Your
licence key is on its way to your email. Paste it here to unlock." The page and the
uploaded picture stay as they are.

### The unlock token

The token is a small JSON payload signed with ECDSA P-256. The private key is a
Worker secret; the public key ships in the site bundle.

```json
{ "packs": ["studio"], "designs": [], "kh": "first 16 hex of sha256(key)",
  "iat": 1790000000, "exp": 1792592000 }
```

- A token lasts 30 days. After that, the page quietly gets a fresh one using the
  stored key. This is also how refunds take effect: a refunded or disabled key gets
  no new token.
- Packs are listed by id and turned into designs on the page. A design added to a
  pack later is unlocked automatically for everyone who bought the pack.

### Restore on another device

There's an "Already bought?" link on every design page, and a `/restore` page.
The buyer pastes the licence key from their receipt email, or opens
`/restore#key=…` (the key is in the `#` part, so it never appears in server logs).
Settings are saved per browser. The profile picture is stored as a small data URL
when it's under about 1 MB; otherwise the buyer uploads it again.

### What the protection does and doesn't do

Rendering in the browser means a determined person with developer tools can always
remove the watermark. Server-side rendering is the only real fix, and it's ruled out.
The goal is that unlocking is never trivial:

- There's no URL setting, localStorage flag or hidden button that gives a clean export.
- A clean export needs a valid signed token, and the watermark is applied inside
  the bundled, minified render step.
- The watermark covers the graphic itself, not a corner, so cropping doesn't remove it.
- Activation limits stop one key being shared widely.
- Screen-recording the preview gets a watermarked copy.

We accept that a skilled person could patch the bundle. At $4, that isn't worth
fighting harder.

### Webhook and Worker security

- Check the `X-Signature` HMAC on every webhook and reject anything that doesn't match.
- Only accept licence keys whose `store_id` is ours.
- Limit `/unlock` and `/claim` to about 30 requests per minute per IP.
- Claim records are deleted after 24 hours. D1 stores no customer email, only
  the key hash, variant, order id and refund state.

---

## 5. Exports

| Format | Phase | Details | Premiere | OBS | CapCut |
|---|---|---|---|---|---|
| Green-screen MP4 | 1 | H.264 on #00FF00, 30 Mbps at 1080p60. AAC sound when sound is on and the browser can encode AAC | Yes | Yes (with chroma key) | Yes (chroma key) |
| Transparent PNG zip | 1 | 8-bit RGBA PNGs plus a README with import steps. Includes a WAV when sound is on | Yes (image sequence) | No | No |
| Transparent WebM | 1 | VP9 with alpha, plus Opus sound | No (needs a plugin) | Yes (native) | Yes (desktop app) |
| Vertical 9:16 | 2 | 1080×1920 versions of every format above, for designs that have a vertical layout | — | — | — |
| 4K | 2 | 3840×2160 for every format. The PNG zip is written straight to disk (see below) | — | — | — |
| ProRes 4444 MOV | 3 | Transparent, 10-bit, the standard file editors hand to each other | Yes | No | No |

- Frame rate is 60 or 30 fps for every format from Phase 1.
- Every export button checks first whether this browser can encode that format
  (`canEncodeVideo` and `canEncodeAudio`). Anything it can't make is shown as
  "Not available in this browser — use Chrome on a computer" rather than failing halfway.
- Watermarked exports can be downloaded for free. This lets people check the file in
  their editor before paying, which should help sales. It's easy to switch off.
- **Large files:** at 4K, the PNG zip is written straight to a file the buyer picks,
  using Chrome's file saving API, so it doesn't fill up memory. In-memory export is
  only used at 1080p.

### Sound

The click, pop, bell "ding" and whoosh sounds are generated in code with
`OfflineAudioContext`, the same way every time, so there's nothing to license. Each
design lists when its sounds play. Sound is off by default; when switched on:

- The MP4 gets AAC audio if the browser can encode it. Otherwise the MP4 stays silent
  and a WAV file is downloaded alongside it.
- The PNG zip includes a WAV file.
- The WebM gets Opus audio.

---

## 6. Browser support

| | Preview | Buy | Export |
|---|---|---|---|
| Chrome and Edge, desktop | Yes | Yes | Everything |
| Chrome, Android | Yes | Yes | Green MP4 (others where the capability check passes) |
| Safari, macOS | Yes | Yes | "Finish on Chrome" message (Phase 3: real support) |
| Safari, iPhone and iPad | Yes | Yes | "Finish on a computer"; the purchase follows by email |
| Firefox | Yes | Yes | Whatever the capability check passes, otherwise the message |

Performance on the storefront:

- Only the clip under the playhead (desktop) or on screen (phone) plays at full rate.
- Other tracks show still poster frames.
- Previews render at the size they're shown on screen, with motion blur switched off
  on the storefront.
- If the visitor has reduced motion turned on, every design shows its poster frame
  with a play button.

---

## 7. Look and feel: "Edit bay"

The site looks like the workspace its customers edit in, which tells them it was made
by someone who does this job. One bold idea is spent in one place: **the storefront is
a live timeline**. Everything else stays quiet and disciplined.

### Colour

| Name | Hex | Use |
|---|---|---|
| Graphite | `#2E2D2B` | Page background. Deliberately mid-dark warm grey, not near-black |
| Deck | `#3A3936` | Panels, track lanes |
| Rule | `#4F4D48` | Dividers, track borders, ruler ticks |
| Paper | `#ECE9E3` | Main text |
| Ash | `#A9A59D` | Secondary text, timecode |
| Clip colours | Caribbean `#2DBFAB`, Mango `#F0A23B`, Rose `#EC8297`, Cerulean `#6AA3E3` | Each design's clip on its track, and its colour across the site. Mango is also the playhead |

Each clip colour has a single job: it identifies one design. No gradients.

### Type

**Anybody** (SIL Open Font License, stored with the site) is the only typeface. Its
width axis does the work that would usually need two typefaces:

- Headlines are extra-wide (width 130–150) and heavy (weight 800). On first load,
  the main headline animates its width from 60 to 140, like a keyframed text layer.
  That's the site's single scripted moment.
- Body text uses normal width, weight 400, at 17 px with 1.5 line height, on lines
  under 70 characters.
- Timecode and track names use condensed width (60–70) with tabular figures, in
  place of a monospace font.

Type scale: a 1.333 ratio (17, 22.7, 30.2, 40.3, 53.7, 71.6 px). Text is sentence
case everywhere. No all-caps labels: track names ("V1") are real editing terms,
not decoration.

### Pages

**Storefront**
```
desktop                                        phone
┌──────────────────────────────────────┐      ┌──────────────────┐
│ [SITE NAME]                  Restore │      │ [SITE NAME]   ≡  │
│                                      │      │ ┌──────────────┐ │
│ Your channel,                        │      │ │ program      │ │
│ animated.             ┌────────────┐ │      │ │ monitor      │ │
│ Type your name, watch │  program   │ │      │ └──────────────┘ │
│ it play, download it. │  monitor   │ │      │ Your channel,    │
│                       │ (live)     │ │      │ animated.        │
│                       └────────────┘ │      │ ▐ Subscribe ▌ $4 │
│ 00:00   00:01   00:02 ▼ 00:03  00:04 │      │ ▐ Like + bell ▌  │
│ V4 ▐██ Lower third ███│██▌      $4   │      │ ▐ Follow ▌       │
│ V3   ▐█ Follow card ██│████▌    $4   │      │ ▐ Lower third ▌  │
│ V2 ▐███ Like + bell ██│██▌      $4   │      │ Studio pack  $9  │
│ V1 ▐████ Subscribe ███│█████▌   $4   │      └──────────────────┘
│ Studio pack: all four, $9 ────────── │
└──────────────────────────────────────┘
```
- The playhead sweeps the tracks. The design under it plays in the program monitor,
  with the visitor's own details if they've entered them.
- Clicking or tapping a clip opens its design page.
- On phones, the tracks stack and tapping one plays it in the monitor fixed at the top.

**Design page**
```
┌──────────────────────────────────────────────────────────┐
│ ◀ All designs   Subscribe pop-up                          │
│ ┌──────────────────────────────┐  Your details            │
│ │                              │  Channel name [_______]  │
│ │     program monitor (live)   │  Subscribers  [_______]  │
│ │                              │  Picture      [Upload]   │
│ └──────────────────────────────┘  Style                   │
│ ▶ ──◆────◆──────◆─────────── 2.94s   Card   Dark | Light   │
│   ◆ = sound cue markers           Button Classic | Modern │
│ Background: green | checker | footage      Accent ■       │
│                                   Export                  │
│                                   MP4 · PNG · WebM  60|30 │
│                                   Sound  on | off         │
│                                   [ Buy for $4 ]          │
│                                   or the Studio pack, $9  │
│                                   Download watermarked    │
└──────────────────────────────────────────────────────────┘
```
- The options panel is built from the design's option schema and laid out like an
  editor's "Effect Controls" panel.
- The scrubber marks the design's sound cues as keyframe diamonds.
- After unlocking, the buy button becomes "Download clean MP4" (whichever format is
  chosen), and its colour changes to the design's clip colour.
- On phones, the monitor stays at the top while scrolling, and options appear below it.

**Checkout and download**: there's no separate checkout page. The Lemon.js overlay
opens over the design page. When it closes, one line reports what happened:

- Success: "Unlocked. Your downloads are clean now."
- Waiting for the webhook: "Confirming payment…"
- Timeout: "Paste the key from your receipt email."

**Restore**: one field, "Paste your licence key", then a list of what that key unlocks.

**Legal**: Terms, Licence, Privacy and Refunds pages, which Lemon Squeezy requires
before approving a store.

### Writing

- Plain verbs, sentence case, the buyer's words ("Download clean MP4", not "Export asset").
- Buttons say exactly what happens, and the result uses the same words.
- Errors say what went wrong and what to do: "This browser can't make WebM files.
  Open this page in Chrome on a computer."
- No arrows in link text, no middle-dot meta strings, no labels above headings.

### Quality floor

Every page must:

- Work from 360 px wide.
- Show visible keyboard focus everywhere.
- Respect reduced motion.
- Meet WCAG AA contrast. Checked: Paper on Graphite is 11.4:1 and Ash on Graphite 5.6:1. All four clip colours are at least 4.5:1 against both Graphite and Deck, so they work as text and as fills with Graphite text on top.
- Have focus order that matches reading order.

---

## 8. Launch catalogue: the Studio pack

Four designs in one style: rounded cards, Roboto inside the graphics, and the buyer's
accent colour. They share the buyer's name, handle, avatar, theme and accent.

| Design | What happens | New shared pieces |
|---|---|---|
| Subscribe pop-up | The demo, as it is | none |
| Like + bell reminder | A thumbs-up and bell pill pops in. The cursor clicks like (burst), then the bell (ring) | thumbs-up icon fx |
| Follow card | Avatar, @handle and a "Follow" pill (no platform logo). Click, check mark, burst | check-mark morph fx |
| Lower third | Name and title bar wipe in with a mask reveal and an accent line, hold, then wipe out. No cursor | bar wipe and mask fx |

Each design takes roughly one to two days of motion polish, and that's the critical
path for launch. Build the subscribe design first; it proves the engine and the whole
purchase flow.

---

## 9. Phases

Each phase ends with how we check it works. A phase is done only when every check passes.

### Phase 0: foundations (about 2–3 days)

- Create the new repo and Cloudflare Pages project, and move this spec there.
- Move the demo into `engine/` and `designs/subscribe-pop/`. It must still look
  identical.
- Try out the risky pieces before building on them:
  1. **WebM with alpha:** can Mediabunny with WebCodecs VP9 (`alpha: 'keep'`) make a
     file that OBS and DaVinci show transparent? Fallback: write the alpha channel
     ourselves.
  2. **AAC:** can Chrome encode AAC on Windows, macOS and Android? If not, use the
     silent MP4 plus WAV fallback.
  3. **Android Chrome:** can a mid-range Android phone export a 1080p60 MP4? How long
     does it take, and how much memory does it use?
  4. **Lemon Squeezy test mode:** do the webhooks carry `custom_data` with the claim
     id? Does `license_key_created` include the key? Does the public licence API
     work for activate and validate? Does a refund disable the key?

**Check:**
- Golden frames of the moved subscribe design match the demo's frames pixel for pixel
  at 12 chosen times.
- Each experiment has a written yes or no, with a sample file opened in Premiere,
  OBS and DaVinci where relevant.

### Phase 1: launch the Studio pack (about 2–3 weeks)

**Engine**
- Player
- Options panel built from each design's schema
- Shared options across a pack
- Watermark
- Fallback fonts for other scripts
- Sound cues
- Capability checks
- Exports: MP4, PNG zip and WebM at 1080p, 60 or 30 fps

**Designs**
- All four Studio pack designs, with golden frames

**Site**
- Storefront timeline
- Design pages
- Restore page
- Legal pages
- Edit bay styling, including mobile

**Payments**
- Lemon Squeezy products and the Lemon.js overlay
- The Worker (webhook, claim, unlock) and D1
- Token storage and check
- Watermarked free downloads

**Running it**
- Cloudflare Web Analytics, which uses no cookies
- A support email address
- The product listings on Lemon Squeezy

**Check:**
- **Automated (Playwright):**
  - Golden frames for every design and option combination at fixed times.
  - Each export opens: ffprobe confirms codec, size, frame rate, 300 or 150 frames, and duration.
  - The PNG zip has the right number of frames, each with an alpha channel.
  - The WebM has alpha.
  - Worker tests cover webhook signature checks, the claim flow, a refunded key
    getting no token, and rate limits.
- **Manual, once per release:**
  - A Lemon Squeezy test-mode purchase on desktop Chrome and on Android Chrome, all
    the way to a clean download.
  - Restore on a second browser using the email key.
  - The MP4 keyed with Ultra Key in Premiere.
  - The PNG sequence imported at 60 fps in Premiere.
  - The WebM playing transparent as an OBS media source.
  - The MP4 keyed in CapCut on a phone.
- **Protection:**
  - With no token, there's no way through the interface, URL or localStorage to get
    an export without the watermark.
  - A forged or expired token is rejected.
- **Quality floor:**
  - Lighthouse accessibility score of 95 or more on every page.
  - Keyboard-only purchase works.
  - Works at 360 px wide.
  - Reduced motion is respected.
- **Go-live:** one real $4 purchase on the live store, then refund it.

### Phase 2: more formats and a second pack (about 2–3 weeks)

- Vertical 9:16 layouts for the Studio pack designs.
- 4K exports, with the PNG zip written straight to disk.
- A second pack, for example a streamer pack: alerts and "starting soon".
- Simple anonymous sales-funnel counts through the Worker: preview → buy click →
  unlock. No personal data.
- A page per design with a short description and a video preview, so search engines
  can find it.
- Optional: upgrade discount for single-design buyers who then buy a pack, using
  Lemon Squeezy discount codes.

**Check:**
- Golden frames for vertical layouts.
- A 4K PNG export of 300 frames completes in Chrome on an 8 GB laptop without running
  out of memory.
- Vertical MP4 imported into CapCut and Premiere vertical sequences.
- The funnel counts match a scripted test session.

### Phase 3: ProRes and wider browser support

- Transparent ProRes 4444. First test two approaches:
  - ffmpeg.wasm with `prores_ks`. About a 30 MB download, and the fast multi-threaded
    version needs special page headers that may break the Lemon Squeezy overlay.
  - Our own ProRes 4444 encoder in JavaScript or WebAssembly, written from the
    published format spec.
- Full export in Safari on macOS, and iPhone export where testing shows it's stable.
- More platform follow designs (still no logos).

**Check:**
- The ProRes file opens in Premiere and DaVinci with working transparency.
- `ffprobe` reports `prores` profile 4444 with an alpha channel.
- The export matches golden frames within a small colour tolerance.
- The Safari export checklist passes on two macOS versions.

### Phase 4: growth

- More packs, roughly one a month.
- An affiliate scheme for editors and YouTubers, using Lemon Squeezy's built-in affiliates.
- Saved style presets.
- Bundles of several packs.

**Check:** depends on what's chosen. Each new design must have golden frames and pass
the export checklist before it goes on sale.

---

## 10. Things you may not have thought about

- **Store approval.** Lemon Squeezy reviews new stores. You need a live site, Terms,
  Refunds and Privacy pages, and a clear description of the product before you can
  take real payments. Allow a few days.
- **Refund policy.** Suggested: a refund on request within 14 days if the export
  didn't work, which disables the key. Lemon Squeezy handles EU and UK digital-content
  withdrawal rules at checkout.
- **Trademarks.** Product names never include "YouTube", "TikTok" and so on. Saying
  "works for your YouTube videos" in descriptions is generally lower risk, but get
  advice before relying on platform names in marketing.
- **Names in other alphabets and emoji.** Section 3. Easy to miss, and an instant
  refund request.
- **Fee per sale.** At $4, Lemon Squeezy keeps about $0.70. The $9 pack loses
  proportionally less to fees, so the storefront always shows the pack price.
- **The free watermarked download is marketing.** If watermarked clips appear in
  people's videos, the watermark should show the site's address, not "PREVIEW".
- **Support load.** Most emails will be "I lost my key" or "it won't export". The
  restore page and clear capability messages exist to prevent both.
- **Free-tier limits.** Workers allow 100,000 requests per day and D1 has generous
  free read and write limits. That's far above what launch needs, but put a usage
  alert on the Cloudflare account.
- **Matching the demo.** Every design is checked against the demo's polish: springs
  that settle, overlapping timing, motion blur, crisp edges at 1080p.

---

## 11. Name ideas

Check the domains and existing trademarks before choosing. Each one hints at
editing or motion:

- **Subframe**: the in-between frames that motion blur is built from.
- **Tallylight**: the red "live" light on a broadcast camera.
- **Cuepop**: a sound cue and a pop-in.
- **Keyclip**: keyframe and clip.
- **Popframe**: a frame that pops in.
- **Overlane**: an overlay on its own track.
- **Glidecut**: smooth motion and an edit.

---

## 12. Open questions

These have sensible defaults in the spec. Change any of them before Phase 1 starts:

1. **Name and domain.**
2. **Exact prices:** $4 and $9 are placeholders within the $4–5 range you chose.
3. **Free watermarked download:** on by default (section 5). Switch off if you'd rather
   keep previews view-only.
4. **Activation limit:** 10 browsers per key.
5. **The pack name:** "Studio pack" is a placeholder.
