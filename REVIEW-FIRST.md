# Review Figade on your computer

This package contains the updated source and a ready-built local preview. It is
based on GitHub commit `ffeab38fccde67e9b8e5163bd47cd7c1dada117d`.
Nothing has been pushed to GitHub or deployed to Cloudflare.

## Open the ready-built preview

1. Extract the ZIP into a new folder, separate from your existing checkout.
2. Have Node.js 22 or newer installed.
3. Open a terminal in the extracted `figade-review` folder and run:

   ```sh
   node scripts/serve-built.cjs
   ```

4. Open **http://localhost:8080** in Chrome, Edge or Safari.
5. Leave the terminal open while testing. Press Ctrl+C to stop.

On Windows you can also double-click `start-preview.bat`. On macOS you can run
`bash start-preview.command` in Terminal. The terminal command above works on
Windows, macOS and Linux.

Do not double-click `_site/index.html`: the tools need a local HTTP server to
load their scripts and video library correctly. The included preview does not
load analytics or advertising. Media stays on your device; if the bundled video
library cannot load, the existing jsDelivr fallback still needs internet access.

## Edit and preview source

```sh
npm ci
npm start
```

This rebuilds the pages and reloads them when source files change. It also
disables analytics and ads locally. Use the same localhost URL. Stop the
ready-built preview before running this command, so the port is available.

## What changed

This fourth review also updates the shared shell on every page, widens the size
guide table and Guides index, groups the size guide notes into desktop columns,
and keeps prose at a separate readable measure. The size table is now generated
from the same rule as the tool.

The previous review replaces the narrow, vertically stacked tool with a desktop
workspace: settings on the left and result on the right, stacking on mobile.
The selected-file picker becomes smaller, download appears beside the settings,
and file details, guides and FAQs are collapsed. The existing colours and fonts
remain. This layout needs your visual review at desktop and mobile widths.

The earlier additions are also included:

- Optional video start/end times, with size estimates based on the kept section.
- Optional image width/height, with proportional resizing, white margins or
  centered cropping. Exact dimensions are kept even when the requested KB limit
  is too small; the tool explains the conflict instead of silently shrinking.
- The existing Figade mark in the header, quieter optional controls and clearer
  successful-size feedback.
- A file-privacy explanation, browser network inspection steps, and hashes for
  the processing scripts actually served by that build.
- Clear public-source-for-verification wording. The restrictive licence remains
  unchanged; this is not an open-source licence or an independent security audit.

- Custom, keyboard-accessible file selection and a selected-file summary.
- Discord, WhatsApp and email presets inside the video tool. Their target sizes
  come from the existing destination pages; limits have not been re-researched.
- More precise maximum-size wording, plus JPG/transparency guidance at the point
  of use.
- Settings and file selection are locked while processing. Video compression and
  conversion can be cancelled, including during preparation.
- Results show original size, output size, percentage change, dimensions, sound
  status, a preview, and download/share actions where supported.
- Audio removal is a visible warning beside the result, rather than only a log entry.
- Reset controls, progress semantics, accessible selected presets, a skip link,
  and reduced-motion-aware scrolling.
- Resource cleanup for result URLs, video inspection inputs, old image bitmaps,
  and temporary image canvases.
- Processing-time copy no longer promises every file will take seconds.

The compression size/resolution algorithm, page URLs, deployment provider, and
existing colour/font direction remain in place.

## Test before approving

Try these with files you are comfortable testing:

1. **Video:** select a short MP4 with sound, set a size smaller than the original,
   compress, download, and play the downloaded file. Confirm size and sound.
2. **Presets:** select each destination, then a custom size. Check the displayed
   maximum and selected buttons. Email uses the existing 15 MB target;
   WhatsApp uses the existing 16 MB target, not a promise that WhatsApp won't
   re-compress it.
3. **Cancellation:** start a long video job and cancel. Then retry. While running,
   the file picker and settings should be disabled and drops ignored.
4. **Image:** compress a photo to 100 KB and 20 KB. Check the download is JPG,
   dimensions are shown, and it fits the maximum. Try a transparent PNG and
   confirm the background becomes white.
5. **Converter:** try MOV, MKV or WebM. Play the downloaded MP4 and check sound.
   Some codecs are browser-dependent; check another browser when needed.
6. **Errors:** try a corrupt file, an unsupported format, and an empty/zero size.
   The tool should explain the issue without downloading a stale previous result.
7. **Layout:** narrow your browser to about 375 pixels, zoom to 200%, switch your
   operating system between light and dark, and navigate with Tab/Enter.
8. **Repeat:** use “Choose another…” and process a second file. The old preview
   and result should disappear.

Also test trimming a video from 2 seconds to 6 seconds, then play the download.
Try a square 300 × 300 image using both white margins and crop-to-fill, then
check its downloaded dimensions. Set only the width to verify proportional
resizing. Open “How file privacy works” and follow its Network-panel steps.

## Validation performed here

The production build, JavaScript syntax checks, local-link checks and automated
43 automated tests passed. The workflow tests use simulated codecs/canvas to
exercise UI state, cancellation, warnings, presets, trim budgets, image geometry,
script hashes and resource cleanup. Additional checks cover all 30 generated HTML
pages, all 18 tool-page completion/reset flows, shared page structure, all local
HTTP routes and assets, unique IDs, accessible labels and structured data.
These are not rendered viewport or real-codec tests. They
do not certify real encoding quality or browser compatibility.

The review environment blocked its browser from opening localhost, so visual
screenshots and real media encoding still need your local review. No performance
score or device compatibility result is claimed.

To repeat the automated checks after installing dependencies:

```sh
npm test
```

## When you are happy with it

Keep this copy separate until you approve it. Do not push your production branch
while reviewing: your existing Cloudflare setup deploys on a production push.
The changes can be copied to a review branch in your existing checkout. Commit
source files, scripts and tests; leave `_site` and `node_modules` uncommitted.
For a production build, use `npm run build`, which restores normal analytics and
advertising configuration. Do not upload the included review `_site` as a final
production build.

Let Codex know what you want adjusted after testing; deployment can follow once
the result is approved.
