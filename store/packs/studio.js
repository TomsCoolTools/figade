// The Studio pack: four designs in one look. Rounded cards, Roboto, the
// buyer's accent colour, and the same name, avatar and colours throughout.
// `style` holds what the designs share so they match.

import { spring, tween, lerp, ease } from '../engine/motion.js';

export const style = {
  radius: 34,
  margin: 92, // distance from the frame's bottom (and side) edge
  themes: {
    dark: { card: '#212121', border: 'rgba(255,255,255,0.07)', name: '#F1F1F1', subs: '#AAAAAA', icon: '#F1F1F1', iconBg: '#383838', press: '255,255,255', pressAlpha: 0.18, hover: 'rgba(255,255,255,0.06)', neutral: '#383838', neutralFg: '#F1F1F1' },
    light: { card: '#FFFFFF', border: 'rgba(0,0,0,0.07)', name: '#0F0F0F', subs: '#606060', icon: '#0F0F0F', iconBg: '#F2F2F2', press: '0,0,0', pressAlpha: 0.12, hover: 'rgba(0,0,0,0.05)', neutral: '#F2F2F2', neutralFg: '#0F0F0F' },
  },
};

export const themeOf = (name) => style.themes[name] || style.themes.dark;

// The card's entrance and exit, shared by every card design in the pack:
// springs up from below with a slight overshoot, then dips and drops away.
export function cardMotion(t, inAt, outAt, cardH) {
  const inP = spring(t - inAt, 1.45, 0.68, cardH + 150);
  const outP = tween(t, outAt, 0.6, ease.inBack);
  const alpha = tween(t, inAt, 0.22, ease.outCubic) * (1 - tween(t, outAt + 0.32, 0.28, ease.inCubic));
  const dy = (1 - inP) * (cardH + 150) + outP * (cardH + 180);
  const scale = lerp(0.9, 1, inP) * lerp(1, 0.95, outP);
  return { alpha, dy, scale };
}

export default {
  id: 'studio',
  name: 'Studio pack',
  blurb: 'Four matching animations for your channel. Type your details once and they all update.',
  designs: ['subscribe-pop', 'like-bell', 'follow-card', 'lower-third'],
};
