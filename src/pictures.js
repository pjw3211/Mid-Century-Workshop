// Small drawings for each choice, as inline SVG (120 × 84). Wood is brown,
// the part that the choice is about is picked out in the accent colour,
// hidden parts (mortises, holes) are dashed, hardware is grey.

const W = "#9a6a45", WD = "#6f4a30", INK = "#2b2118", ACC = "#c0612b", STEEL = "#8a9096", PALE = "#eadbb8";
const svg = body => `<svg viewBox="0 0 120 84" aria-hidden="true">${body}</svg>`;
const r = (x, y, w, h, fill = W, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${INK}" stroke-width="1.2" ${extra}/>`;
const p = (d, fill = W, extra = "") => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" ${extra}/>`;
const dash = 'stroke-dasharray="3 2"';
const c = (x, y, rad, fill = ACC) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${INK}" stroke-width="1"/>`;

// A table seen from the front: top, apron and two legs drawn by `legs`.
function table({ legs, apron = r(22, 26, 76, 9, WD), top = p("M10 18 H110 L106 26 H14 Z"), extra = "" }) {
  return svg(top + apron + legs + extra);
}
const LEG = {
  square: p("M22 26 h9 l-2 50 h-5 Z") + p("M89 26 h9 l-2 50 h-5 Z", W),
  round: p("M22 26 h9 l-2.5 48 q-2 3 -4 0 Z") + p("M89 26 h9 l-2.5 48 q-2 3 -4 0 Z"),
  splayed: p("M23 26 h9 l-10 48 q-2.5 2.5 -4.5 -0.5 Z") + p("M88 26 h9 l7 48 q-2 3 -4.5 0.5 Z"),
  "splayed-square": p("M23 26 h9 l-10 50 h-5 Z") + p("M88 26 h9 l7 50 h-5 Z"),
};
const SECTION = { square: r(104, 4, 10, 10, ACC), round: c(109, 9, 5.5), splayed: c(109, 9, 5.5), "splayed-square": r(104, 4, 10, 10, ACC) };

const legs = id => table({ legs: LEG[id], extra: SECTION[id] });

const aprons = {
  straight: table({ legs: LEG.square, apron: r(31, 26, 58, 11, ACC) }),
  arched: table({ legs: LEG.square, apron: p("M31 26 H89 V38 Q60 26 31 38 Z", ACC) }),
};

function seOutline(n, cx = 60, cy = 42, a = 50, b = 26) {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const t = i / 64 * 2 * Math.PI, co = Math.cos(t), si = Math.sin(t);
    const rad = (Math.abs(co / a) ** n + Math.abs(si / b) ** n) ** (-1 / n);
    pts.push(`${(cx + rad * co).toFixed(1)} ${(cy + rad * si).toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
}
const top = {
  square: svg(r(10, 16, 100, 52, ACC)),
  rounded: svg(r(10, 16, 100, 52, ACC, 'rx="12"')),
  se: svg(p(seOutline(2.5), ACC)),
};

// Shelf: the table from slightly above, the shelf as a slanted board.
const shelfBase = LEG.square;
const shelf = {
  none: table({ legs: shelfBase }),
  slats: table({ legs: shelfBase, extra: [0, 1, 2, 3, 4].map(i => p(`M${30 + i * 2} ${56 + i * 3.2} H${90 + i * 2} l1 -2 H${31 + i * 2} Z`, ACC)).join("") }),
  solid: table({ legs: shelfBase, extra: p("M30 58 H92 l8 -9 H38 Z", ACC) + r(30, 58, 62, 3, ACC) }),
};

// Pegs: the head of a leg with the apron joining it.
const legHead = (extra = "") => svg(r(14, 8, 92, 8, WD) + r(36, 16, 30, 64) + r(66, 22, 46, 26, WD) + `<rect x="44" y="26" width="22" height="18" fill="none" stroke="${INK}" ${dash}/>` + extra);
const pegs = { none: legHead(), pegged: legHead(c(51, 31, 3.2) + c(51, 40, 3.2)) };

const swatch = (base, line) => svg(r(10, 12, 100, 60, base) + [0, 1, 2, 3, 4, 5].map(i =>
  `<path d="M10 ${20 + i * 9} C40 ${16 + i * 9}, 70 ${26 + i * 9}, 110 ${19 + i * 9}" fill="none" stroke="${line}" stroke-width="1.4" opacity=".7"/>`).join(""));
const wood = { walnut: swatch("#5a3a24", "#3e2717"), teak: swatch("#9a6634", "#74491f"), oak: swatch("#c9a77a", "#a8865a") };

// Top edge: the end of the top board, cut through.
const topEdge = {
  bevel: svg(p("M10 30 H96 V40 L82 56 H10 Z", ACC)),
  square: svg(p("M10 30 H96 V56 H10 Z", ACC)),
  eased: svg(p("M10 30 H93 Q96 30 96 33 V53 Q96 56 93 56 H10 Z", ACC)),
  roundover: svg(p("M10 30 H86 Q96 30 96 40 V46 Q96 56 86 56 H10 Z", ACC)),
  chamfer: svg(p("M10 30 H89 L96 37 V49 L89 56 H10 Z", ACC)),
};
// Leg edges: the leg cut across.
const legEdge = {
  square: svg(r(36, 18, 48, 48, ACC)),
  eased: svg(r(36, 18, 48, 48, ACC, 'rx="5"')),
  chamfer: svg(p("M45 18 H75 L84 27 V57 L75 66 H45 L36 57 V27 Z", ACC)),
};

// Joints: the leg (upright, left) and the apron (right), pulled apart.
const LEGJ = r(10, 6, 30, 74);
const APR = (x = 62) => r(x, 22, 120 - x - 4, 40, WD);
const mortise = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fffaf2" stroke="${INK}" ${dash}/>`;
const joint = {
  "mt-haunched": svg(LEGJ + mortise(24, 22, 16, 30) + APR() + p("M62 22 H50 V30 H44 V52 H62 Z", ACC)),
  "mt-router": svg(LEGJ + mortise(24, 28, 16, 26) + APR() + p("M62 28 H48 Q42 28 42 34 V48 Q42 54 48 54 H62 Z", ACC)),
  domino: svg(LEGJ + mortise(26, 26, 14, 10) + mortise(26, 46, 14, 10) + APR(70) + r(44, 26, 22, 10, ACC, 'rx="5"') + r(44, 46, 22, 10, ACC, 'rx="5"')),
  dowels: svg(LEGJ + mortise(28, 28, 12, 7) + mortise(28, 48, 12, 7) + APR(70) + r(46, 28, 20, 7, ACC, 'rx="3"') + r(46, 48, 20, 7, ACC, 'rx="3"')),
  bracket: svg(r(10, 10, 26, 26) + r(36, 14, 74, 12, WD) + r(14, 36, 12, 42, WD) + p("M30 72 L30 62 L80 26 L90 26 Z", STEEL) + p("M33 33 L58 52", "none", `stroke="${ACC}" stroke-width="4"`) + c(58, 52, 4, STEEL)),
  pocket: svg(LEGJ + APR(40) + p("M90 70 L44 42", "none", `stroke="${ACC}" stroke-width="3.5"`) + p("M86 66 l12 8 l-2 4 l-12 -8 Z", "#fffaf2", dash)),
  wedged: svg(r(30, 6, 28, 74) + APR(58) + p("M58 30 H22 V54 H58", ACC) + p("M22 36 l9 2 l-9 2 Z M22 44 l9 2 l-9 2 Z", PALE)),
};
// Top fixings: the top above, an apron below, cut across.
const T = r(6, 8, 108, 14, WD), AP = r(40, 22, 22, 56);
const fixing = {
  buttons: svg(T + AP + mortise(56, 30, 6, 5) + p("M62 22 H86 V34 H58 V30 H62 Z", ACC) + p("M76 34 V14", "none", `stroke="${STEEL}" stroke-width="2.5"`)),
  "z-clips": svg(T + AP + mortise(57, 30, 5, 3) + p("M58 31 H66 V22 H84 V25 H69 V34 H58 Z", STEEL) + p("M78 22 V14", "none", `stroke="${INK}" stroke-width="2"`)),
  "figure-8": svg(T + AP + c(51, 22, 7, STEEL) + c(66, 20, 6, STEEL) + p("M51 22 V34 M66 20 V12", "none", `stroke="${INK}" stroke-width="1.6"`)),
  blocks: svg(r(8, 8, 104, 12, WD) + r(8, 8, 12, 70, WD) + p("M20 20 H58 L20 58 Z", ACC) + c(32, 32, 3, STEEL)),
};

const ALL = { legs: Object.fromEntries(Object.keys(LEG).map(k => [k, legs(k)])), aprons, top, shelf, pegs, wood,
  top_edge: topEdge, leg_edge: legEdge, joint, top_fix: fixing };

/** SVG markup for a choice, or "" when there is no picture. */
export const picture = (key, id) => ALL[key]?.[id] || "";
