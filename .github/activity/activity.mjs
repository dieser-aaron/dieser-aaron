// draws assets/activity.svg: the last year of contributions as an ascii calendar in the site's style.
// no dependencies. needs GITHUB_TOKEN (the action passes it), or a logged in `gh` locally.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const USER = process.env.GH_USER || "dieser-aaron";

let token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) { try { token = execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {} }
if (!token) throw new Error("no token: set GITHUB_TOKEN or log in with gh");

const query = `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel weekday}}}}}}`;
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-activity" },
  body: JSON.stringify({ query, variables: { u: USER } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
const cal = json.data.user.contributionsCollection.contributionCalendar;
const weeks = cal.weeks.map((w) => w.contributionDays);
const total = cal.totalContributions;

/* ── look (same tokens as the site) ── */
const C = { bg: "#09090d", fg: "#eceef4", muted: "#a3a7b8", dim: "#646879", accent: "#a9bcff", online: "#7ed7a5", card: "rgba(10,10,15,.62)" };
const LV = {
  NONE: [".", "rgba(236,238,244,.14)"],
  FIRST_QUARTILE: [":", "#5d6584"],
  SECOND_QUARTILE: ["+", "#7a88bd"],
  THIRD_QUARTILE: ["*", "#94a6e6"],
  FOURTH_QUARTILE: ["#", C.accent],
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ADV = 0.6;
const n2 = (v) => (Math.round(v * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tw = (s, size) => s.length * size * ADV;
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const rnd = rng(7);

const W = 880, cx = 24, cy = 24, cwid = W - 48, P = 36;
const x0 = cx + P + 30, gx1 = cx + cwid - P;
const colW = (gx1 - x0) / weeks.length, rowH = 14, fsz = 13;
const headY = cy + 54, monthY = headY + 34, gridY = monthY + 12;
const legendY = gridY + 7 * rowH + 26;
const ch = legendY + 26 - cy;
const H = cy + ch + 24;

const css = [], body = [];
const keys = new Set();
const kf = (name, b) => { if (!keys.has(name)) { keys.add(name); css.push(`@keyframes ${name}{${b}}`); } return name; };
const text = (x, y, s, o = {}) => `<text x="${n2(x)}" y="${n2(y)}"${o.size ? ` font-size="${o.size}"` : ""}${o.weight ? ` font-weight="${o.weight}"` : ""} fill="${o.fill || C.fg}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.cls ? ` class="${o.cls}"` : ""}${o.style ? ` style="${o.style}"` : ""}>${esc(s)}</text>`;

css.push(`.rv{animation:rv .6s cubic-bezier(.2,.7,.2,1) both}`);
kf("rv", "from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}");
css.push(`.tw{animation:tw 4s ease-in-out infinite alternate}`);
kf("tw", "0%{opacity:1}100%{opacity:.25}");
css.push(`.cl{animation:cl .5s ease-out both}`);
kf("cl", "from{opacity:0}to{opacity:1}");
kf("vis", "0%,100%{visibility:visible}");
kf("hid", "0%,100%{visibility:hidden}");

// background and a few twinkling stars outside the card
body.push(`<g clip-path="url(#frame)"><rect width="${W}" height="${H}" fill="${C.bg}"/>`);
for (let i = 0; i < 46; i++) {
  const x = rnd() * W, y = rnd() * H;
  const inCard = x > cx - 4 && x < cx + cwid + 4 && y > cy - 4 && y < cy + ch + 4;
  if (inCard) continue;
  const g = rnd() > 0.85 ? "*" : rnd() > 0.5 ? "." : "'";
  body.push(text(x, y, g, { size: 9, fill: rnd() > 0.7 ? "#9aa6d6" : "#5a5e70", cls: "tw", style: `animation-duration:${n2(2 + rnd() * 5)}s;animation-delay:-${n2(rnd() * 6)}s` }));
}

// card
body.push(`<g filter="url(#shadow)"><rect x="${cx}" y="${cy}" width="${cwid}" height="${ch}" rx="18" fill="${C.card}"/></g>`);
body.push(`<rect x="${cx}" y="${cy}" width="${cwid}" height="${ch}" rx="18" fill="none" stroke="rgba(255,255,255,0.06)"/>`);

// title scrambles in, the total counts up
const head = [];
{
  const str = "activity", glyphs = "#%&*+=-:.<>/|~", total2 = 16, step = 0.032, delay = 0.25;
  for (let f = 1; f < total2; f++) {
    const done = Math.floor((f / total2) * str.length);
    const v = [...str].map((c, i) => (i < done ? c : glyphs[Math.floor(rnd() * glyphs.length)])).join("");
    head.push(text(cx + P, headY, v, { size: 26, weight: 700, style: `visibility:hidden;animation:vis ${step}s steps(1,end) ${n2(delay + (f - 1) * step)}s` }));
  }
  head.push(text(cx + P, headY, str, { size: 26, weight: 700, style: `animation:hid ${n2(delay + (total2 - 1) * step)}s steps(1,end)` }));
}
const label = " contributions in the last year";
const numX = gx1 - tw(label, 12);
const N = 24, dur = 1.4, d0 = 0.6;
for (let k = 1; k < N; k++) {
  const t = k / N, v = Math.round(total * (1 - Math.pow(1 - t, 3)));
  head.push(text(numX, headY - 2, v.toLocaleString("en-US"), { size: 14, weight: 700, anchor: "end", style: `visibility:hidden;animation:vis ${n2(dur / N)}s steps(1,end) ${n2(d0 + ((k - 1) * dur) / N)}s` }));
}
head.push(text(numX, headY - 2, total.toLocaleString("en-US"), { size: 14, weight: 700, anchor: "end", style: `animation:hid ${n2(d0 + dur * (1 - 1 / N))}s steps(1,end)` }));
head.push(text(gx1, headY - 2, label.trim(), { size: 12, fill: C.dim, anchor: "end" }));
body.push(`<g class="rv" style="animation-delay:.1s">${head.join("")}</g>`);

// month labels, like github: at the first week of each month, skipped when too close to the next
const marks = [];
weeks.forEach((w, i) => {
  const m = Number(w[0].date.slice(5, 7)) - 1;
  if (i === 0 || m !== Number(weeks[i - 1][0].date.slice(5, 7)) - 1) marks.push([i, m]);
});
const months = [];
marks.forEach(([i, m], k) => {
  const next = marks[k + 1] ? marks[k + 1][0] : weeks.length;
  if (next - i < 3) return;
  months.push(text(x0 + i * colW, monthY, MONTHS[m], { size: 11, fill: C.dim }));
});
body.push(`<g class="rv" style="animation-delay:.2s">${months.join("")}</g>`);

// weekday labels
const days = [[1, "mon"], [3, "wed"], [5, "fri"]].map(([d, s]) => text(cx + P, gridY + d * rowH + 10, s, { size: 10, fill: C.dim }));
body.push(`<g class="rv" style="animation-delay:.2s">${days.join("")}</g>`);

// the calendar: one ascii cell per day, columns wash in left to right
const grid = [];
let last = null;
weeks.forEach((w, i) => {
  const cells = w.map((d) => {
    const [g, col] = LV[d.contributionLevel] || LV.NONE;
    const x = x0 + i * colW + colW / 2, y = gridY + d.weekday * rowH + 10;
    last = { x, y, d };
    const glow = d.contributionLevel === "FOURTH_QUARTILE" ? ` filter="url(#glow)"` : "";
    return `<text x="${n2(x)}" y="${n2(y)}" fill="${col}" text-anchor="middle"${glow}>${esc(g)}</text>`;
  });
  grid.push(`<g class="cl" style="animation-delay:${n2(0.5 + i * 0.022)}s">${cells.join("")}</g>`);
});
body.push(`<g font-size="${fsz}">${grid.join("")}</g>`);

// today pings like the "active" dot on the site
if (last) {
  css.push(`.pg{animation:pg 2.4s cubic-bezier(0,0,.2,1) infinite;transform-box:fill-box;transform-origin:center}`);
  kf("pg", "0%{transform:scale(.6);opacity:.8}80%,100%{transform:scale(2.2);opacity:0}");
  body.push(`<circle cx="${n2(last.x)}" cy="${n2(last.y - 4)}" r="5" fill="none" stroke="${C.accent}" stroke-width="1.2" class="pg"/>`);
}

// legend
const lg = [];
let lx = gx1;
const items = ["FOURTH_QUARTILE", "THIRD_QUARTILE", "SECOND_QUARTILE", "FIRST_QUARTILE", "NONE"];
lg.push(text(lx, legendY, "more", { size: 11, fill: C.dim, anchor: "end" }));
lx -= tw("more", 11) + 10;
for (const k of items) { lg.push(text(lx - 5, legendY, LV[k][0], { size: fsz, fill: LV[k][1], anchor: "middle" })); lx -= 14; }
lg.push(text(lx - 4, legendY, "less", { size: 11, fill: C.dim, anchor: "end" }));
lg.push(text(cx + P, legendY, `@${USER}`, { size: 11, fill: C.dim }));
body.push(`<g class="rv" style="animation-delay:.3s">${lg.join("")}</g>`);
body.push("</g>");

const font = (w) => `@font-face{font-family:J;font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(HERE, `jbm-${w}.woff2`)).toString("base64")}) format("woff2")}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xml:space="preserve" role="img" aria-label="${total} contributions in the last year">
<title>${total} contributions in the last year</title>
<style>${font(400)}
${font(700)}
text{font-family:J,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0;white-space:pre}
${css.join("\n")}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs><clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath><filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b"/><feComponentTransfer in="b" result="c"><feFuncA type="linear" slope="0.6"/></feComponentTransfer><feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.55"/></filter></defs>
${body.join("\n")}
</svg>
`;
fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "assets/activity.svg"), svg);
console.log(`activity.svg  ${total} contributions, ${(svg.length / 1024).toFixed(0)} kb`);
