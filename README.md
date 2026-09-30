# figade

A free video compressor that shrinks a video to the file size you choose, such as
20MB for Discord or 15MB for email. It runs in your browser, so your video is never
uploaded.

**[figade.com](https://figade.com)**

## How it works

- The browser re-encodes the video with its built-in video encoder (WebCodecs), using
  [Mediabunny](https://github.com/Vanilagy/mediabunny) to read and write the file.
- The size you pick sets how much data each second of video can have. The tool then
  picks the highest resolution that still gets about 0.07 bits per pixel, so a long
  video at a small size is scaled down rather than turned blocky.
- If the result is too big, or much smaller than it needed to be, it adjusts and tries
  again, up to four times.
- Nothing is sent to a server. You can check this in [`static/js/app.js`](static/js/app.js),
  which is the whole compressor.

It works in current versions of Chrome, Edge and Safari.

## Running it locally

You need [Node.js](https://nodejs.org).

    npm install
    npm start

Then open http://localhost:8080. The site is built with [Eleventy](https://www.11ty.dev)
and hosted on Cloudflare Pages. [`EDITING.md`](EDITING.md) explains where everything is
and how to change it.

## Licence

The code is published so anyone can see how figade works and check that nothing is
uploaded. It is not open source: all rights are reserved, and it may not be copied,
reused or hosted elsewhere without permission. See [LICENSE](LICENSE).

Mediabunny is used under the Mozilla Public License 2.0, and the heading font is a
modified copy of Source Serif 4 under the SIL Open Font License
([`static/fonts/OFL.txt`](static/fonts/OFL.txt)).

Made by Tom. Questions or problems: [hello@figade.com](mailto:hello@figade.com).
