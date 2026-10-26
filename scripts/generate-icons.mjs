// Generuje ikony PWA (zamknięte oczko „Oczko” w bursztynie na #0B0F17) bez zależności zewnętrznych.
// Użycie: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");
const APP_DIR = join(ROOT, "src", "app");

const BACKGROUND = [0x0b, 0x0f, 0x17];
const AMBER = [0xf5, 0xb5, 0x44];
const LAVENDER = [0xb4, 0xa3, 0xf5];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Geometria w układzie 64x64 — musi odpowiadać src/app/icon.svg.
const TILE_RADIUS = 14;
const EYE = flatten([13, 28], [32, 47], [51, 28]);
const LASHES = [
  [
    [22.3, 35.3],
    [18.7, 41.7],
  ],
  [
    [32, 37.6],
    [32, 45.2],
  ],
  [
    [41.7, 35.3],
    [45.3, 41.7],
  ],
];
const SPARKLE = [
  ...flatten([49, 9.5], [49, 14], [53.5, 14]),
  ...flatten([53.5, 14], [49, 14], [49, 18.5]),
  ...flatten([49, 18.5], [49, 14], [44.5, 14]),
  ...flatten([44.5, 14], [49, 14], [49, 9.5]),
];

function flatten(a, c, b, steps = 24) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    points.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return points;
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t =
    dx || dy
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
      : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function nearPolyline(px, py, points, halfWidth) {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (distanceToSegment(px, py, points[i], points[i + 1]) <= halfWidth) return true;
  }
  return false;
}

function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedTile(x, y) {
  const cx = Math.min(Math.max(x, TILE_RADIUS), 64 - TILE_RADIUS);
  const cy = Math.min(Math.max(y, TILE_RADIUS), 64 - TILE_RADIUS);
  return Math.hypot(x - cx, y - cy) <= TILE_RADIUS;
}

/** Kolor próbki w układzie projektu 64x64 albo null (przezroczysty róg kafelka). */
function sampleColor(x, y, rounded) {
  if (rounded && !inRoundedTile(x, y)) return null;
  if (inPolygon(x, y, SPARKLE)) return LAVENDER;
  if (nearPolyline(x, y, EYE, 2.75) || LASHES.some((lash) => nearPolyline(x, y, lash, 2.1)))
    return AMBER;
  return BACKGROUND;
}

/**
 * Renderuje oczko. `rounded` = zaokrąglony kafelek z przezroczystymi rogami (ikony „any”, favicon),
 * w przeciwnym razie tło pełne (apple-touch-icon, maskable). `glyph` < 1 zmniejsza rysunek względem
 * kafelka (strefa bezpieczna maskable).
 */
function renderIcon(size, { rounded, glyph = 1 }) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = size < 64 ? 6 : 3;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const dx = ((x + (sx + 0.5) / samples) / size) * 64;
          const dy = ((y + (sy + 0.5) / samples) / size) * 64;
          const color =
            sampleColor((dx - 32) / glyph + 32, (dy - 32) / glyph + 32, rounded && glyph === 1) ??
            (rounded ? null : BACKGROUND);
          if (!color) continue;
          r += color[0];
          g += color[1];
          b += color[2];
          a += 1;
        }
      }
      const total = samples * samples;
      const offset = (y * size + x) * 4;
      if (a)
        pixels.set(
          [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / total) * 255)],
          offset,
        );
    }
  }
  return encodePng(size, pixels);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(([size, png]) => {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(([, png]) => png)]);
}

mkdirSync(OUT_DIR, { recursive: true });
const icons = [
  ["icon-192.png", 192, { rounded: true }],
  ["icon-512.png", 512, { rounded: true }],
  ["icon-maskable-512.png", 512, { rounded: false, glyph: 0.85 }],
  ["apple-touch-icon.png", 180, { rounded: false }],
];
for (const [name, size, options] of icons) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size, options));
  process.stdout.write(`public/icons/${name}\n`);
}
writeFileSync(
  join(APP_DIR, "favicon.ico"),
  encodeIco([16, 32, 48].map((size) => [size, renderIcon(size, { rounded: true })])),
);
process.stdout.write("src/app/favicon.ico\n");
