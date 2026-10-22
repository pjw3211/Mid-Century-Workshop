// Every slider, at both ends of its range, must still build a table with
// no overlapping parts and joints that join.
import { describe, it, expect, beforeAll } from "vitest";
import { toParams, DEFAULT_CHOICE, SLIDERS, sliderState } from "../src/coffeeTable.js";
import { checkTable } from "./check-table.js";
import { loadReplicad } from "./oc-node.js";

let R;
beforeAll(async () => { R = await loadReplicad(); }, 60000);
const check = choice => checkTable(R, choice);

describe("every slider at both ends builds, nothing overlaps and every joint joins", () => {
  // Each slider with the choice that shows it.
  const NEEDS = { splay_ang: { legs: "splayed" }, arch_rise: { aprons: "arched" }, corner_r: { top: "rounded" },
    se_n: { top: "se" }, shelf_h: { shelf: "slats" } };
  for (const sl of SLIDERS) for (const end of ["min", "max"])
    it(`${sl.label}: ${end}`, () => {
      const base = { ...DEFAULT_CHOICE, ...NEEDS[sl.key] };
      const st = sliderState(base)[sl.key];
      expect(st, "slider shows").toBeTruthy();
      const choice = { ...base, [sl.key]: st[end] };
      expect(toParams(choice)[sl.key]).toBeCloseTo(st[end], 5);
      check(choice);
    }, 300000);

  it("all sliders low on a small table, and all high on a long one", () => {
    for (const [size, end] of [["small", "min"], ["long", "max"]]) {
      let choice = { size, legs: "splayed-square", aprons: "arched", top: "rounded", shelf: "solid", joint: "domino", pegs: "pegged" };
      for (const sl of SLIDERS) { const st = sliderState(choice)[sl.key]; if (st) choice = { ...choice, [sl.key]: st[end] }; }
      check(choice);
    }
  }, 600000);

  it("legs stay under a superellipse or rounded top", () => {
    for (const choice of [{ top: "se", se_n: 2.5, inset_x: 2.5, inset_y: 2 }, { top: "rounded", corner_r: 10, inset_x: 2.5, inset_y: 2 }]) {
      const s = toParams(choice), a = s.table_l / 2, b = s.table_w / 2;
      const x = a - s.inset_x + s.leg_sq / 2, y = b - s.inset_y + s.leg_sq / 2;
      if (s.top_mode === "se") expect((x / a) ** s.se_n + (y / b) ** s.se_n).toBeLessThan(1);
      else expect(Math.hypot(x - (a - s.corner_r), y - (b - s.corner_r))).toBeLessThan(s.corner_r);
    }
  });
});
