// Generuje ikony PWA (księżyc w ciepłym bursztynie na #0B0F17) bez zależności zewnętrznych.
// Użycie: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "icons");

const BACKGROUND = [0x0b, 0x0f, 0x17];
const MOON = [0xf5, 0xb0, 0x4a];
const GLOW = [0x8b, 0x5c, 0xf6];

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
  header[9] = 2; // RGB
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(from, to, amount) {
  return from.map((value, index) => Math.round(value + (to[index] - value) * amount));
}

/**
 * Rysuje księżyc (sierp) z delikatną fioletową poświatą. `scale` < 1 zostawia margines
 * na strefę bezpieczną ikon maskable.
 */
function renderIcon(size, scale) {
  const pixels = Buffer.alloc(size * size * 3);
  const center = size / 2;
  const radius = (size / 2) * 0.58 * scale;
  const cutRadius = radius * 0.82;
  const cutOffset = radius * 0.5;
  const glowRadius = radius * 1.7;
  const samples = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples - center;
          const py = y + (sy + 0.5) / samples - center;
          const inDisc = px * px + py * py <= radius * radius;
          const inCut = (px - cutOffset) ** 2 + (py + cutOffset * 0.35) ** 2 <= cutRadius ** 2;
          if (inDisc && !inCut) coverage += 1;
        }
      }
      const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      const glow = Math.max(0, 1 - distance / glowRadius) ** 2 * 0.22;
      const base = mix(BACKGROUND, GLOW, glow);
      const color = mix(base, MOON, coverage / (samples * samples));
      pixels.set(color, (y * size + x) * 3);
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
const icons = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.78],
  ["apple-touch-icon.png", 180, 0.9],
];
for (const [name, size, scale] of icons) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size, scale));
  process.stdout.write(`public/icons/${name}
`);
}
