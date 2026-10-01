# Adding a design

A design is one folder with one `index.js`. The site's pages, option panel,
storefront clip and checkout are all generated from it.

1. Copy the closest existing design folder, e.g. `designs/follow-card/` to
   `designs/my-design/`.
2. Edit `index.js` (the contract is below).
3. Import it in `catalogue.js` and add it to `designs`.
4. Add a product to `store.config.js` with its own `variantId` and `checkoutId`.
5. Add its id to a pack in `packs/` if it belongs to one. Everyone who already
   bought that pack gets it automatically.
6. Run `npm run dev`, polish it, then add its times to `tests/golden.spec.js`
   and create its reference frames:
   `UPDATE_GOLDEN=1 npx playwright test golden --project=desktop`.

## The contract

```js
export default defineDesign({
  id: 'my-design',              // lowercase-with-dashes, used in URLs and files
  name: 'My design',
  blurb: 'One sentence for the page.',
  duration: 5,                  // seconds
  poster: 2.5,                  // a representative moment
  showcase: { x, y, w, h },     // 16:9 region the storefront zooms to
  options: {                    // builds the Effect controls panel
    name: opt.text({ label: 'Channel name', default: '…', shared: 'name' }),
    subs: opt.subscribers({ shared: 'subs' }),
    avatar: opt.image({ shared: 'avatar' }),
    theme: opt.choice([...], { label: 'Card', shared: 'theme' }),
    accent: opt.colour({ shared: 'accent' }),
  },
  sounds: (o) => [{ at: 1.9, sfx: 'click' }],   // click, pop, bell, whoosh
  fonts: (o) => [{ font: NAME_FONT, text: o.name }], // loaded before rendering
  prepare(o, ctx, frame) { /* measure text, fix layout; return a scene */ },
  render(ctx, t, scene, frame) { /* draw the moment t */ },
});
```

Rules that keep preview and export identical:

- `render` depends only on `t` and the scene. No `Date.now()`, no
  `Math.random()` (use `rng(seed)`), no state carried between frames.
- Draw in design units (1920×1080). The engine scales for previews and exports
  and adds motion blur and the watermark; designs never do either.
- Options with `shared` keys are typed once and fill every design that uses them.
- Use `font(weight, px)` for text so names in other scripts get fallback fonts.

Useful helpers in `engine/`: `spring`, `tween`, `ease.*`, `press`, `wiggle`
(motion.js); `fx.drawCard`, `fx.revealLine`, `fx.drawAvatarCircle`,
`fx.cursorTrack` + `fx.drawCursor`, `fx.ripple`, `fx.drawBurst`,
`fx.drawBellIcon`, `fx.drawIcon` (fx/); `cardMotion` and the themes in
`packs/studio.js`.
