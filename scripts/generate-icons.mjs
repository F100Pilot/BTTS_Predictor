/**
 * Dependency-free PNG icon generator for the PWA.
 * Renders the app glyph (dark navy bg + emerald ring + star) into PNG files
 * using a minimal RGBA -> PNG encoder (zlib only, from Node stdlib).
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rest 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const COLORS = {
  bg: [15, 23, 42, 255], // #0f172a
  ring: [16, 185, 129, 255], // #10b981
  star: [16, 185, 129, 255],
};

function draw(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // For maskable, keep content within safe ~80% area.
  const scale = maskable ? 0.8 : 1;
  const ringR = (size * 0.29) * scale;
  const ringW = (size * 0.07) * scale;
  const starR = (size * 0.22) * scale;

  // 5-point star vertices
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? starR : starR * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const inStar = (px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0],
        yi = pts[i][1],
        xj = pts[j][0],
        yj = pts[j][1];
      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let color = COLORS.bg;
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - ringR) <= ringW / 2) color = COLORS.ring;
      if (inStar(x + 0.5, y + 0.5)) color = COLORS.star;
      buf[idx] = color[0];
      buf[idx + 1] = color[1];
      buf[idx + 2] = color[2];
      buf[idx + 3] = color[3];
    }
  }
  return encodePng(size, size, buf);
}

writeFileSync(join(OUT, 'icon-192.png'), draw(192, false));
writeFileSync(join(OUT, 'icon-512.png'), draw(512, false));
writeFileSync(join(OUT, 'icon-512-maskable.png'), draw(512, true));
writeFileSync(join(OUT, 'apple-touch-icon.png'), draw(180, false));
// eslint-disable-next-line no-console
console.log('Generated PWA icons in public/icons/');
