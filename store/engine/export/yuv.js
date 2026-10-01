// RGB -> YUV 4:2:0 (I420) with BT.709 coefficients and limited (broadcast)
// range, the format editors like Premiere expect from H.264. Doing it here
// rather than letting the browser convert means the file is tagged correctly
// and pure #00FF00 lands exactly where keyers expect it.

export function rgbaToI420(rgba, W, H, out) {
  const ySize = W * H;
  const cW = W >> 1, cH = H >> 1;
  const buf = out ?? new Uint8Array(ySize + 2 * cW * cH);
  const U = ySize, V = ySize + cW * cH;
  for (let i = 0, p = 0; i < ySize; i++, p += 4) {
    buf[i] = 16 + ((0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]) * 219) / 255 + 0.5;
  }
  for (let y = 0; y < cH; y++) {
    const r0 = y * 2 * W * 4, r1 = r0 + W * 4;
    for (let x = 0; x < cW; x++) {
      const a = r0 + x * 8, b = r1 + x * 8;
      const R = (rgba[a] + rgba[a + 4] + rgba[b] + rgba[b + 4]) / 4;
      const G = (rgba[a + 1] + rgba[a + 5] + rgba[b + 1] + rgba[b + 5]) / 4;
      const B = (rgba[a + 2] + rgba[a + 6] + rgba[b + 2] + rgba[b + 6]) / 4;
      const c = y * cW + x;
      buf[U + c] = 128 + ((-0.1146 * R - 0.3854 * G + 0.5 * B) * 224) / 255 + 0.5;
      buf[V + c] = 128 + ((0.5 * R - 0.4542 * G - 0.0458 * B) * 224) / 255 + 0.5;
    }
  }
  return buf;
}

export const BT709_LIMITED = { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false };
