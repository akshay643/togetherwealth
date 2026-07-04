/**
 * Generates the TogetherWealth PWA icons with zero dependencies.
 *
 * Renders a rounded-square teal icon with a "together" motif (two
 * overlapping circles — a venn of two partners) into raw RGBA pixels,
 * then encodes valid PNGs by hand (node:zlib deflate + manual chunks).
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Encode 8-bit RGBA pixels as a valid PNG. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte 0 + row bytes.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Rendering — signed distance fields with 2x2 supersampling
// ---------------------------------------------------------------------------

const TEAL = [15, 111, 104]; // deep calm teal (matches --primary)
const TEAL_LIGHT = [153, 235, 222]; // soft aqua motif
const TEAL_PALE = [240, 253, 250]; // near-white overlap highlight

function roundedRectSDF(x, y, cx, cy, half, radius) {
  const qx = Math.abs(x - cx) - (half - radius);
  const qy = Math.abs(y - cy) - (half - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
}

function circleSDF(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

/** SDF (in pixels) → coverage in [0, 1] with ~1px anti-aliasing. */
function coverage(d) {
  return Math.min(1, Math.max(0, 0.5 - d));
}

/**
 * Render one icon.
 * @param {number} size          canvas size in px
 * @param {object} opts
 * @param {boolean} opts.fullBleed    fill the whole square (maskable / apple)
 * @param {number}  opts.contentScale shrink the motif (safe zone padding)
 */
function renderIcon(size, { fullBleed = false, contentScale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const cornerRadius = size * 0.225;
  const circleR = size * 0.165 * contentScale;
  const offset = size * 0.105 * contentScale;
  const leftCx = c - offset;
  const rightCx = c + offset;

  const samples = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Accumulate premultiplied color over the supersamples.
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (const [sx, sy] of samples) {
        const px = x + sx;
        const py = y + sy;

        // Layer stack (bottom → top), composited with "over".
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        const over = (color, alpha) => {
          if (alpha <= 0) return;
          const outA = alpha + a * (1 - alpha);
          if (outA <= 0) return;
          r = (color[0] * alpha + r * a * (1 - alpha)) / outA;
          g = (color[1] * alpha + g * a * (1 - alpha)) / outA;
          b = (color[2] * alpha + b * a * (1 - alpha)) / outA;
          a = outA;
        };

        // 1. Background: rounded square (or full bleed).
        const bgAlpha = fullBleed
          ? 1
          : coverage(roundedRectSDF(px, py, c, c, c, cornerRadius));
        over(TEAL, bgAlpha);

        // 2. Motif: two overlapping circles ("together").
        const d1 = circleSDF(px, py, leftCx, c, circleR);
        const d2 = circleSDF(px, py, rightCx, c, circleR);
        const union = coverage(Math.min(d1, d2));
        const intersection = coverage(Math.max(d1, d2));
        // Clip the motif to the background so nothing bleeds past corners.
        over(TEAL_LIGHT, union * bgAlpha);
        over(TEAL_PALE, intersection * bgAlpha);

        accR += r * a;
        accG += g * a;
        accB += b * a;
        accA += a;
      }

      const i = (y * size + x) * 4;
      if (accA > 0) {
        rgba[i] = Math.round(accR / accA);
        rgba[i + 1] = Math.round(accG / accA);
        rgba[i + 2] = Math.round(accB / accA);
        rgba[i + 3] = Math.round((accA / samples.length) * 255);
      }
      // else: fully transparent, buffer already zeroed
    }
  }

  return rgba;
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

const ICONS = [
  { file: "icon-192.png", size: 192, opts: {} },
  { file: "icon-512.png", size: 512, opts: {} },
  // Maskable: full-bleed background, motif shrunk into the safe zone.
  { file: "icon-512-maskable.png", size: 512, opts: { fullBleed: true, contentScale: 0.72 } },
  // iOS applies its own mask; give it a full-bleed square.
  { file: "apple-touch-icon.png", size: 180, opts: { fullBleed: true } },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, size, opts } of ICONS) {
  const png = encodePng(size, size, renderIcon(size, opts));
  const outPath = join(OUT_DIR, file);
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

console.log("done");
