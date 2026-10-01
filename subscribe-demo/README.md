# Subscribe animation (prototype)

A standalone prototype, separate from the figade site (Eleventy doesn't build or
deploy this folder). It makes a personalised YouTube-style subscribe animation:
1920×1080, 60 fps, 5 seconds. Everything renders in the browser.

## Running it

The page uses ES modules, so it has to be served over HTTP rather than opened as a file:

    cd subscribe-demo
    python3 -m http.server 8000

Then open http://localhost:8000 in Chrome. (`npx serve` works too.)

## Using it

- Set the channel name and subscriber count. Plain numbers are formatted the way
  YouTube does (128400 → "128K subscribers"); text such as "1.2M" is used as typed.
- Upload a profile picture, or leave it empty to get initials on a coloured circle.
- Pick dark or light card, classic red or modern pill button, accent colour and position.
- Preview controls: Space plays/pauses, ← → step one frame, plus a speed control
  (0.25× is good for judging easing), background options and a motion blur toggle.

## Exports

- **Green screen MP4**: H.264 on `#00FF00`, 30 Mbps, encoded with WebCodecs and
  [Mediabunny](https://github.com/Vanilagy/mediabunny). Use Ultra Key in Premiere.
- **Transparent PNG sequence (.zip)**: 300 RGBA PNGs. In Premiere: File › Import,
  pick the first PNG and tick "Image Sequence", then set Modify › Interpret
  Footage to 60 fps. The zip includes these steps in a README.

ProRes 4444 is planned for later.

## How it's built

- `js/scene.js`: the animation. `Renderer.render(ctx, t, scene)` depends only on time, so
  preview, scrubbing and export draw identical pixels. The timeline is the `T` object.
- `js/motion.js`: easing curves (cubic-bezier, like After Effects), damped springs,
  click presses and the bell wiggle.
- `js/export.js`: MP4 and PNG-zip export. `js/zip.js`: a small zip writer.
- Motion blur averages 6 sub-frames across a 180° shutter.

Roboto is used under the SIL Open Font License (`fonts/OFL.txt`); Mediabunny
(`vendor/`) under the Mozilla Public License 2.0.
