// Subscribe pop-up: a card pops in, the cursor clicks Subscribe (ripple, label
// swap, particle burst), then rings the bell, and the card slides away.
// Ported from subscribe-demo/ — golden frames check it still matches.

import { defineDesign, opt, fx, font, truncate, formatSubscribers, initialsOf, colourFor, mixHex,
  roundRect, clamp, lerp, ease, tween, spring, press } from '../../engine/index.js';

// Timeline, in seconds.
const T = {
  cardIn: 0.1,
  avatar: 0.3,
  name: 0.44,
  subs: 0.54,
  button: 0.72,
  cursorIn: 1.08,
  cursorArrive: 1.8,
  click1: 1.94,
  swap: 2.02,
  bellSlot: 2.38,
  bellIn: 2.48,
  cursorToBell: 2.76,
  cursorAtBell: 3.22,
  click2: 3.32,
  ring: 3.39,
  cardOut: 4.3,
  cursorOut: 3.86,
  cursorGone: 4.6,
};

const S = {
  pad: 30,
  avatar: 108,
  gap1: 26,
  gap2: 44,
  btnH: 62,
  bellD: 62,
  bellGap: 14,
  radius: 34,
  margin: 92,
  nameMax: 560,
};
S.cardH = S.pad * 2 + S.avatar;

export const THEMES = {
  dark: { card: '#212121', border: 'rgba(255,255,255,0.07)', name: '#F1F1F1', subs: '#AAAAAA', icon: '#F1F1F1', iconBg: '#383838', press: '255,255,255', pressAlpha: 0.18 },
  light: { card: '#FFFFFF', border: 'rgba(0,0,0,0.07)', name: '#0F0F0F', subs: '#606060', icon: '#0F0F0F', iconBg: '#F2F2F2', press: '0,0,0', pressAlpha: 0.12 },
};

function buttonStyle(style, theme) {
  if (style === 'classic') {
    return {
      labels: ['SUBSCRIBE', 'SUBSCRIBED'],
      fontPx: 25,
      spacing: '1.2px',
      padX: 32,
      radius: 6,
      before: { bg: '#CC0000', fg: '#FFFFFF', hover: 'rgba(0,0,0,0.12)', ripple: '255,255,255' },
      after:
        theme === 'dark'
          ? { bg: '#383838', fg: '#AAAAAA', hover: 'rgba(255,255,255,0.06)' }
          : { bg: '#ECECEC', fg: '#606060', hover: 'rgba(0,0,0,0.05)' },
    };
  }
  // A white pill would vanish on a light card, so it inverts to black there.
  return {
    labels: ['Subscribe', 'Subscribed'],
    fontPx: 26,
    spacing: '0px',
    padX: 32,
    radius: S.btnH / 2,
    before:
      theme === 'dark'
        ? { bg: '#F1F1F1', fg: '#0F0F0F', hover: 'rgba(0,0,0,0.08)', ripple: '0,0,0' }
        : { bg: '#0F0F0F', fg: '#FFFFFF', hover: 'rgba(255,255,255,0.14)', ripple: '255,255,255' },
    after:
      theme === 'dark'
        ? { bg: '#383838', fg: '#F1F1F1', hover: 'rgba(255,255,255,0.06)' }
        : { bg: '#F2F2F2', fg: '#0F0F0F', hover: 'rgba(0,0,0,0.05)' },
  };
}

const NAME_FONT = font(500, 36);
const SUBS_FONT = font(400, 25);

function layout(t, sc) {
  const swapP = spring(t - T.swap, 2.4, 0.82);
  const slotP = spring(t - T.bellSlot, 2.1, 0.8);
  const btnW = lerp(sc.w0, sc.w1, swapP);
  const slot = (S.bellGap + S.bellD) * slotP;
  const textX = S.pad + S.avatar + S.gap1;
  const btnX = textX + sc.textW + S.gap2;
  const cardW = btnX + btnW + slot + S.pad;
  const cardX = sc.o.position === 'left' ? S.margin : (sc.frame.w - cardW) / 2;
  const cardY = sc.frame.h - S.margin - S.cardH;
  const btnY = (S.cardH - S.btnH) / 2;
  return { cardX, cardY, cardW, textX, btnX, btnY, btnW, bellCX: btnX + btnW + S.bellGap + S.bellD / 2, bellCY: S.cardH / 2 };
}

