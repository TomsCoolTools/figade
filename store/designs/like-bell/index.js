// Like + bell reminder: a card with your message pops up, the cursor likes
// (thumb kicks back and fills in your accent colour with a small burst), then
// rings the bell, and the card drops away.

import { defineDesign, opt, fx, font, truncate, initialsOf, colourFor, roundRect, clamp, lerp, ease, tween,
  spring, press, wiggle } from '../../engine/index.js';
import { style, themeOf, cardMotion } from '../../packs/studio.js';

const T = {
  cardIn: 0.1,
  avatar: 0.3,
  msg: 0.44,
  name: 0.54,
  like: 0.72,
  bell: 0.86,
  cursorIn: 1.06,
  cursorArrive: 1.74,
  click1: 1.88,
  liked: 1.93,
  cursorToBell: 2.5,
  cursorAtBell: 2.92,
  click2: 3.02,
  ring: 3.09,
  cursorOut: 3.62,
  cursorGone: 4.4,
  cardOut: 4.3,
};

const S = { pad: 26, avatar: 76, gap1: 22, gap2: 40, btnH: 60, bellD: 60, gap3: 14, iconPx: 30, textMax: 520 };
S.cardH = S.pad * 2 + S.avatar;

const MSG_FONT = font(500, 32);
const NAME_FONT = font(400, 23);
const LABEL_FONT = font(500, 25);
const LABELS = ['Like', 'Liked'];

function layout(sc) {
  const textX = S.pad + S.avatar + S.gap1;
  const likeX = textX + sc.textW + S.gap2;
  const bellCX = likeX + sc.likeW1 + S.gap3 + S.bellD / 2;
  const cardW = bellCX + S.bellD / 2 + S.pad;
  const cardX = sc.o.position === 'left' ? style.margin : (sc.frame.w - cardW) / 2;
  const cardY = sc.frame.h - style.margin - S.cardH;
  return { textX, likeX, likeY: (S.cardH - S.btnH) / 2, bellCX, bellCY: S.cardH / 2, cardW, cardX, cardY };
}

