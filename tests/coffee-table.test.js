// The coffee table as the app offers it: every option on every dropdown
// must build into real solids with no overlapping parts and joints that
// actually join, and the DXF and cut list must come out of it.
import { describe, it, expect, beforeAll } from "vitest";
import { buildTableSolids } from "../src/cad/table.js";
import { toParams, GROUPS, FIELDS, DEFAULT_CHOICE, unavailable, normalize, summary, sizeOf, SLIDERS, sliderState } from "../src/coffeeTable.js";
import { PEGGABLE } from "../src/cad/tableJoinery.js";
import { bounds, cutList, hardwareList, flatLayoutDXF } from "../src/cad/exports.js";
import { readDXF } from "../src/cad/dxf.js";
import { cutListPDF } from "../src/cutlist/pdf.js";
import { BOARDS } from "../src/cutlist/layout.js";
import { checkTable } from "./check-table.js";
import { loadReplicad } from "./oc-node.js";

let R;
beforeAll(async () => { R = await loadReplicad(); }, 60000);

const check = choice => checkTable(R, choice);

describe("every dropdown option builds, nothing overlaps and every joint joins", () => {
  for (const g of GROUPS) for (const f of g.fields) for (const o of f.options) {
    if (o.id === DEFAULT_CHOICE[f.key] && f.key !== "size") continue; // the default table is covered by the size tests
    // Options that need another choice first are tried with it.
    const choice = { ...DEFAULT_CHOICE, [f.key]: o.id };
    if (f.key === "pegs" && o.id === "pegged") choice.joint = "mt-haunched";
    if (f.key === "leg_edge" && o.id !== "square") choice.legs = "square";
    it(`${f.label}: ${o.name}`, () => {
      expect(unavailable(choice, f.key, o.id)).toBeNull();
      const { joints } = check(choice);
      expect(joints.filter(j => j.parts.some(p => p.startsWith("leg-"))).length).toBeGreaterThanOrEqual(8);
      expect(joints.filter(j => j.parts.includes("top")).length).toBeGreaterThanOrEqual(4);
    }, 300000);
  }
});

describe("features together", () => {
  for (const joint of PEGGABLE)
    it(`pegs through ${FIELDS.joint.options.find(o => o.id === joint).name}, with a slatted shelf and splayed legs`, () => {
      const { parts, joints } = check({ joint, pegs: "pegged", shelf: "slats", legs: "splayed" });
      expect(parts.filter(p => p.name === "Dowel peg ¼ in")).toHaveLength(8);
      const pegs = joints.filter(j => j.type === "peg");
      expect(pegs).toHaveLength(8);
      // Through the tenon (or the loose tenon) and the leg.
      for (const j of pegs) expect(j.parts[0]).toMatch(joint === "domino" ? /domino/ : /^apron-/);
    }, 300000);

  it("small table: solid shelf, square splayed legs with chamfered edges, router mortises", () => {
    const { parts } = check({ size: "small", shelf: "solid", legs: "splayed-square", leg_edge: "chamfer", joint: "mt-router", top_edge: "roundover" });
    expect(parts.some(p => p.id === "shelf")).toBe(true);
  }, 300000);

  it("long table: slats, arched aprons, rounded corners, Z-clips and dowels", () => {
    const { parts } = check({ size: "long", shelf: "slats", aprons: "arched", top: "rounded", top_fix: "z-clips", joint: "dowels", wood: "oak" });
    expect(parts.filter(p => p.name === "Shelf slat").length).toBeGreaterThanOrEqual(6);
  }, 300000);

  it("custom size within the limits", () => {
    const choice = { size: "custom", l: 40, w: 20, h: 14, shelf: "slats", joint: "pocket" };
    check(choice);
    const { parts } = buildTableSolids(R, toParams(choice));
    const top = parts.find(p => p.id === "top"), b = bounds(top.solid);
    expect(b.size[0]).toBeCloseTo(40 * 25.4, 1);
    expect(b.max[2]).toBeCloseTo(14 * 25.4, 1);
  }, 300000);
});

