// The subscribe animation. Renderer.render() draws one moment of it onto a
// 1920x1080 canvas. It depends only on t (seconds) and the prepared scene, so
// the preview, scrubbing and the exported frames are pixel-identical.

import { clamp, lerp, ease, tween, spring, press, wiggle, rng, quad } from './motion.js';

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const DURATION = 5;
export const FRAMES = DURATION * FPS;

// Timeline, in seconds. Overlapping starts keep things flowing into each other.
const T = {
  cardIn: 0.1,
  avatar: 0.3,
  name: 0.44,
  subs: 0.54,
  button: 0.72,
  cursorIn: 1.08,
  cursorArrive: 1.8,
  click1: 1.94,
  swap: 2.02, // button turns into "Subscribed", burst fires
  bellSlot: 2.38, // card widens to make room for the bell
  bellIn: 2.48,
  cursorToBell: 2.76,
  cursorAtBell: 3.22,
  click2: 3.32,
  ring: 3.39, // bell turns filled and rings
  cardOut: 4.3,
  cursorOut: 3.86,
  cursorGone: 4.6,
};

// Card sizes (px at 1920x1080).
const S = {
  pad: 30,
  avatar: 108,
  gap1: 26, // avatar -> text
  gap2: 44, // text -> button
  btnH: 62,
  bellD: 62,
  bellGap: 14,
  radius: 34,
  margin: 92, // distance from the bottom (and left) edge of the frame
  nameMax: 560,
};
S.cardH = S.pad * 2 + S.avatar;

const THEMES = {
  dark: {
    card: '#212121',
    border: 'rgba(255,255,255,0.07)',
    name: '#F1F1F1',
    subs: '#AAAAAA',
    icon: '#F1F1F1',
    iconBg: '#383838',
  },
  light: {
    card: '#FFFFFF',
    border: 'rgba(0,0,0,0.07)',
    name: '#0F0F0F',
    subs: '#606060',
    icon: '#0F0F0F',
    iconBg: '#F2F2F2',
  },
};

function buttonStyle(style, theme) {
  if (style === 'classic') {
    return {
      labels: ['SUBSCRIBE', 'SUBSCRIBED'],
      font: '500 25px Roboto',
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
  // Modern pill. On a light card a white pill would vanish, so it inverts to
  // black, exactly as YouTube does in light mode.
  return {
    labels: ['Subscribe', 'Subscribed'],
    font: '500 26px Roboto',
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

// Material Symbols bell paths (24x24 viewBox).
const BELL_OUTLINE = new Path2D(
  'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z'
);
const BELL_FILLED = new Path2D(
  'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'
);
const BELL_ARCS = new Path2D(
  'M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.97 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43c2.02 1.45 3.39 3.77 3.54 6.42z'
);

// Arrow cursor, tip at (0, 0).
const CURSOR = new Path2D('M0 0 L0 30.5 L7.2 23.6 L11.8 34.4 L16.6 32.3 L12.1 21.9 L21.9 21.9 Z');

const AVATAR_COLOURS = ['#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5', '#00897B', '#43A047', '#F4511E', '#6D4C41'];

export function formatSubscribers(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[,\s_]/g, '');
  if (/^\d+$/.test(digits)) {
    const n = Number(digits);
    if (n === 1) return '1 subscriber';
    const fmt = (v, unit) => {
      const d = v < 10 ? 2 : v < 100 ? 1 : 0;
      return `${Number(v.toFixed(d))}${unit}`; // Number() drops trailing zeros
    };
    let s;
    if (n < 1000) s = String(n);
    else if (n < 1e6) s = fmt(Math.floor(n / 10) / 100, 'K');
    else if (n < 1e9) s = fmt(Math.floor(n / 1e4) / 100, 'M');
    else s = fmt(Math.floor(n / 1e7) / 100, 'B');
    // Rounding can produce "1000K"; YouTube shows "1M" there.
    s = s.replace(/^1000K$/, '1M').replace(/^1000M$/, '1B');
    return `${s} subscribers`;
  }
  return /subscriber/i.test(raw) ? raw : `${raw} subscribers`;
}

function initialsOf(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words[words.length - 1]][0]];
  return letters.join('').toUpperCase();
}

function colourFor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const v = m ? parseInt(m[1], 16) : 0xff0033;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixHex(a, b, p) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], p)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}

function truncate(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(chars.join('') + '…').width > max) chars.pop();
  return chars.join('').trimEnd() + '…';
}

