// Follow card: avatar with an accent ring that draws itself in, name and
// @handle, and a Follow pill. The cursor clicks it: the pill turns into
// "Following" with a check mark that draws in, plus a burst. No platform logos.

import { defineDesign, opt, fx, font, truncate, formatHandle, initialsOf, colourFor, mixHex, readableOn,
  roundRect, clamp, lerp, ease, tween, spring, press } from '../../engine/index.js';
import { style, themeOf, cardMotion } from '../../packs/studio.js';

const T = {
  cardIn: 0.1,
  avatar: 0.3,
  ring: 0.42,
  name: 0.46,
  handle: 0.56,
  button: 0.74,
  cursorIn: 1.1,
  cursorArrive: 1.8,
  click: 1.94,
  swap: 2.0,
  check: 2.08,
  cursorOut: 2.9,
  cursorGone: 3.7,
  cardOut: 4.3,
};

const S = { pad: 30, avatar: 108, ring: 5, gap1: 28, gap2: 44, btnH: 62, padX: 34, textMax: 560 };
S.cardH = S.pad * 2 + S.avatar;

const NAME_FONT = font(500, 36);
const HANDLE_FONT = font(400, 25);
const LABEL_FONT = font(500, 26);
const LABELS = ['Follow', 'Following'];
const CHECK = 26; // check mark size in px, drawn before "Following"

function layout(t, sc) {
  const btnW = lerp(sc.w0, sc.w1, spring(t - T.swap, 2.4, 0.82, sc.w1 - sc.w0));
  const textX = S.pad + S.avatar + S.gap1;
  const btnX = textX + sc.textW + S.gap2;
  const cardW = btnX + btnW + S.pad;
  const cardX = sc.o.position === 'left' ? style.margin : (sc.frame.w - cardW) / 2;
  const cardY = sc.frame.h - style.margin - S.cardH;
  return { textX, btnX, btnY: (S.cardH - S.btnH) / 2, btnW, cardW, cardX, cardY };
}

function drawAvatar(ctx, t, sc) {
  const p = spring(t - T.avatar, 2.1, 0.55, S.avatar / 2);
  if (p <= 0) return;
  const r = S.avatar / 2;
  ctx.save();
  ctx.globalAlpha *= clamp(p * 3);
  ctx.translate(S.pad + r, S.pad + r);
  ctx.scale(p, p);
  // Accent ring sweeps round the avatar, the picture sits inside it.
  const rp = tween(t, T.ring, 0.75, ease.outExpo);
  if (rp > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r - S.ring / 2, -Math.PI / 2, -Math.PI / 2 + rp * Math.PI * 2);
    ctx.strokeStyle = sc.accent;
    ctx.lineWidth = S.ring;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  fx.drawAvatarCircle(ctx, r - S.ring - 4, { image: sc.o.avatar, initials: sc.initials, bg: sc.initialsBg, fontPx: fx.initialsPx(r - S.ring - 4, sc.initials) });
  ctx.restore();
}