function drawCardLayer(ctx, t, sc, L) {
  const inP = spring(t - T.cardIn, 1.45, 0.68);
  const outP = tween(t, T.cardOut, 0.6, ease.inBack);
  const alpha = tween(t, T.cardIn, 0.22, ease.outCubic) * (1 - tween(t, T.cardOut + 0.32, 0.28, ease.inCubic));
  if (alpha <= 0.001) return;
  const dy = (1 - inP) * (S.cardH + 150) + outP * (S.cardH + 180);
  const scale = lerp(0.9, 1, inP) * lerp(1, 0.95, outP);

  ctx.save();
  ctx.globalAlpha = alpha;
  // Scale about the bottom centre of the card, like a layer anchor point.
  ctx.translate(L.cardX + L.cardW / 2, L.cardY + S.cardH + dy);
  ctx.scale(scale, scale);
  ctx.translate(-L.cardW / 2, -S.cardH);
  fx.drawCard(ctx, L.cardW, S.cardH, S.radius, { fill: sc.theme.card, border: sc.theme.border });

  // Avatar
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

  // Name and subscriber count
  const cy = S.cardH / 2;
  fx.revealLine(ctx, t, { start: T.name, text: sc.name, font: NAME_FONT, colour: sc.theme.name, x: L.textX, baseline: cy - 5, rise: 36, maskWidth: S.nameMax });
  if (sc.subs) fx.revealLine(ctx, t, { start: T.subs, text: sc.subs, font: SUBS_FONT, colour: sc.theme.subs, x: L.textX, baseline: cy + 31, rise: 26, maskWidth: S.nameMax });

  drawButton(ctx, t, sc, L);
  drawBell(ctx, t, sc, L);
  ctx.restore();
}

function drawButton(ctx, t, sc, L) {
  const { btn } = sc;
  const inP = spring(t - T.button, 2.0, 0.52);
  if (inP <= 0) return;
  const scale = lerp(0.45, 1, inP) * (1 - 0.06 * press(t, T.click1));
  const w = L.btnW;
  const h = S.btnH;
  const swapP = tween(t, T.swap, 0.16, ease.easy);
  const hoverP = tween(t, T.cursorArrive - 0.12, 0.2, ease.easy) * (1 - tween(t, T.cursorToBell, 0.15, ease.easy));

  ctx.save();
  ctx.globalAlpha *= clamp(inP * 2.5);
  ctx.translate(L.btnX + w / 2, L.btnY + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);

  roundRect(ctx, 0, 0, w, h, btn.radius);
  ctx.fillStyle = mixHex(btn.before.bg, btn.after.bg, swapP);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (hoverP > 0) {
    ctx.globalAlpha *= hoverP;
    ctx.fillStyle = swapP < 0.5 ? btn.before.hover : btn.after.hover;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha /= hoverP;
  }
  fx.ripple(ctx, t, { at: T.click1, x: sc.w0 * 0.6, y: h * 0.56, r0: 10, r1: w * 1.05, grow: 0.45, fadeDelay: 0.04, fadeDur: 0.36, rgb: btn.before.ripple, alpha: 0.26 });

  // Label: old slides up and out, new rises in with a hair of delay.
  ctx.font = font(500, btn.fontPx);
  ctx.letterSpacing = btn.spacing;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const base = h / 2 + btn.fontPx * 0.355;
  const oldP = tween(t, T.swap - 0.02, 0.12, ease.inCubic);
  const newP = tween(t, T.swap + 0.08, 0.45, ease.outExpo);
  if (oldP < 1) {
    ctx.globalAlpha *= 1 - oldP;
    ctx.fillStyle = btn.before.fg;
    ctx.fillText(btn.labels[0], w / 2, base - oldP * 18);
    ctx.globalAlpha /= 1 - oldP;
  }
  if (newP > 0) {
    ctx.globalAlpha *= newP;
    ctx.fillStyle = btn.after.fg;
    ctx.fillText(btn.labels[1], w / 2, base + (1 - newP) * 20);
  }
  ctx.restore();
  ctx.restore();
}

function drawBell(ctx, t, sc, L) {
  const inP = spring(t - T.bellIn, 2.3, 0.5);
  if (inP <= 0) return;
  const { theme, btn } = sc;
  const scale = lerp(0.2, 1, inP) * (1 - 0.09 * press(t, T.click2));
  const hoverP = tween(t, T.cursorAtBell - 0.1, 0.18, ease.easy) * (1 - tween(t, T.cursorOut, 0.25, ease.easy));

  ctx.save();
  ctx.globalAlpha *= clamp(inP * 3);
  ctx.translate(L.bellCX, L.bellCY);
  ctx.scale(scale, scale);
  ctx.rotate((1 - inP) * -0.5);

  const r = S.bellD / 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.iconBg;
  ctx.fill();
  if (hoverP > 0) {
    ctx.save();
    ctx.globalAlpha *= hoverP;
    ctx.fillStyle = btn.after.hover;
    ctx.fill();
    ctx.restore();
  }
  if (t - T.click2 > 0 && t - T.click2 < 0.9) {
    ctx.save();
    ctx.clip();
    fx.ripple(ctx, t, { at: T.click2, x: 13, y: 15, r0: 6, r1: r * 1.8, grow: 0.5, fadeDelay: 0.1, fadeDur: 0.5, rgb: theme.press, alpha: theme.pressAlpha });
    ctx.restore();
  }
  fx.drawBellIcon(ctx, t, { ringAt: T.ring, colour: theme.icon, size: 34 });
  ctx.restore();
}

