// Lower third: an accent bar grows, the name plate wipes out from behind it,
// then the avatar, name and title arrive in a staggered build. It holds, then
// everything leaves in reverse order. Broadcast timing, no cursor.

import { defineDesign, opt, fx, font, truncate, initialsOf, colourFor, fillTextLeft, clamp, lerp, ease, tween,
  spring } from '../../engine/index.js';
import { themeOf } from '../../packs/studio.js';

const T = {
  bar: 0.12,
  plate: 0.3,
  avatar: 0.48,
  name: 0.56,
  title: 0.68,
  line: 0.8,
  titleOut: 3.86,
  nameOut: 3.94,
  avatarOut: 4.0,
  plateOut: 4.06,
  barOut: 4.44,
};

const S = { x: 120, bottom: 132, h: 136, bar: 10, pad: 24, avatar: 88, gap: 26, padR: 44, radius: 18, textMax: 820 };

const NAME_FONT = font(500, 50);
const TITLE_FONT = font(400, 28);

// A line of text that rises out of a mask on the way in and up into it on the way out.
function maskedLine(ctx, t, { inAt, outAt, text, fnt, colour, x, baseline, rise }) {
  const pin = tween(t, inAt, 0.7, ease.outExpo);
  const pout = tween(t, outAt, 0.28, ease.inCubic);
  if (pin <= 0 || pout >= 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 6, baseline - rise - 16, S.textMax + 12, rise + 30);
  ctx.clip();
  ctx.globalAlpha *= clamp(pin * 1.6) * (1 - pout);
  ctx.font = fnt;
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic';
  fillTextLeft(ctx, text, x, baseline + (1 - pin) * (rise + 14) - pout * (rise + 14));
  ctx.restore();
}

export default defineDesign({
  id: 'lower-third',
  name: 'Lower third',
  blurb: 'Your name and a title line wipe in at the bottom of the screen, broadcast style.',
  duration: 5,
  poster: 2.4,
  showcase: { x: 0, y: 500, w: 1024, h: 576 },
  options: {
    name: opt.text({ label: 'Name', default: "Tom's Cool Tools", shared: 'name' }),
    title: opt.text({ label: 'Title line', default: 'New tech reviews every Friday', max: 60 }),
    avatar: opt.image({ shared: 'avatar' }),
    picture: opt.choice([{ value: 'show', label: 'With picture' }, { value: 'hide', label: 'Name only' }], { label: 'Picture' }),
    theme: opt.choice([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], { label: 'Plate', shared: 'theme' }),
    accent: opt.colour({ shared: 'accent' }),
  },
  sounds: () => [
    { at: T.plate - 0.04, sfx: 'whoosh' },
    { at: T.plateOut, sfx: 'whoosh' },
  ],
  fonts: (o) => [
    { font: NAME_FONT, text: o.name },
    { font: TITLE_FONT, text: o.title },
    { font: font(500, 34), text: initialsOf(o.name || 'Your Channel') },
  ],

  prepare(o, ctx, frame) {
    ctx.save();
    ctx.font = NAME_FONT;
    const name = truncate(ctx, o.name || 'Your Channel', S.textMax);
    const nameW = ctx.measureText(name).width;
    ctx.font = TITLE_FONT;
    const title = truncate(ctx, o.title || '', S.textMax);
    const titleW = ctx.measureText(title).width;
    ctx.restore();
    const showAvatar = o.picture !== 'hide';
    const textX = S.pad + (showAvatar ? S.avatar + S.gap : 6);
    const plateW = Math.ceil(textX + Math.max(nameW, titleW, 160) + S.padR);
    return {
      o,
      frame,
      theme: themeOf(o.theme),
      name,
      title,
      showAvatar,
      textX,
      plateW,
      x: S.x,
      y: frame.h - S.bottom - S.h,
      accent: o.accent,
      initials: initialsOf(o.name || 'Your Channel'),
      initialsBg: colourFor(o.name || 'Your Channel'),
    };
  },

  render(ctx, t, sc) {
    const { theme } = sc;
    const barIn = spring(t - T.bar, 2.2, 0.72);
    const barOut = tween(t, T.barOut, 0.32, ease.inCubic);
    const barH = S.h * barIn * (1 - barOut);
    if (barH <= 0.5) return;

    ctx.save();
    ctx.translate(sc.x, sc.y);

    // Plate: wipes out from behind the bar, and back in when leaving.
    const wipe = tween(t, T.plate, 0.75, ease.outExpo) * (1 - tween(t, T.plateOut, 0.42, ease.inCubic));
    if (wipe > 0) {
      const pw = sc.plateW * wipe;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(S.bar, 0, pw, S.h, [0, S.radius, S.radius, 0]);
      ctx.fillStyle = theme.card;
      ctx.shadowColor = 'rgba(0,0,0,0.30)';
      ctx.shadowBlur = 56;
      ctx.shadowOffsetY = 20;
      ctx.fill();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(S.bar, 0, pw, S.h, [0, S.radius, S.radius, 0]);
      ctx.clip();
      ctx.translate(S.bar, 0);

      // Hairline in the accent colour sweeping along the bottom edge.
      const lp = tween(t, T.line, 0.9, ease.outExpo) * (1 - tween(t, T.titleOut, 0.4, ease.inCubic));
      if (lp > 0) {
        ctx.fillStyle = sc.accent;
        ctx.fillRect(0, S.h - 4, sc.plateW * lp, 4);
      }

      if (sc.showAvatar) {
        const ap = spring(t - T.avatar, 2.1, 0.55) * (1 - tween(t, T.avatarOut, 0.25, ease.inCubic));
        if (ap > 0) {
          const r = S.avatar / 2;
          ctx.save();
          ctx.globalAlpha *= clamp(ap * 3);
          ctx.translate(S.pad + r, S.h / 2);
          ctx.scale(ap, ap);
          fx.drawAvatarCircle(ctx, r, { image: sc.o.avatar, initials: sc.initials, bg: sc.initialsBg, fontPx: fx.initialsPx(r, sc.initials) });
          ctx.restore();
        }
      }
      const cy = S.h / 2;
      maskedLine(ctx, t, { inAt: T.name, outAt: T.nameOut, text: sc.name, fnt: NAME_FONT, colour: theme.name, x: sc.textX, baseline: cy - 4, rise: 50 });
      if (sc.title) maskedLine(ctx, t, { inAt: T.title, outAt: T.titleOut, text: sc.title, fnt: TITLE_FONT, colour: theme.subs, x: sc.textX, baseline: cy + 34, rise: 28 });
      ctx.restore();
    }

    // Accent bar, growing from its centre.
    ctx.fillStyle = sc.accent;
    ctx.fillRect(0, (S.h - barH) / 2, S.bar, barH);
    ctx.restore();
  },
});
