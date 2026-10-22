// Build the coffee table for a set of choices and check it: every part a
// real solid, nothing overlapping, every joint joining. Frees the solids
// afterwards (the engine's memory is shared by every test in a file).
import { expect } from "vitest";
import { buildTableSolids } from "../src/cad/table.js";
import { toParams } from "../src/coffeeTable.js";
import { bounds } from "../src/cad/exports.js";
import { overlaps, missingJoints } from "./joinery-helpers.js";

export function checkTable(R, choice) {
  const { parts, joints, notes } = buildTableSolids(R, toParams(choice));
  const built = parts.map(p => {
    const { min, max } = bounds(p.solid);
    return { b: { id: p.id, kind: p.kind }, solid: p.solid, box: { min, max } };
  });
  for (const x of built) expect(R.measureVolume(x.solid), x.b.id).toBeGreaterThan(1);
  expect(overlaps(R, built), "overlapping parts").toEqual([]);
  expect(missingJoints(R, { joints }, built), "joints that don't join").toEqual([]);
  // Free the solids: the engine's memory is shared by every test in the file.
  for (const p of parts) p.solid.delete();
  return { parts, joints, notes };
}