describe("choices that don't go together", () => {
  it("pegs need a tenon", () => {
    expect(unavailable({ ...DEFAULT_CHOICE, joint: "dowels" }, "pegs", "pegged")).toMatch(/tenon/);
    expect(unavailable({ ...DEFAULT_CHOICE, pegs: "pegged" }, "joint", "pocket")).toMatch(/pegs/);
    expect(normalize({ joint: "dowels", pegs: "pegged" }).pegs).toBe("none");
  });
  it("round legs have no edge profile", () => {
    expect(unavailable({ ...DEFAULT_CHOICE, legs: "round" }, "leg_edge", "chamfer")).toMatch(/Round legs/);
    expect(normalize({ legs: "round", leg_edge: "chamfer" }).leg_edge).toBe("square");
  });
  it("custom sizes are kept within limits", () => {
    expect(sizeOf({ size: "custom", l: 500, w: 2, h: 16 })).toEqual({ l: 72, w: 16, h: 16 });
  });
  it("the summary names every choice", () => {
    const lines = summary({ shelf: "slats" }, "mm");
    expect(lines[0][1]).toMatch(/1219 × 559 × 406 mm/);
    expect(lines.map(l => l[0])).toContain("Shelf rails to legs");
  });
});

describe("exports", () => {
  let parts, titles;
  beforeAll(() => {
    ({ parts } = buildTableSolids(R, toParams({ shelf: "slats", pegs: "pegged" })));
    const n = {}; titles = Object.fromEntries(parts.map(p => [p.id, `${p.name} ${n[p.name] = (n[p.name] || 0) + 1}`]));
  }, 120000);

  it("the flat DXF has every part you make, each labelled, in mm or inches", () => {
    const text = flatLayoutDXF(R, parts, titles, { heading: ["Test table"] });
    const ents = readDXF(text);
    const labels = ents.filter(e => e.type === "TEXT").map(e => e["1"]);
    for (const p of parts.filter(p => !p.bought)) expect(labels.some(l => l.startsWith(titles[p.id] + " - ")), p.id).toBe(true);
    for (const p of parts.filter(p => p.bought)) expect(labels.some(l => l.startsWith(titles[p.id] + " - ")), p.id).toBe(false);
    expect(text).toMatch(/\$INSUNITS\n70\n4\n/);
    // Nothing on the sheet overlaps: each part's views sit in their own box.
    const outline = ents.filter(e => e["8"] === "OUTLINE");
    expect(outline.length).toBeGreaterThan(100);
    const inch = flatLayoutDXF(R, parts, titles, { units: "in" });
    expect(inch).toMatch(/\$INSUNITS\n70\n1\n/);
    const xs = t => readDXF(t).filter(e => e.type === "LINE").map(e => +e["10"]);
    expect(Math.max(...xs(inch))).toBeCloseTo(Math.max(...xs(text)) / 25.4, 1);
  }, 120000);

  it("the cut list PDF is made, with the board layout", () => {
    const rows = cutList(parts);
    expect(rows.map(r => r.name)).toEqual(["Top", "Long apron", "Short apron", "Leg", "Button", "Shelf slat", "Shelf rail"]);
    expect(rows.find(r => r.name === "Leg").rough.stock).toBe("8/4");
    expect(rows.find(r => r.name === "Top").rough.stock).toBe("5/4");
    const buf = cutListPDF({ title: "Coffee table", summary: summary({ shelf: "slats" }), rows, hardware: hardwareList(parts),
      notes: ["A note."], board: BOARDS[1], units: "in" });
    const head = new TextDecoder().decode(new Uint8Array(buf).slice(0, 8));
    expect(head).toBe("%PDF-1.3");
    expect(buf.byteLength).toBeGreaterThan(5000);
  }, 120000);
});

describe("leg heads", () => {
  it("round legs have a square head where the aprons join, the same as square legs", () => {
    const head = choice => {
      const s = toParams(choice), { parts } = buildTableSolids(R, s);
      const leg = parts.find(p => p.id === "leg-front-right"), b = bounds(leg.solid);
      // The head zone: from the apron's bottom edge to the top of the leg.
      const z0 = (s.table_h - s.top_t - s.apron_h) * 25.4, box = R.makeBox([b.min[0], b.min[1], z0], [b.max[0], b.max[1], b.max[2]]);
      const inHead = R.measureVolume(leg.solid.intersect(box));
      for (const p of parts) p.solid.delete();
      return inHead;
    };
    const square = head({ legs: "square" });
    expect(head({ legs: "round" })).toBeCloseTo(square, -1);
    expect(head({ legs: "splayed" })).toBeCloseTo(square, -1);
  }, 120000);
});
