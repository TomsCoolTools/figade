# Review Figade on your computer

This package includes the latest local source and a ready-built preview. It is
based on live commit `ffa51ad313dca1566a0d9ee941354a837477b125`.
The follow-up changes were reviewed locally and approved for publication.
GitHub commit history records the current production version.

## Open the preview

1. Extract into a fresh folder, separate from an existing checkout.
2. Install Node.js 22 or newer if needed.
3. Open a terminal in the extracted `figade-review` folder and run:

   ```sh
   node scripts/serve-built.cjs
   ```

4. Open http://localhost:8080. Keep the terminal open; Ctrl+C stops it.

Windows users can also double-click `start-preview.bat`. On macOS, run
`bash start-preview.command` in Terminal. Do not open `_site/index.html` directly.
Analytics and advertising are disabled in this local build.

## Changes since the live release

- Related tools, size guides, guidance and questions are now visible below the
  main tool, across the same page width. The outer disclosure was removed from
  every video, image and converter page.
- Desktop uses three columns; smaller widths use two, then one. Individual
  questions remain expandable. Optional trim and dimensions controls still
  expand inside the main tool.
- The pending SEO improvements are included: specific image-size guidance,
  visible guide authorship, an updated 100KB guide and SEO regression checks.
  See `SEO-REVIEW.md` for the audit and its limits.

## Review the layout

Check the homepage, one video size page with its resolution table, a platform
page, the image compressor and a converter. Resize the window to desktop,
tablet and phone widths, try 200% zoom, and inspect both light and dark themes.
The supporting content should remain visible; each question should open using
keyboard or pointer input. Long links and tables should fit or scroll locally.

The review browser still cannot open localhost, so rendered breakpoint and theme
checks require your local review. No cross-device visual certification is claimed.

## Source development and checks

```sh
npm ci
npm start
```

Stop the ready-built server first to free the port. To repeat all checks, run:

```sh
npm test
```

The production build and all 47 automated tests passed, covering every generated
page, local routes/assets, workflow state, canonical URLs, sitemap coverage and
internal reachability. Codec/canvas workflow tests are simulated. They do not
certify real encoding quality or compatibility across browsers.

The previous live release was smoke-tested with a real trimmed MP4 and a real
300 × 300 JPG in the review browser. That browser could not encode audio and the
site displayed its audio-loss warning; download verification remains incomplete.

## Publishing later

Keep this review copy separate until you approve it. Pushing your production
branch triggers the existing Cloudflare deployment. Commit source/scripts/tests;
leave `_site` and `node_modules` uncommitted. Run `npm run build` for a production
build; do not deploy the included noindex preview build.
