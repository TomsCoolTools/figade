// Material Symbols icon paths (24-unit box), built on first use so design
// modules stay importable from Node.

const D = {
  thumbUp:
    'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
  thumbUpOutline:
    'M21 8h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2zm0 4l-3 7H9V9l4.34-4.34L12.23 10H21v2zM1 9h4v12H1z',
};
const cache = {};
export const icon = (name) => (cache[name] ??= new Path2D(D[name]));

// Draws a 24-unit icon centred on the origin at `size` px.
export function drawIcon(ctx, name, size, colour) {
  const k = size / 24;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-12, -12);
  ctx.fillStyle = colour;
  ctx.fill(icon(name));
  ctx.restore();
}