// Measures text and fixes everything that doesn't change over time.
export function prepareScene(settings, measureCtx) {
  const theme = THEMES[settings.theme] || THEMES.dark;
  const btn = buttonStyle(settings.button, settings.theme);
  const ctx = measureCtx;
  ctx.save();
  ctx.font = '500 36px Roboto';
  const name = truncate(ctx, settings.name || 'Your Channel', S.nameMax);
  const nameW = ctx.measureText(name).width;
  ctx.font = '400 25px Roboto';
  const subs = formatSubscribers(settings.subs);
  const subsW = ctx.measureText(subs).width;
  ctx.font = btn.font;
  ctx.letterSpacing = btn.spacing;
  const w0 = Math.ceil(ctx.measureText(btn.labels[0]).width) + btn.padX * 2;
  const w1 = Math.ceil(ctx.measureText(btn.labels[1]).width) + btn.padX * 2;
  ctx.restore();

  const sc = {
    settings,
    theme,
    btn,
    name,
    subs,
    textW: Math.ceil(Math.max(nameW, subsW, 120)),
    w0,
    w1,
    accent: settings.accent || '#FF0033',
    accentRgb: hexToRgb(settings.accent),
    avatar: settings.avatar || null,
    initials: initialsOf(settings.name || 'Your Channel'),
    initialsBg: colourFor(settings.name || 'Your Channel'),
    particles: makeParticles(),
  };
  // Cursor targets come from the settled layout at the moment of each click.
  const l1 = layout(T.click1, sc);
  sc.click1 = { x: l1.cardX + l1.btnX + w0 * 0.6, y: l1.cardY + l1.btnY + S.btnH * 0.56 };
  const l2 = layout(T.click2, sc);
  sc.click2 = { x: l2.cardX + l2.bellCX + 13, y: l2.cardY + l2.bellCY + 15 };
  return sc;
}

function layout(t, sc) {
  const swapP = spring(t - T.swap, 2.4, 0.82);
  const slotP = spring(t - T.bellSlot, 2.1, 0.8);
  const btnW = lerp(sc.w0, sc.w1, swapP);
  const slot = (S.bellGap + S.bellD) * slotP;
  const textX = S.pad + S.avatar + S.gap1;
  const btnX = textX + sc.textW + S.gap2;
  const cardW = btnX + btnW + slot + S.pad;
  const cardX = sc.settings.position === 'left' ? S.margin : (W - cardW) / 2;
  const cardY = H - S.margin - S.cardH;
  const btnY = (S.cardH - S.btnH) / 2;
  return {
    cardX,
    cardY,
    cardW,
    textX,
    btnX,
    btnY,
    btnW,
    bellCX: btnX + btnW + S.bellGap + S.bellD / 2,
    bellCY: S.cardH / 2,
  };
}

function makeParticles() {
  const r = rng(20241);
  const list = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    list.push({
      a,
      speed: 620 + r() * 680,
      life: 0.42 + r() * 0.38,
      size: 2.8 + r() * 4,
      streak: i % 3 === 0,
      light: r() < 0.3,
      delay: r() * 0.04,
    });
  }
  return list;
}

// ---------------------------------------------------------------- drawing

function drawCard(ctx, t, sc, L) {
  const { theme, btn } = sc;
  const inP = spring(t - T.cardIn, 1.45, 0.68);
  const outP = tween(t, T.cardOut, 0.6, ease.inBack);
  let alpha = tween(t, T.cardIn, 0.22, ease.outCubic) * (1 - tween(t, T.cardOut + 0.32, 0.28, ease.inCubic));
  if (alpha <= 0.001) return;
  const dy = (1 - inP) * (S.cardH + 150) + outP * (S.cardH + 180);
  const scale = lerp(0.9, 1, inP) * lerp(1, 0.95, outP);

  ctx.save();
  ctx.globalAlpha = alpha;
  // Scale about the bottom centre of the card, like a layer anchor point.
  const ax = L.cardX + L.cardW / 2;
  const ay = L.cardY + S.cardH;
  ctx.translate(ax, ay + dy);
  ctx.scale(scale, scale);
  ctx.translate(-L.cardW / 2, -S.cardH);

  // Layered soft shadow: wide ambient + tight contact.
  ctx.save();
  roundRect(ctx, 0, 0, L.cardW, S.cardH, S.radius);
  ctx.fillStyle = theme.card;
  ctx.shadowColor = 'rgba(0,0,0,0.30)';
  ctx.shadowBlur = 64;
  ctx.shadowOffsetY = 24;
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.20)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0.75, 0.75, L.cardW - 1.5, S.cardH - 1.5, S.radius - 0.75);
  ctx.stroke();

  drawAvatar(ctx, t, sc);
  drawText(ctx, t, sc, L);
  drawButton(ctx, t, sc, L);
  drawBell(ctx, t, sc, L);
  ctx.restore();
}

