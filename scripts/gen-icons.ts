// One-shot generator: renders the Cloud Code Studio favicon geometry directly
// to PNG (32px + 180px apple-touch-icon) — no native deps, uses Bun.deflateSync
// for the PNG IDAT stream. Run: bun scripts/gen-icons.ts

type RGB = [number, number, number];

const SIZE = 64;
const TOP: RGB = [0x1c, 0x24, 0x31];
const BOTTOM: RGB = [0x0d, 0x11, 0x17];
const GLYPH: RGB = [0x34, 0xd3, 0x99]; // emerald-400
const RX = 14; // tile corner radius
const STROKE = 6.5; // glyph stroke width

// Capsule test: distance from point to segment <= half stroke width.
function inCapsule(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const ddx = x - px;
  const ddy = y - py;
  return ddx * ddx + ddy * ddy <= (STROKE / 2) * (STROKE / 2);
}

// Glyph = ">_" terminal prompt: two joined segments + one underscore segment.
function inGlyph(x: number, y: number): boolean {
  return (
    inCapsule(x, y, 15, 22, 27, 32) || // top arm of ">"
    inCapsule(x, y, 27, 32, 15, 42) || // bottom arm of ">"
    inCapsule(x, y, 35, 44, 49, 44) // underscore
  );
}

function inRoundedRect(x: number, y: number): boolean {
  const nx = Math.max(RX, Math.min(SIZE - RX, x));
  const ny = Math.max(RX, Math.min(SIZE - RX, y));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy <= RX * RX;
}

// Soft cloud shapes at 6% white, same geometry as favicon.svg.
function overlayAlpha(x: number, y: number): number {
  const shapes: Array<[number, number, number]> = [
    [22, 21, 8],
    [34, 17, 10],
    [45, 23, 7],
  ];
  let a = 0;
  for (const [cx, cy, r] of shapes) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r) a = 0.06;
  }
  // Rounded band rect(22,21,23,10,r5)
  const bx = Math.max(27, Math.min(45, x));
  const by = Math.max(26, Math.min(31, y));
  const dx = x - bx;
  const dy = y - by;
  if (dx * dx + dy * dy <= 25) a = 0.06;
  return a;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function render(size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const scale = SIZE / size;
  const SS = 3; // 3x3 supersampling
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi + (sx + 0.5) / SS) * scale;
          const y = (py + (sy + 0.5) / SS) * scale;
          if (!inRoundedRect(x, y)) continue; // transparent outside tile
          const t = Math.max(0, Math.min(1, y / SIZE));
          let cr = lerp(TOP[0], BOTTOM[0], t);
          let cg = lerp(TOP[1], BOTTOM[1], t);
          let cb = lerp(TOP[2], BOTTOM[2], t);
          const ov = overlayAlpha(x, y);
          cr = lerp(cr, 255, ov);
          cg = lerp(cg, 255, ov);
          cb = lerp(cb, 255, ov);
          if (inGlyph(x, y)) {
            cr = GLYPH[0];
            cg = GLYPH[1];
            cb = GLYPH[2];
          }
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const samples = SS * SS;
      const i = (py * size + pxi) * 4;
      px[i] = Math.round(r / samples);
      px[i + 1] = Math.round(g / samples);
      px[i + 2] = Math.round(b / samples);
      px[i + 3] = 255; // tile edges are AA'd via rounding; corners stay opaque
    }
  }
  return px;
}

// ---- Minimal PNG encoder (RGBA8, zlib via Bun.deflateSync) ----

let CRC_TABLE: Uint32Array | undefined;
function crc32(buf: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(rgba: Uint8Array, size: number): Uint8Array {
  // Filter type 0 per scanline.
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = Bun.deflateSync(raw);
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Uint8Array.from([
    ...sig,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", idat),
    ...chunk("IEND", new Uint8Array(0)),
  ]);
}

for (const size of [32, 180]) {
  const png = encodePng(render(size), size);
  const name = size === 32 ? "public/favicon-32.png" : "public/apple-touch-icon.png";
  await Bun.write(name, png);
  const ok = png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
  console.log(`${name}: ${png.length} bytes, valid-png=${ok}`);
}
