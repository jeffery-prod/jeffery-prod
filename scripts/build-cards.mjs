import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER = "jeffery-prod";
const UTC_OFFSET = -5; // NYC
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");

/* ---------- Windows XP "Luna" palette ---------- */
const C = {
  titleDark: "#0A246A",
  titleMid: "#0054E3",
  titleLite: "#3F8CF3",
  frame: "#0054E3",
  face: "#ECE9D8", // XP dialog beige
  groove: "#ACA899",
  ink: "#000000",
  inkSoft: "#4A4636",
  grassDark: "#5C9E1E",
  grassLite: "#8CC63F",
  skyDark: "#0054E3",
  skyLite: "#4B9BF5",
  closeA: "#E8785A",
  closeB: "#C4462A",
};
const FONT = "Tahoma, 'Segoe UI', Verdana, DejaVu Sans, sans-serif";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const niceMax = (m) => {
  if (m <= 2) return 2;
  if (m <= 5) return 5;
  if (m <= 10) return 10;
  if (m <= 20) return 20;
  return Math.ceil(m / 20) * 20;
};

/* ---------- GitHub data ---------- */
const gh = async (path) => {
  const headers = {
    "User-Agent": "jeffery-prod-profile-cards",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  const res = await fetch("https://api.github.com" + path, { headers });
  if (!res.ok) throw new Error(path + " -> " + res.status);
  return res.json();
};

async function collect() {
  const user = await gh("/users/" + USER);
  const repos = (await gh("/users/" + USER + "/repos?per_page=100&sort=updated")).filter(
    (r) => !r.fork
  );

  const hours = new Array(24).fill(0);
  const dows = new Array(7).fill(0);
  let commits = 0;
  let first = null;
  let last = null;

  for (const repo of repos) {
    for (let page = 1; page <= 3; page++) {
      let batch;
      try {
        batch = await gh("/repos/" + USER + "/" + repo.name + "/commits?per_page=100&page=" + page);
      } catch {
        break;
      }
      if (!batch.length) break;
      for (const c of batch) {
        const iso = c.commit && c.commit.author && c.commit.author.date;
        if (!iso) continue;
        const t = new Date(iso);
        const local = new Date(t.getTime() + UTC_OFFSET * 3600 * 1000);
        hours[local.getUTCHours()]++;
        dows[local.getUTCDay()]++;
        commits++;
        if (!first || t < first) first = t;
        if (!last || t > last) last = t;
      }
      if (batch.length < 100) break;
    }
  }

  const langBytes = {};
  for (const repo of repos) {
    try {
      const langs = await gh("/repos/" + USER + "/" + repo.name + "/languages");
      for (const [k, v] of Object.entries(langs)) langBytes[k] = (langBytes[k] || 0) + v;
    } catch {
    }
  }
  const sorted = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
  const topLang = sorted.length ? sorted[0][0] : "-";

  return {
    user,
    repos,
    hours,
    dows,
    commits,
    first,
    last,
    topLang,
    stars: repos.reduce((n, r) => n + r.stargazers_count, 0),
  };
}

/* ---------- XP window chrome ---------- */

function captionGlyph(kind, bx) {
  const cx = bx + 10;
  const cy = 15;
  if (kind === "min") {
    return (
      '<line x1="' + (cx - 4) + '" y1="19" x2="' + (cx + 4) + '" y2="19" ' +
      'stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>'
    );
  }
  if (kind === "max") {
    return (
      '<rect x="' + (cx - 4.5) + '" y="' + (cy - 4.5) + '" width="9" height="9" ' +
      'fill="none" stroke="#FFFFFF" stroke-width="1.3"/>' +
      '<line x1="' + (cx - 4.5) + '" y1="' + (cy - 3.4) + '" x2="' + (cx + 4.5) + '" y2="' + (cy - 3.4) + '" ' +
      'stroke="#FFFFFF" stroke-width="2"/>'
    );
  }
  return (
    '<line x1="' + (cx - 3.3) + '" y1="' + (cy - 3.3) + '" x2="' + (cx + 3.3) + '" y2="' + (cy + 3.3) + '" ' +
    'stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="' + (cx - 3.3) + '" y1="' + (cy + 3.3) + '" x2="' + (cx + 3.3) + '" y2="' + (cy - 3.3) + '" ' +
    'stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>'
  );
}

function windowFrame(x, y, w, h, title) {
  const r = 8;
  const tb = 30;
  const buttons = [
    ["min", "url(#btnblue)"],
    ["max", "url(#btnblue)"],
    ["close", "url(#closeb)"],
  ]
    .map(([kind, fill], i) => {
      const bw = 20;
      const gap = 3;
      const bx = w - 8 - (3 - i) * (bw + gap) + gap;
      return (
        '<rect x="' + bx + '" y="6" width="' + bw + '" height="18" rx="3" fill="' + fill +
        '" stroke="#FFFFFF" stroke-opacity="0.65"/>' +
        captionGlyph(kind, bx)
      );
    })
    .join("");
  return (
    '<g transform="translate(' + x + ',' + y + ')">' +
    '<path d="M0 ' + r + " A " + r + " " + r + " 0 0 1 " + r + " 0 L " + (w - r) + " 0 A " + r + " " + r +
    " 0 0 1 " + w + " " + r + " L " + w + " " + h + " L 0 " + h + ' Z" fill="' + C.frame + '"/>' +
    '<path d="M0 ' + r + " A " + r + " " + r + " 0 0 1 " + r + " 0 L " + (w - r) + " 0 A " + r + " " + r +
    " 0 0 1 " + w + " " + r + " L " + w + " " + tb + " L 0 " + tb + ' Z" fill="url(#luna)"/>' +
    '<rect x="3" y="' + tb + '" width="' + (w - 6) + '" height="' + (h - tb - 3) + '" fill="' + C.face + '"/>' +
    '<text x="13" y="' + (tb - 10) + '" font-family="' + FONT + '" font-size="13" font-weight="bold" ' +
    'fill="#FFFFFF" style="paint-order:stroke" stroke="' + C.titleDark + '" stroke-width="2.2" ' +
    'stroke-linejoin="round">' + esc(title) + "</text>" +
    buttons +
    "</g>"
  );
}

const groupBox = (x, y, w, h, label) =>
  '<g transform="translate(' + x + "," + y + ')">' +
  '<rect x="0" y="7" width="' + w + '" height="' + (h - 7) + '" rx="3" fill="none" stroke="' + C.groove + '"/>' +
  '<rect x="8" y="0" width="' + (label.length * 6.6 + 8) + '" height="14" fill="' + C.face + '"/>' +
  '<text x="12" y="11" font-family="' + FONT + '" font-size="11" fill="' + C.inkSoft + '">' + esc(label) + "</text>" +
  "</g>";

/* ---------- Card 1: System Properties ---------- */
function cardProfile(d, x, y, w, h) {
  const monthYear = new Date(d.user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const rows = [
    ["Registered:", monthYear],
    ["Location:", d.user.location || "-"],
    ["Public repos:", String(d.user.public_repos)],
    ["Followers:", String(d.user.followers)],
    ["Primary language:", d.topLang],
  ];
  const lines = rows
    .map((rw, i) => {
      const ry = 122 + i * 19;
      return (
        '<text x="32" y="' + ry + '" font-family="' + FONT + '" font-size="12" fill="' + C.inkSoft + '">' + esc(rw[0]) + "</text>" +
        '<text x="150" y="' + ry + '" font-family="' + FONT + '" font-size="12" font-weight="bold" fill="' + C.ink + '">' + esc(rw[1]) + "</text>"
      );
    })
    .join("");
  return (
    windowFrame(x, y, w, h, "System Properties") +
    '<g transform="translate(' + x + "," + y + ')">' +
    groupBox(16, 44, w - 32, h - 62, "General") +
    '<text x="32" y="76" font-family="' + FONT + '" font-size="15" font-weight="bold" fill="' + C.ink + '">' +
    esc(d.user.name || USER) + "</text>" +
    '<text x="32" y="93" font-family="' + FONT + '" font-size="11" fill="' + C.inkSoft + '">github.com/' + USER + "</text>" +
    '<line x1="32" y1="103" x2="' + (w - 32) + '" y2="103" stroke="' + C.groove + '" stroke-dasharray="2 2"/>' +
    lines +
    "</g>"
  );
}

/* ---------- Card 2: Commit activity by hour ---------- */
function cardHours(d, x, y, w, h) {
  const padL = 34, padR = 20, padT = 58, padB = 44;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const peakVal = Math.max(1, ...d.hours);
  const max = niceMax(peakVal);
  const bw = cw / 24;
  const peak = d.hours.indexOf(peakVal);

  const bars = d.hours
    .map((v, i) => {
      const bh = (v / max) * ch;
      const bx = padL + i * bw + 1.2;
      const by = padT + ch - bh;
      if (v === 0)
        return '<rect x="' + bx + '" y="' + (padT + ch - 1.5) + '" width="' + (bw - 2.4) +
          '" height="1.5" fill="' + C.groove + '"/>';
      return '<rect x="' + bx + '" y="' + by + '" width="' + (bw - 2.4) + '" height="' + bh +
        '" fill="url(#grass)" stroke="' + C.grassDark + '" stroke-width="0.5"/>';
    })
    .join("");

  const ticks = [0, 6, 12, 18, 23]
    .map(
      (hh) =>
        '<text x="' + (padL + hh * bw + bw / 2) + '" y="' + (padT + ch + 15) + '" font-family="' + FONT +
        '" font-size="10" fill="' + C.inkSoft + '" text-anchor="middle">' + hh + "</text>"
    )
    .join("");

  const grid = [0, 0.5, 1]
    .map((f) => {
      const gy = padT + ch - f * ch;
      return (
        '<line x1="' + padL + '" y1="' + gy + '" x2="' + (padL + cw) + '" y2="' + gy + '" stroke="' + C.groove +
        '" stroke-opacity="' + (f === 0 ? 1 : 0.45) + '"/>' +
        '<text x="' + (padL - 6) + '" y="' + (gy + 3.5) + '" font-family="' + FONT + '" font-size="9" fill="' +
        C.inkSoft + '" text-anchor="end">' + Math.round(f * max) + "</text>"
      );
    })
    .join("");

  const fmt = (dt, withYear) =>
    dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  const span = d.first && d.last ? fmt(d.first, false) + " - " + fmt(d.last, true) : "-";

  return (
    windowFrame(x, y, w, h, "Commit Activity") +
    '<g transform="translate(' + x + "," + y + ')">' +
    '<text x="16" y="50" font-family="' + FONT + '" font-size="11" fill="' + C.inkSoft +
    '">Commits by hour (UTC' + UTC_OFFSET + ")</text>" +
    grid + bars + ticks +
    '<text x="16" y="' + (h - 14) + '" font-family="' + FONT + '" font-size="11" fill="' + C.ink + '">' +
    '<tspan font-weight="bold">' + d.commits + "</tspan> commits &#183; " + esc(span) +
    ' &#183; peak <tspan font-weight="bold">' + peak + ":00</tspan></text>" +
    "</g>"
  );
}

/* ---------- Card 3: Commits by day of week ---------- */
function cardWeek(d, x, y, w, h) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(1, ...d.dows);
  const padL = 16, padR = 16, padT = 56;
  const cw = w - padL - padR;
  const cellW = cw / 7;
  const barMax = h - padT - 26;

  const cells = d.dows
    .map((v, i) => {
      const bh = Math.max(2, (v / max) * barMax);
      const bx = x + padL + i * cellW + 10;
      const bWidth = cellW - 20;
      const by = y + padT + barMax - bh;
      const weekend = i === 0 || i === 6;
      const inside = bh > 26;
      const labelY = inside ? by + 15 : by - 5;
      const labelFill = inside ? "#FFFFFF" : C.ink;
      return (
        '<rect x="' + bx + '" y="' + by + '" width="' + bWidth + '" height="' + bh + '" fill="' +
        (weekend ? "url(#grass)" : "url(#sky)") + '" stroke="' + (weekend ? C.grassDark : C.skyDark) +
        '" stroke-width="0.5"/>' +
        '<text x="' + (bx + bWidth / 2) + '" y="' + labelY + '" font-family="' + FONT +
        '" font-size="11" font-weight="bold" fill="' + labelFill + '" text-anchor="middle">' + v + "</text>" +
        '<text x="' + (bx + bWidth / 2) + '" y="' + (y + padT + barMax + 15) + '" font-family="' + FONT +
        '" font-size="11" fill="' + C.inkSoft + '" text-anchor="middle">' + names[i] + "</text>"
      );
    })
    .join("");

  return (
    windowFrame(x, y, w, h, "Commits by Day of Week") +
    '<text x="' + (x + 16) + '" y="' + (y + 42) + '" font-family="' + FONT + '" font-size="11" fill="' +
    C.inkSoft + '">Weekends in Bliss green</text>' +
    cells
  );
}

const defs =
  "<defs>" +
  '<linearGradient id="luna" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="' + C.titleLite + '"/>' +
  '<stop offset="45%" stop-color="' + C.titleMid + '"/>' +
  '<stop offset="100%" stop-color="' + C.titleDark + '"/></linearGradient>' +
  '<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="' + C.grassLite + '"/>' +
  '<stop offset="100%" stop-color="' + C.grassDark + '"/></linearGradient>' +
  '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="' + C.skyLite + '"/>' +
  '<stop offset="100%" stop-color="' + C.skyDark + '"/></linearGradient>' +
  '<linearGradient id="btnblue" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="#7CBBF9"/>' +
  '<stop offset="100%" stop-color="#2E7BD6"/></linearGradient>' +
  '<linearGradient id="closeb" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="' + C.closeA + '"/>' +
  '<stop offset="100%" stop-color="' + C.closeB + '"/></linearGradient>' +
  "</defs>";

const svg = (w, h, body) =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w +
  " " + h + '" role="img">' + defs + body + "</svg>\n";

/* ---------- main ---------- */
const d = await collect();
mkdirSync(OUT, { recursive: true });

const W = 980;
const CARD_W = 470;
const CARD_H = 240;

writeFileSync(
  join(OUT, "xp-stats.svg"),
  svg(W, CARD_H, cardProfile(d, 0, 0, CARD_W, CARD_H) + cardHours(d, W - CARD_W, 0, CARD_W, CARD_H))
);
writeFileSync(join(OUT, "xp-week.svg"), svg(W, 165, cardWeek(d, 0, 0, W, 165)));

console.log("assets/xp-stats.svg + assets/xp-week.svg written");
console.log(
  "  " + d.commits + " commits across " + d.repos.length + " public repo(s), top language " + d.topLang
);
