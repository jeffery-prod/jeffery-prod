import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER = "jeffery-prod";
const STYLE = "hills";
const W = 1600;
const H = 300;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");
const R = Math.round;

/* ---------- seed -> random stream ---------- */
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a, b, c, d) {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const h = cyrb128(seed);
  const next = sfc32(h[0], h[1], h[2], h[3]);
  for (let i = 0; i < 12; i++) next();
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor((hi - lo + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

/* ---------- 2D simplex noise ---------- */
function makeNoise(rand) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  function n2(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = G[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = G[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = G[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  }

  function fbm(x, y, octaves) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * n2(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  return { fbm };
}

/* ---------- palettes: ground plus four inks ---------- */
const PALETTES = [
  { name: "Bliss",    ground: "#8EC5F2", primary: "#1F4F12", secondary: "#4F9A22", accent: "#FFFFFF", soft: "#DDEFFC" },
  { name: "Graphite", ground: "#16181D", primary: "#ECE7DC", secondary: "#5B8DEF", accent: "#F2A541", soft: "#6B7385" },
  { name: "Paper",    ground: "#EFEEE9", primary: "#1F232B", secondary: "#2F5D8A", accent: "#D9A441", soft: "#A9B1BA" },
  { name: "Riso",     ground: "#FBFAF5", primary: "#0078BF", secondary: "#FF48B0", accent: "#FFE800", soft: "#8FD3F4" },
  { name: "Lagoon",   ground: "#062A4A", primary: "#F7F3E3", secondary: "#19B3B1", accent: "#F2B134", soft: "#2C6E8F" },
  { name: "Dusk",     ground: "#1E1A33", primary: "#F6C87A", secondary: "#F28F6B", accent: "#E9E4F5", soft: "#6C62C9" },
  { name: "Moss",     ground: "#0F1D17", primary: "#D9E7C7", secondary: "#6FBF73", accent: "#E3B23C", soft: "#2F5A45" },
  { name: "Ember",    ground: "#1A0F0B", primary: "#FFC15E", secondary: "#FF7A2F", accent: "#F4E8D8", soft: "#8C2F1E" },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- hills ---------- */
function hills(rng, noise, pal) {
  const layers = rng.int(5, 8);
  const far = mix(pal.ground, pal.secondary, 0.3), near = pal.primary;
  const defs =
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal.ground +
    '"/><stop offset="1" stop-color="' + mix(pal.ground, pal.soft, 0.55) + '"/></linearGradient>';
  let body = '<rect width="' + W + '" height="' + H + '" fill="url(#sky)"/>';
  if (rng.chance(0.7)) {
    body += '<circle cx="' + R(rng.range(W * 0.1, W * 0.9)) + '" cy="' + R(rng.range(H * 0.18, H * 0.42)) +
      '" r="' + R(rng.range(22, 48)) + '" fill="' + pal.accent + '" fill-opacity="0.9"/>';
  }
  const ox = rng.range(0, 999);
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const baseY = H * (0.3 + 0.58 * t);
    const amp = H * rng.range(0.24, 0.44) * (1 - 0.35 * t);
    const freq = 0.0012 + 0.0028 * t * rng.range(0.6, 1.4);
    let d = "M0 " + H;
    for (let x = 0; x <= W; x += 16) {
      d += " L" + x + " " + R(baseY - amp * (0.5 + 0.5 * noise.fbm(x * freq, ox + i * 37.3, 3)));
    }
    body += '<path d="' + d + " L" + W + " " + H + 'Z" fill="' + mix(far, near, t) + '"/>';
  }
  return { defs, body };
}

function caption(text, pal) {
  return (
    '<text x="' + (W - 18) + '" y="' + (H - 16) + '" text-anchor="end" ' +
    'font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" letter-spacing="0.5" ' +
    'fill="' + pal.primary + '" stroke="' + pal.ground + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke">' +
    esc(text) + "</text>"
  );
}

/* ---------- ISO week ---------- */
function isoWeek(date) {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - start) / 86400000 + 1) / 7) };
}

/* ---------- main ---------- */
const { year, week } = isoWeek(new Date());
const tag = year + "-W" + String(week).padStart(2, "0");
const seed = USER + ":" + tag;

const rng = makeRng(seed + "|" + STYLE);
const noise = makeNoise(rng.next);
const pal = rng.pick(PALETTES);
const art = hills(rng, noise, pal);

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H +
  '" role="img" aria-label="' + esc("Hills banner, " + tag) + '">' +
  "<defs>" + art.defs + "</defs>" +
  '<rect width="' + W + '" height="' + H + '" fill="' + pal.ground + '"/>' +
  art.body +
  caption(tag, pal) +
  "</svg>\n";

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "banner.svg"), svg);

console.log("assets/banner.svg written");
console.log("  " + seed + ", " + pal.name + " palette");
