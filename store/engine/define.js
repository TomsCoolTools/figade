// The contract every design module follows. See designs/README.md.

const LAYOUTS = {
  landscape: { w: 1920, h: 1080 },
  vertical: { w: 1080, h: 1920 },
};

export function frameFor(layout = 'landscape') {
  const f = LAYOUTS[layout];
  if (!f) throw new Error(`Unknown layout "${layout}"`);
  return { layout, ...f };
}

// Option builders. `shared` links an option to the details a visitor types
// once per visit (name, avatar, colours...), so every design in a pack fills in.
export const opt = {
  text: (o) => ({ type: 'text', max: 60, default: '', ...o }),
  subscribers: (o = {}) => ({ type: 'subscribers', label: 'Subscribers', default: '128400', ...o }),
  image: (o = {}) => ({ type: 'image', label: 'Profile picture', ...o }),
  choice: (choices, o = {}) => ({
    type: 'choice',
    choices: choices.map((c) => (typeof c === 'string' ? { value: c, label: c[0].toUpperCase() + c.slice(1) } : c)),
    default: typeof choices[0] === 'string' ? choices[0] : choices[0].value,
    ...o,
  }),
  colour: (o = {}) => ({ type: 'colour', label: 'Accent colour', default: '#FF0033', ...o }),
};

const REQUIRED = ['id', 'name', 'duration', 'options', 'prepare', 'render'];

export function defineDesign(def) {
  for (const k of REQUIRED) if (def[k] == null) throw new Error(`Design is missing "${k}"`);
  if (!/^[a-z0-9-]+$/.test(def.id)) throw new Error(`Design id "${def.id}" must be lowercase-with-dashes`);
  return {
    layouts: ['landscape'],
    poster: def.duration / 2,
    sounds: () => [],
    fonts: () => [],
    blurb: '',
    ...def,
  };
}

// Resolves a design's options from the visitor's shared details and its own
// per-design settings, falling back to defaults.
export function resolveOptions(design, shared = {}, own = {}) {
  const out = {};
  for (const [key, o] of Object.entries(design.options)) {
    const fromShared = o.shared ? shared[o.shared] : undefined;
    const v = own[key] ?? fromShared;
    out[key] = v === undefined || v === '' ? (o.type === 'image' ? null : o.default) : v;
    if (o.type === 'text' && typeof out[key] === 'string') out[key] = out[key].slice(0, o.max);
  }
  return out;
}

export function defaultsOf(design) {
  return resolveOptions(design, {}, {});
}