export default defineDesign({
  id: 'subscribe-pop',
  name: 'Subscribe pop-up',
  blurb: 'Your card pops up, the cursor hits Subscribe, then rings the bell.',
  duration: 5,
  poster: 2.6,
  options: {
    name: opt.text({ label: 'Channel name', default: "Tom's Cool Tools", shared: 'name' }),
    subs: opt.subscribers({ shared: 'subs' }),
    avatar: opt.image({ shared: 'avatar' }),
    theme: opt.choice([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], { label: 'Card', shared: 'theme' }),
    button: opt.choice([{ value: 'classic', label: 'Classic red' }, { value: 'modern', label: 'Modern pill' }], { label: 'Button' }),
    accent: opt.colour({ shared: 'accent' }),
    position: opt.choice([{ value: 'center', label: 'Bottom centre' }, { value: 'left', label: 'Bottom left' }], { label: 'Position' }),
  },
  sounds: () => [
    { at: T.cardIn, sfx: 'whoosh' },
    { at: T.click1, sfx: 'click' },
    { at: T.swap, sfx: 'pop' },
    { at: T.click2, sfx: 'click' },
    { at: T.ring, sfx: 'bell' },
    { at: T.cardOut + 0.1, sfx: 'whoosh' },
  ],
  fonts: (o) => [
    { font: NAME_FONT, text: o.name },
    { font: SUBS_FONT, text: formatSubscribers(o.subs) },
    { font: font(500, 42), text: initialsOf(o.name || 'Your Channel') },
  ],

  prepare(o, ctx, frame) {
    const theme = THEMES[o.theme] || THEMES.dark;
    const btn = buttonStyle(o.button, o.theme);
    ctx.save();
    ctx.font = NAME_FONT;
    const name = truncate(ctx, o.name || 'Your Channel', S.nameMax);
    const nameW = ctx.measureText(name).width;
    ctx.font = SUBS_FONT;
    const subs = formatSubscribers(o.subs);
    const subsW = ctx.measureText(subs).width;
    ctx.font = font(500, btn.fontPx);
    ctx.letterSpacing = btn.spacing;
    const w0 = Math.ceil(ctx.measureText(btn.labels[0]).width) + btn.padX * 2;
    const w1 = Math.ceil(ctx.measureText(btn.labels[1]).width) + btn.padX * 2;
    ctx.restore();

    const sc = {
      o,
      frame,
      theme,
      btn,
      name,
      subs,
      textW: Math.ceil(Math.max(nameW, subsW, 120)),
      w0,
      w1,
      accent: o.accent,
      initials: initialsOf(o.name || 'Your Channel'),
      initialsBg: colourFor(o.name || 'Your Channel'),
      particles: fx.makeParticles(),
    };
    const l1 = layout(T.click1, sc);
    const p1 = { x: l1.cardX + l1.btnX + w0 * 0.6, y: l1.cardY + l1.btnY + S.btnH * 0.56 };
    const l2 = layout(T.click2, sc);
    const p2 = { x: l2.cardX + l2.bellCX + 13, y: l2.cardY + l2.bellCY + 15 };
    sc.click1 = p1;
    sc.cursor = fx.cursorTrack([
      { start: T.cursorIn, end: T.cursorArrive, from: { x: p1.x + 440, y: p1.y + 300 }, ctrl: { x: p1.x + 360, y: p1.y + 30 }, to: p1, ease: ease.glide },
      { start: T.cursorToBell, end: T.cursorAtBell, from: p1, ctrl: { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) - 46 }, to: p2, ease: ease.glide },
      { start: T.cursorOut, end: T.cursorGone, from: p2, ctrl: { x: p2.x + 40, y: p2.y + 200 }, to: { x: p2.x + 380, y: p2.y + 340 }, ease: ease.inOutCubic },
    ]);
    return sc;
  },

  render(ctx, t, sc) {
    const L = layout(t, sc);
    drawCardLayer(ctx, t, sc, L);
    fx.drawBurst(ctx, t, T.swap, sc.click1, sc.accent, sc.particles);
    const alpha = tween(t, T.cursorIn, 0.18, ease.easy) * (1 - tween(t, T.cursorGone - 0.3, 0.3, ease.easy));
    fx.drawCursor(ctx, t, sc.cursor, { alpha, press: Math.max(press(t, T.click1), press(t, T.click2)) });
  },
});
