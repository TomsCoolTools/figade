// The catalogue: every design and pack, joined to its product. Adding a design
// means importing it here and listing it in a pack.

import config from './store.config.js';
import studio from './packs/studio.js';
import subscribePop from './designs/subscribe-pop/index.js';

export const designs = [subscribePop];
export const packs = [studio];

// Each design's colour on the storefront timeline (section 7 of the spec).
export const CLIP_COLOURS = ['#2DBFAB', '#F0A23B', '#EC8297', '#6AA3E3'];

const product = (id) => config.products.find((p) => p.id === id);

export const catalogue = designs.map((d, i) => ({
  design: d,
  product: product(d.id),
  colour: CLIP_COLOURS[i % CLIP_COLOURS.length],
  packs: packs.filter((p) => p.designs.includes(d.id)).map((p) => p.id),
}));

export const packList = packs.map((p) => ({ ...p, product: product(p.id) }));

export const designById = (id) => designs.find((d) => d.id === id);

// What a product unlocks. Packs unlock whatever designs they list today, so a
// design added to a pack later is unlocked for existing buyers too.
export function designsUnlockedBy({ packs: packIds = [], designs: designIds = [] }) {
  const set = new Set(designIds);
  for (const id of packIds) for (const d of packs.find((p) => p.id === id)?.designs ?? []) set.add(d);
  return set;
}