function drawButton(ctx, t, sc, L) {
  const { theme } = sc;
  const inP = spring(t - T.button, 2.0, 0.52, sc.w1);
  if (inP <= 0) return;
  const w = L.btnW, h = S.btnH;
  const scale = lerp(0.45, 1, inP) * (1 - 0.06 * press(t, T.click));
  const swapP = tween(t, T.swap, 0.18, ease.easy);
  const hoverP = tween(t, T.cursorArrive - 0.12, 0.2, ease.easy) * (1 - tween(t, T.cursorOut, 0.2, ease.easy));

  ctx.save();
  ctx.globalAlpha *= clamp(inP * 2.5);
  ctx.translate(L.btnX + w / 2, L.btnY + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  roundRect(ctx, 0, 0, w, h, h / 2);
  ctx.fillStyle = mixHex(sc.accent, theme.neutral, swapP);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (hoverP > 0) {
    ctx.globalAlpha *= hoverP;
    ctx.fillStyle = swapP < 0.5 ? 'rgba(0,0,0,0.12)' : theme.hover;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha /= hoverP;
  }
  fx.ripple(ctx, t, { at: T.click, x: sc.w0 * 0.6, y: h * 0.56, r0: 10, r1: w * 1.05, grow: 0.45, fadeDelay: 0.04, fadeDur: 0.36, rgb: sc.accentFg === '#FFFFFF' ? '255,255,255' : '0,0,0', alpha: 0.26 });

  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'alphabetic';
  const base = h / 2 + 26 * 0.355;
  const oldP = tween(t, T.swap - 0.02, 0.12, ease.inCubic);
  const newP = tween(t, T.swap + 0.08, 0.45, ease.outExpo);
  if (oldP < 1) {
    ctx.globalAlpha *= 1 - oldP;
    ctx.textAlign = 'center';
    ctx.fillStyle = sc.accentFg;
    ctx.fillText(LABELS[0], w / 2, base - oldP * 18);
    ctx.globalAlpha /= 1 - oldP;
  }
  if (newP > 0) {
    // "Following" with the check, centred together.
    const groupW = CHECK + 10 + sc.label1W;
    const gx = (w - groupW) / 2;
    ctx.save();
    ctx.globalAlpha *= newP;
    ctx.translate(0, (1 - newP) * 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.neutralFg;
    ctx.fillText(LABELS[1], gx + CHECK + 10, base);
    // Check mark draws itself along its path.
    const cp = tween(t, T.check, 0.32, ease.outCubic);
    if (cp > 0) {
      const pts = [[0, 0.52], [0.36, 0.86], [1, 0.16]].map(([x, y]) => [gx + x * CHECK, h / 2 - CHECK / 2 + y * CHECK]);
      const seg1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      const seg2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      ctx.lineTo(...pts[1]);
      ctx.lineTo(...pts[2]);
      ctx.setLineDash([(seg1 + seg2) * cp, seg1 + seg2]);
      ctx.strokeStyle = sc.accent;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

export default defineDesign({
  id: 'follow-card',
  name: 'Follow card',
  blurb: 'Your avatar, name and handle with a Follow button that gets clicked.',
  duration: 5,
  poster: 2.6,
  options: {
    name: opt.text({ label: 'Name', default: "Tom's Cool Tools", shared: 'name' }),
    handle: opt.text({ label: 'Handle', default: '@tomscooltools', max: 32, shared: 'handle' }),
    avatar: opt.image({ shared: 'avatar' }),
    theme: opt.choice([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], { label: 'Card', shared: 'theme' }),
    accent: opt.colour({ shared: 'accent' }),
    position: opt.choice([{ value: 'center', label: 'Bottom centre' }, { value: 'left', label: 'Bottom left' }], { label: 'Position' }),
  },
  sounds: () => [
    { at: T.cardIn, sfx: 'whoosh' },
    { at: T.click, sfx: 'click' },
    { at: T.swap, sfx: 'pop' },
    { at: T.cardOut + 0.1, sfx: 'whoosh' },
  ],
  fonts: (o) => [
    { font: NAME_FONT, text: o.name },
    { font: HANDLE_FONT, text: formatHandle(o.handle, o.name) },
    { font: font(500, 38), text: initialsOf(o.name || 'Your Channel') },
  ],

  prepare(o, ctx, frame) {
    ctx.save();
    ctx.font = NAME_FONT;
    const name = truncate(ctx, o.name || 'Your Channel', S.textMax);
    const nameW = ctx.measureText(name).width;
    ctx.font = HANDLE_FONT;
    const handle = truncate(ctx, formatHandle(o.handle, o.name), S.textMax);
    const handleW = ctx.measureText(handle).width;
    ctx.font = LABEL_FONT;
    const label0W = ctx.measureText(LABELS[0]).width, label1W = ctx.measureText(LABELS[1]).width;
    ctx.restore();
    const sc = {
      o,
      frame,
      theme: themeOf(o.theme),
      name,
      handle,
      textW: Math.ceil(Math.max(nameW, handleW, 120)),
      label1W,
      w0: Math.ceil(label0W + S.padX * 2),
      w1: Math.ceil(CHECK + 10 + label1W + S.padX * 2),
      accent: o.accent,
      accentFg: readableOn(o.accent),
      initials: initialsOf(o.name || 'Your Channel'),
      initialsBg: colourFor(o.name || 'Your Channel'),
      particles: fx.makeParticles(8812, 26),
    };
    const L = layout(T.click, sc);
    const p1 = { x: L.cardX + L.btnX + sc.w0 * 0.6, y: L.cardY + L.btnY + S.btnH * 0.56 };
    sc.click = p1;
    sc.cursor = fx.cursorTrack([
      { start: T.cursorIn, end: T.cursorArrive, from: { x: p1.x + 440, y: p1.y + 300 }, ctrl: { x: p1.x + 360, y: p1.y + 30 }, to: p1, ease: ease.glide },
      { start: T.cursorOut, end: T.cursorGone, from: p1, ctrl: { x: p1.x + 60, y: p1.y + 210 }, to: { x: p1.x + 420, y: p1.y + 330 }, ease: ease.inOutCubic },
    ]);
    return sc;
  },

  render(ctx, t, sc, frame) {
    const L = layout(t, sc);
    const m = cardMotion(t, T.cardIn, T.cardOut, S.cardH);
    if (m.alpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = m.alpha;
      ctx.translate(L.cardX + L.cardW / 2, L.cardY + S.cardH + m.dy);
      ctx.scale(m.scale, m.scale);
      ctx.translate(-L.cardW / 2, -S.cardH);
      fx.drawCard(ctx, L.cardW, S.cardH, style.radius, { fill: sc.theme.card, border: sc.theme.border, shadow: frame.shadows !== false });
      drawAvatar(ctx, t, sc);
      const cy = S.cardH / 2;
      fx.revealLine(ctx, t, { start: T.name, text: sc.name, font: NAME_FONT, colour: sc.theme.name, x: L.textX, baseline: cy - 5, rise: 36, maskWidth: S.textMax });
      fx.revealLine(ctx, t, { start: T.handle, text: sc.handle, font: HANDLE_FONT, colour: sc.theme.subs, x: L.textX, baseline: cy + 31, rise: 26, maskWidth: S.textMax });
      drawButton(ctx, t, sc, L);
      ctx.restore();
    }
    fx.drawBurst(ctx, t, T.swap, sc.click, sc.accent, sc.particles);
    const alpha = tween(t, T.cursorIn, 0.18, ease.easy) * (1 - tween(t, T.cursorGone - 0.3, 0.3, ease.easy));
    fx.drawCursor(ctx, t, sc.cursor, { alpha, press: press(t, T.click) });
  },
});