function drawAvatar(ctx, t, sc) {
  const p = spring(t - T.avatar, 2.1, 0.55);
  if (p <= 0) return;
  const r = S.avatar / 2;
  const cx = S.pad + r;
  const cy = S.pad + r;
  ctx.save();
  ctx.globalAlpha *= clamp(p * 3);
  ctx.translate(cx, cy);
  ctx.scale(p, p);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  if (sc.avatar) {
    ctx.save();
    ctx.clip();
    const img = sc.avatar;
    const iw = img.width, ih = img.height;
    const k = (2 * r) / Math.min(iw, ih);
    ctx.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
    ctx.restore();
  } else {
    ctx.fillStyle = sc.initialsBg;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `500 ${sc.initials.length > 1 ? 42 : 48}px Roboto`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(sc.initials, 0, (sc.initials.length > 1 ? 42 : 48) * 0.355);
  }
  ctx.restore();
}

// Each line slides up out of an invisible mask, AE track-matte style.
function revealLine(ctx, t, start, text, font, colour, x, baseline, rise) {
  const p = tween(t, start, 0.7, ease.outExpo);
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 6, baseline - rise - 14, S.nameMax + 12, rise + 26);
  ctx.clip();
  ctx.globalAlpha *= clamp(p * 1.6);
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, baseline + (1 - p) * (rise + 12));
  ctx.restore();
}

function drawText(ctx, t, sc, L) {
  const cy = S.cardH / 2;
  revealLine(ctx, t, T.name, sc.name, '500 36px Roboto', sc.theme.name, L.textX, cy - 5, 36);
  if (sc.subs) revealLine(ctx, t, T.subs, sc.subs, '400 25px Roboto', sc.theme.subs, L.textX, cy + 31, 26);
}

