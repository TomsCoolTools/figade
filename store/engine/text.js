// Text helpers shared by every design: font strings with fallbacks for other
// scripts, font loading, truncation and subscriber-count formatting.

// Latin, Cyrillic, Greek and Vietnamese come from Roboto. Everything after it is
// only downloaded when a name actually contains those characters (unicode-range).
// Emoji fall through to the visitor's system emoji font.
export const FALLBACK =
  "'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Arabic', 'Noto Sans Hebrew', " +
  "'Noto Sans Devanagari', 'Noto Sans Thai', sans-serif";

export function font(weight, px, family = 'Roboto') {
  return `${weight} ${px}px ${family}, ${FALLBACK}`;
}

// Makes sure every font file needed to draw these strings is loaded before the
// first frame is rendered, so exports never contain a fallback flash.
export async function ensureFonts(items) {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(items.filter((i) => i.text).map((i) => document.fonts.load(i.font, i.text)));
}

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
export const isRTL = (text) => RTL.test(text || '');

// Draws text so its left edge sits at x, in either direction.
export function fillTextLeft(ctx, text, x, y) {
  if (isRTL(text)) {
    const d = ctx.direction;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText(text, x + ctx.measureText(text).width, y);
    ctx.direction = d;
    ctx.textAlign = 'left';
  } else {
    ctx.fillText(text, x, y);
  }
}

export function truncate(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  const chars = [...text];
  while (chars.length && ctx.measureText(chars.join('') + '…').width > max) chars.pop();
  return chars.join('').trimEnd() + '…';
}

export function formatSubscribers(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[,\s_]/g, '');
  if (/^\d+$/.test(digits)) {
    const n = Number(digits);
    if (n === 1) return '1 subscriber';
    const fmt = (v, unit) => {
      const d = v < 10 ? 2 : v < 100 ? 1 : 0;
      return `${Number(v.toFixed(d))}${unit}`;
    };
    let s;
    if (n < 1000) s = String(n);
    else if (n < 1e6) s = fmt(Math.floor(n / 10) / 100, 'K');
    else if (n < 1e9) s = fmt(Math.floor(n / 1e4) / 100, 'M');
    else s = fmt(Math.floor(n / 1e7) / 100, 'B');
    s = s.replace(/^1000K$/, '1M').replace(/^1000M$/, '1B');
    return `${s} subscribers`;
  }
  return /subscriber/i.test(raw) ? raw : `${raw} subscribers`;
}

// "@handle" for follow-style designs: strips spaces, adds the @ if missing.
export function formatHandle(input, fallbackName) {
  let h = String(input ?? '').trim();
  if (!h) h = String(fallbackName ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!h) return '';
  return h.startsWith('@') ? h : `@${h}`;
}

export function initialsOf(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters =
    words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words[words.length - 1]][0]];
  return letters.join('').toUpperCase();
}

const AVATAR_COLOURS = ['#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5', '#00897B', '#43A047', '#F4511E', '#6D4C41'];

export function colourFor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}
