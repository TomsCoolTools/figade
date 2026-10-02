# Editing figade

A video compressor website. The pages are built from templates, so the menu,
footer and compressor box only exist once.

## What is where

    src/                     everything you edit
      index.njk                the home page
      video/                   the size pages (Discord, WhatsApp, email, 10MB, 25MB)
      pages/                   about, contact, privacy, size guide, 404
      _includes/               the templates every page shares
        base.njk                 head, menu and footer wrapper
        tool.njk                 layout for pages with the compressor
        text.njk                 layout for plain pages
        partials/                nav, footer, compressor box, size links
      _data/                   shared settings and lists (see below)
      sitemap.njk              builds sitemap.xml automatically
    static/                  copied to the site as-is: css/, js/, img/,
                             fonts/ (the heading font and its licence),
                             favicon.ico, robots.txt, site.webmanifest,
                             _headers (how long browsers cache files)
    _site/                   the finished site. Generated. Never edit, never commit.
    eleventy.config.js       build settings. You rarely need to touch this.

## First time setup

1. Install Node.js from nodejs.org (the LTS version).
2. Open this folder in VS Code and open a terminal (Ctrl+`).
3. Run `npm install`. This downloads Eleventy into node_modules/ and only
   needs doing once.

## Previewing while you work

    npm start

Then open http://localhost:8080 . Leave it running: when you save a file the
page reloads by itself. Press Ctrl+C to stop.

`npm start` uses local preview mode: analytics and ads are disabled, and pages
are marked noindex. `npm run build` creates the normal production build. The
review package also includes a ready-built preview; see `REVIEW-FIRST.md`.

Live Server is no longer used. It would show you the source files, not the
finished pages.

## Editing

| What you want to change | Where |
|---|---|
| Wording on one page | that page's file in `src/video/` or `src/pages/` |
| The menu | `src/_data/nav.json` |
| The footer links | `src/_data/footerLinks.json` |
| The questions at the bottom of tool pages | `src/_data/faq.json` |
| The "Other sizes" buttons | `src/_data/sizes.json` |
| Domain, contact address, "limits checked" date | `src/_data/site.json` |
| Turning visit counting on (your GoatCounter code) | `goatcounter` in `src/_data/site.json` |
| Shared page widths, article reading measure and responsive layouts | `static/css/style.css`, `src/_includes/text.njk`, `src/_includes/guide.njk` |
| Size-guide table values | `fits` filter in `eleventy.config.js` (shared with tool-page tables) |
| Colours and layout | `static/css/style.css` |
| The video compressor itself | `static/js/app.js` |
| The image compressor itself | `static/js/image.js` |
| The MP4 converter itself | `static/js/convert.js` |
| File summaries, result presentation, progress and shared tool controls | `static/js/tool-ui.js` |
| Trim times, image dimensions and crop geometry | `static/js/file-options.js` |
| File privacy and served-script verification | `src/pages/how-file-privacy-works.njk`, `src/file-verification.njk`, `src/_data/verificationFiles.json` |
| The file picker and shared status area | `src/_includes/partials/filepicker.njk`, `toolstatus.njk` |
| Guides (one file per guide; the Guides page lists them automatically) | `src/guides/` |
| MP4 converter pages, their format buttons and questions | `src/convert/`, `src/_data/convertLinks.json`, `src/_data/convertFaq.json` |
| Image pages, their "Other sizes" buttons and questions | `src/image/`, `src/_data/imageSizes.json`, `src/_data/imageFaq.json` |
| The video encoder version | `mediabunny` in `package.json` (see Notes) |
| Anything in the head, or the footer wording | `src/_includes/` |

Change the footer once and it changes on every page. That is the point of
this setup.

### What a page file looks like

The part between the `---` lines is the page's settings. Everything after is
ordinary HTML.

    ---
    title: "Compress video to 10MB: free online, no upload"
    description: "Shrink any video to 10MB. Free, runs in your browser."
    h1: "Compress a video to 10MB"
    intro: "Pick your video and the tool shrinks it to 10MB in your browser."
    toolKey: 10mb
    limit:
      big: "10 MB"
      caption: "Target size"
      checked: false
    chips: [5, 8, 10]
    target: 10
    facts:
      - "At 10MB, a 16:9 video stays at 720p up to about 38 seconds."
    ---

    Any extra HTML for this page goes here. Most pages need none.

Field notes:

- `toolKey` matches a `key` in `src/_data/sizes.json`. It makes that page show
  as plain text in the size links instead of linking to itself.
- `limit.checked: true` appends ", checked <date>" using the date in site.json,
  so you update the date in one place.
- `chips` are the preset buttons; `target` is the one that starts selected.
- Leave `limit` out entirely and no big number appears.

## Adding a size page

1. Copy a file in `src/video/`, for example `compress-video-to-10mb.njk`.
2. Rename it. The file name becomes the URL, so
   `compress-video-to-50mb.njk` becomes figade.com/compress-video-to-50mb.
3. Change the fields in the front matter.
4. If it should appear in the "Other sizes" buttons, add it to
   `src/_data/sizes.json` and give the page a matching `toolKey`.

The sitemap updates itself. Only add a page when it has something true and
specific to say; near-duplicate pages hurt your search ranking.

## Adding a plain page

Copy a file in `src/pages/`, rename it, change the front matter, and add it
to `src/_data/footerLinks.json` if it should be linked from the footer.

## Uploading

Cloudflare Pages builds the site for you. Commit and push, and it deploys.

Build settings in the Cloudflare dashboard (Settings > Build):

    Framework preset:        Eleventy
    Build command:           npx @11ty/eleventy
    Build output directory:  _site

These must be set before the first push, or the build will fail. If a build
fails, the previously deployed version stays live.

## Notes

- `_site/` and `node_modules/` are in .gitignore and should never be committed.
- Page URLs are unchanged from the earlier hand-built version, so nothing
  that Google has indexed moves.
- 50 and 60fps videos are brought down to 30fps when the target size is too
  small to hold 720p at the full rate.
- The contact address is hello@figade.com, forwarded by Cloudflare Email Routing.
- The video encoder (Mediabunny) is installed by `npm install` and copied to
  `/js/mediabunny.mjs` when the site is built, so visitors load it from
  figade.com rather than a third-party CDN. To upgrade it, change the version
  in `package.json`, run `npm install`, and update the matching jsDelivr
  fallback version in `static/js/app.js`.