function drawButton(ctx, t, sc, L) {
  const { btn } = sc;
  const inP = spring(t - T.button, 2.0, 0.52);
  if (inP <= 0) return;
  const pr = press(t, T.click1);
  const scale = lerp(0.45, 1, inP) * (1 - 0.06 * pr);
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
  // Ripple from the click point.
  const rd = t - T.click1;
  if (rd > 0 && rd < 0.9) {
    const rp = ease.outCubic(clamp(rd / 0.45));
    const fade = 1 - tween(t, T.click1 + 0.04, 0.36, ease.easy);
    const cx = sc.w0 * 0.6;
    ctx.fillStyle = `rgba(${btn.before.ripple},${0.26 * fade})`;
    ctx.beginPath();
    ctx.arc(cx, h * 0.56, lerp(10, w * 1.05, rp), 0, Math.PI * 2);
    ctx.fill();
  }

  // Label: old slides up and out, new rises in with a hair of delay.
  ctx.font = btn.font;
  ctx.letterSpacing = btn.spacing;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fontPx = parseFloat(btn.font.split(' ')[1]);
  const base = h / 2 + fontPx * 0.355;
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
  const pr = press(t, T.click2);
  const scale = lerp(0.2, 1, inP) * (1 - 0.09 * pr);
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
  const rd = t - T.click2;
  if (rd > 0 && rd < 0.9) {
    const rp = ease.outCubic(clamp(rd / 0.5));
    const fade = 1 - tween(t, T.click2 + 0.1, 0.5, ease.easy);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = theme === THEMES.dark ? `rgba(255,255,255,${0.18 * fade})` : `rgba(0,0,0,${0.12 * fade})`;
    ctx.beginPath();
    ctx.arc(13, 15, lerp(6, r * 1.8, rp), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Icon: 24-unit paths scaled up to ~34px.
  const k = 34 / 24;
  const filled = t >= T.ring;
  const pop = filled ? 1 + 0.14 * Math.sin(Math.PI * clamp((t - T.ring) / 0.22)) : 1;
  const angle = wiggle(t, T.ring, 0.42, 4.4, 3.4);
  ctx.scale(k * pop, k * pop);
  ctx.translate(-12, -12);
  ctx.fillStyle = theme.icon;
  if (filled) {
    const ap = spring(t - T.ring - 0.04, 2.6, 0.55);
    if (ap > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(ap * 2);
      ctx.translate(12, 9);
      ctx.scale(lerp(0.6, 1, ap), lerp(0.6, 1, ap));
      ctx.translate(-12, -9);
      ctx.fill(BELL_ARCS);
      ctx.restore();
    }
  }
  ctx.translate(12, 3);
  ctx.rotate(angle);
  ctx.translate(-12, -3);
  ctx.fill(filled ? BELL_FILLED : BELL_OUTLINE);
  ctx.restore();
}

function drawBurst(ctx, t, sc) {
  const d0 = t - T.swap;
  if (d0 <= 0 || d0 > 1.0) return;
  const o = sc.click1;
  const [r, g, b] = sc.accentRgb;
  const light = `rgb(${Math.round(lerp(r, 255, 0.45))},${Math.round(lerp(g, 255, 0.45))},${Math.round(lerp(b, 255, 0.45))})`;
  ctx.save();

  // Shockwave ring.
  const rp = clamp(d0 / 0.5);
  if (rp < 1) {
    const e = ease.outExpo(rp);
    ctx.strokeStyle = sc.accent;
    ctx.globalAlpha = 1 - ease.easy(rp);
    ctx.lineWidth = lerp(7, 0.5, e);
    ctx.beginPath();
    ctx.arc(o.x, o.y, lerp(20, 112, e), 0, Math.PI * 2);
    ctx.stroke();
  }

  const drag = 6.5;
  ctx.lineCap = 'round';
  for (const p of sc.particles) {
    const d = d0 - p.delay;
    if (d <= 0 || d >= p.life) continue;
    const life = d / p.life;
    const travel = 26 + (p.speed * (1 - Math.exp(-drag * d))) / drag;
    const dx = Math.cos(p.a), dy = Math.sin(p.a) * 0.8;
    const x = o.x + dx * travel;
    const y = o.y + dy * travel + 240 * d * d; // a touch of gravity
    const size = p.size * Math.pow(1 - life, 0.7);
    ctx.globalAlpha = 1 - ease.inCubic(life);
    const col = p.light ? light : sc.accent;
    if (p.streak) {
      const v = p.speed * Math.exp(-drag * d);
      const len = clamp(v * 0.03, 0, 34);
      ctx.strokeStyle = col;
      ctx.lineWidth = size * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx * len, y - dy * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function cursorPos(t, sc) {
  const p1 = sc.click1, p2 = sc.click2;
  const start = { x: p1.x + 440, y: p1.y + 300 };
  const exit = { x: p2.x + 380, y: p2.y + 340 };
  if (t < T.cursorIn) return null;
  if (t < T.cursorArrive) {
    const s = tween(t, T.cursorIn, T.cursorArrive - T.cursorIn, ease.glide);
    return quad(start, { x: p1.x + 360, y: p1.y + 30 }, p1, s);
  }
  if (t < T.cursorToBell) return p1;
  if (t < T.cursorAtBell) {
    const s = tween(t, T.cursorToBell, T.cursorAtBell - T.cursorToBell, ease.glide);
    return quad(p1, { x: (p1.x + p2.x) / 2, y: Math.min(p1.y, p2.y) - 46 }, p2, s);
  }
  if (t < T.cursorOut) return p2;
  const s = tween(t, T.cursorOut, T.cursorGone - T.cursorOut, ease.inOutCubic);
  return quad(p2, { x: p2.x + 40, y: p2.y + 200 }, exit, s);
}

function drawCursor(ctx, t, sc) {
  const p = cursorPos(t, sc);
  if (!p) return;
  const alpha = tween(t, T.cursorIn, 0.18, ease.easy) * (1 - tween(t, T.cursorGone - 0.3, 0.3, ease.easy));
  if (alpha <= 0) return;
  const prev = cursorPos(t - 1 / 120, sc) || p;
  const vx = (p.x - prev.x) * 120;
  const tilt = clamp(vx * 0.00005, -0.1, 0.1);
  const pr = Math.max(press(t, T.click1), press(t, T.click2));
  const scale = 1.3 * (1 - 0.14 * pr);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(CURSOR);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.6;
  ctx.stroke(CURSOR);
  ctx.restore();
}

function drawScene(ctx, t, sc) {
  const L = layout(t, sc);
  drawCard(ctx, t, sc, L);
  drawBurst(ctx, t, sc);
  drawCursor(ctx, t, sc);
}

// Renders one frame with a transparent background. With motion blur on, it
// averages several sub-frames across a 180-degree shutter, like AE's motion
// blur, by adding them together at 1/N strength (exact in premultiplied alpha).
export class Renderer {
  constructor() {
    this.scratch = new OffscreenCanvas(W, H);
    this.sctx = this.scratch.getContext('2d');
  }

  render(ctx, t, sc, { motionBlur = true, samples = 6 } = {}) {
    ctx.clearRect(0, 0, W, H);
    if (!motionBlur) {
      drawScene(ctx, t, sc);
      return;
    }
    const shutter = 0.5 / FPS;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 / samples;
    for (let i = 0; i < samples; i++) {
      const st = t + ((i + 0.5) / samples - 0.5) * shutter;
      this.sctx.clearRect(0, 0, W, H);
      drawScene(this.sctx, st, sc);
      ctx.drawImage(this.scratch, 0, 0);
    }
    ctx.restore();
  }
}