function drawLike(ctx, t, sc, L) {
  const { theme } = sc;
  const inP = spring(t - T.like, 2.0, 0.52);
  if (inP <= 0) return;
  const w = lerp(sc.likeW0, sc.likeW1, spring(t - T.liked, 2.4, 0.82));
  const h = S.btnH;
  const scale = lerp(0.45, 1, inP) * (1 - 0.06 * press(t, T.click1));
  const hoverP = tween(t, T.cursorArrive - 0.12, 0.2, ease.easy) * (1 - tween(t, T.cursorToBell, 0.15, ease.easy));

  ctx.save();
  ctx.globalAlpha *= clamp(inP * 2.5);
  ctx.translate(L.likeX + w / 2, L.likeY + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  roundRect(ctx, 0, 0, w, h, h / 2);
  ctx.fillStyle = theme.neutral;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (hoverP > 0) {
    ctx.globalAlpha *= hoverP;
    ctx.fillStyle = theme.hover;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha /= hoverP;
  }
  fx.ripple(ctx, t, { at: T.click1, x: sc.thumbX + 10, y: h / 2 + 14, r0: 8, r1: w * 1.1, grow: 0.45, fadeDelay: 0.04, fadeDur: 0.36, rgb: theme.press, alpha: theme.pressAlpha });

  // Label swaps "Like" -> "Liked" like the subscribe button does.
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.neutralFg;
  const lx = sc.thumbX + S.iconPx / 2 + 12;
  const base = h / 2 + 25 * 0.355;
  const oldP = tween(t, T.liked - 0.02, 0.12, ease.inCubic);
  const newP = tween(t, T.liked + 0.08, 0.45, ease.outExpo);
  if (oldP < 1) {
    ctx.globalAlpha *= 1 - oldP;
    ctx.fillText(LABELS[0], lx, base - oldP * 16);
    ctx.globalAlpha /= 1 - oldP;
  }
  if (newP > 0) {
    ctx.globalAlpha *= newP;
    ctx.fillText(LABELS[1], lx, base + (1 - newP) * 18);
    ctx.globalAlpha /= newP;
  }
  ctx.restore();

  // Thumb: kicks back, pops and fills with the accent colour.
  const d = t - T.liked;
  const pop = d > 0 ? 1 + 0.32 * Math.sin(Math.PI * clamp(d / 0.3)) : 1;
  const angle = wiggle(t, T.liked, -0.5, 2.1, 5.2);
  const fillP = tween(t, T.liked, 0.08, ease.easy);
  ctx.save();
  ctx.translate(sc.thumbX, h / 2);
  // Pivot near the wrist so it rocks like a real thumb.
  ctx.translate(-6, 8);
  ctx.rotate(angle);
  ctx.scale(pop, pop);
  ctx.translate(6, -8);
  if (fillP < 1) {
    ctx.globalAlpha *= 1 - fillP;
    fx.drawIcon(ctx, 'thumbUpOutline', S.iconPx, theme.neutralFg);
    ctx.globalAlpha /= 1 - fillP;
  }
  if (fillP > 0) {
    ctx.globalAlpha *= fillP;
    fx.drawIcon(ctx, 'thumbUp', S.iconPx, sc.accent);
  }
  ctx.restore();
  ctx.restore();
}

function drawBellButton(ctx, t, sc, L) {
  const { theme } = sc;
  const inP = spring(t - T.bell, 2.3, 0.5);
  if (inP <= 0) return;
  const scale = lerp(0.2, 1, inP) * (1 - 0.09 * press(t, T.click2));
  const hoverP = tween(t, T.cursorAtBell - 0.1, 0.18, ease.easy) * (1 - tween(t, T.cursorOut, 0.25, ease.easy));
  const r = S.bellD / 2;
  ctx.save();
  ctx.globalAlpha *= clamp(inP * 3);
  ctx.translate(L.bellCX, L.bellCY);
  ctx.scale(scale, scale);
  ctx.rotate((1 - inP) * -0.5);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.iconBg;
  ctx.fill();
  if (hoverP > 0) {
    ctx.save();
    ctx.globalAlpha *= hoverP;
    ctx.fillStyle = theme.hover;
    ctx.fill();
    ctx.restore();
  }
  if (t - T.click2 > 0 && t - T.click2 < 0.9) {
    ctx.save();
    ctx.clip();
    fx.ripple(ctx, t, { at: T.click2, x: 13, y: 15, r0: 6, r1: r * 1.8, grow: 0.5, fadeDelay: 0.1, fadeDur: 0.5, rgb: theme.press, alpha: theme.pressAlpha });
    ctx.restore();
  }
  fx.drawBellIcon(ctx, t, { ringAt: T.ring, colour: theme.icon, size: 32 });
  ctx.restore();
}

export default defineDesign({
  id: 'like-bell',
  name: 'Like + bell reminder',
  blurb: 'Your message pops up, the cursor hits like, then rings the bell.',
  duration: 5,
  poster: 2.3,
  options: {
    message: opt.text({ label: 'Message', default: 'Enjoying the video?', max: 40 }),
    name: opt.text({ label: 'Channel name', default: "Tom's Cool Tools", shared: 'name' }),
    avatar: opt.image({ shared: 'avatar' }),
    theme: opt.choice([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], { label: 'Card', shared: 'theme' }),
    accent: opt.colour({ shared: 'accent' }),
    position: opt.choice([{ value: 'center', label: 'Bottom centre' }, { value: 'left', label: 'Bottom left' }], { label: 'Position' }),
  },
  sounds: () => [
    { at: T.cardIn, sfx: 'whoosh' },
    { at: T.click1, sfx: 'click' },
    { at: T.liked, sfx: 'pop' },
    { at: T.click2, sfx: 'click' },
    { at: T.ring, sfx: 'bell' },
    { at: T.cardOut + 0.1, sfx: 'whoosh' },
  ],
  fonts: (o) => [
    { font: MSG_FONT, text: o.message },
    { font: NAME_FONT, text: o.name },
    { font: font(500, 30), text: initialsOf(o.name || 'Your Channel') },
  ],

  prepare(o, ctx, frame) {
    ctx.save();
    ctx.font = MSG_FONT;
    const message = truncate(ctx, o.message || 'Enjoying the video?', S.textMax);
    const msgW = ctx.measureText(message).width;
    ctx.font = NAME_FONT;
    const name = truncate(ctx, o.name || 'Your Channel', S.textMax);
    const nameW = ctx.measureText(name).width;
    ctx.font = LABEL_FONT;
    const lab0 = ctx.measureText(LABELS[0]).width, lab1 = ctx.measureText(LABELS[1]).width;
    ctx.restore();
    const thumbX = 24 + S.iconPx / 2;
    const sc = {
      o,
      frame,
      theme: themeOf(o.theme),
      message,
      name,
      textW: Math.ceil(Math.max(msgW, nameW, 120)),
      thumbX,
      likeW0: Math.ceil(thumbX + S.iconPx / 2 + 12 + lab0 + 28),
      likeW1: Math.ceil(thumbX + S.iconPx / 2 + 12 + lab1 + 28),
      accent: o.accent,
      initials: initialsOf(o.name || 'Your Channel'),
      initialsBg: colourFor(o.name || 'Your Channel'),
      particles: fx.makeParticles(5150, 18),
    };
    const L = layout(sc);
    const p1 = { x: L.cardX + L.likeX + thumbX + 10, y: L.cardY + L.likeY + S.btnH / 2 + 14 };
    const p2 = { x: L.cardX + L.bellCX + 13, y: L.cardY + L.bellCY + 15 };
    sc.L = L;
    sc.thumbCentre = { x: L.cardX + L.likeX + thumbX, y: L.cardY + L.likeY + S.btnH / 2 };
    sc.cursor = fx.cursorTrack([
      { start: T.cursorIn, end: T.cursorArrive, from: { x: p1.x + 420, y: p1.y + 300 }, ctrl: { x: p1.x + 340, y: p1.y + 40 }, to: p1, ease: ease.glide },
      { start: T.cursorToBell, end: T.cursorAtBell, from: p1, ctrl: { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) - 40 }, to: p2, ease: ease.glide },
      { start: T.cursorOut, end: T.cursorGone, from: p2, ctrl: { x: p2.x + 40, y: p2.y + 200 }, to: { x: p2.x + 380, y: p2.y + 340 }, ease: ease.inOutCubic },
    ]);
    return sc;
  },

  render(ctx, t, sc) {
    const L = sc.L;
    const m = cardMotion(t, T.cardIn, T.cardOut, S.cardH);
    if (m.alpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = m.alpha;
      ctx.translate(L.cardX + L.cardW / 2, L.cardY + S.cardH + m.dy);
      ctx.scale(m.scale, m.scale);
      ctx.translate(-L.cardW / 2, -S.cardH);
      fx.drawCard(ctx, L.cardW, S.cardH, style.radius, { fill: sc.theme.card, border: sc.theme.border });

      const p = spring(t - T.avatar, 2.1, 0.55);
      if (p > 0) {
        const r = S.avatar / 2;
        ctx.save();
        ctx.globalAlpha *= clamp(p * 3);
        ctx.translate(S.pad + r, S.pad + r);
        ctx.scale(p, p);
        fx.drawAvatarCircle(ctx, r, { image: sc.o.avatar, initials: sc.initials, bg: sc.initialsBg, fontPx: fx.initialsPx(r, sc.initials) });
        ctx.restore();
      }
      const cy = S.cardH / 2;
      fx.revealLine(ctx, t, { start: T.msg, text: sc.message, font: MSG_FONT, colour: sc.theme.name, x: L.textX, baseline: cy - 3, rise: 32, maskWidth: S.textMax });
      fx.revealLine(ctx, t, { start: T.name, text: sc.name, font: NAME_FONT, colour: sc.theme.subs, x: L.textX, baseline: cy + 29, rise: 24, maskWidth: S.textMax });
      drawLike(ctx, t, sc, L);
      drawBellButton(ctx, t, sc, L);
      ctx.restore();
    }
    fx.drawBurst(ctx, t, T.liked + 0.02, sc.thumbCentre, sc.accent, sc.particles, { scale: 0.62 });
    const alpha = tween(t, T.cursorIn, 0.18, ease.easy) * (1 - tween(t, T.cursorGone - 0.3, 0.3, ease.easy));
    fx.drawCursor(ctx, t, sc.cursor, { alpha, press: Math.max(press(t, T.click1), press(t, T.click2)) });
  },
});
