// Replays each stage's embedded solution through the SAME rule helpers the game
// uses (edgeKey / buildWallSet / buildNumberMap), asserting the move rules hold
// and the play ends in a full, ordered, wall-respecting solve.
import { STAGES } from "../src/game/stages.js";
import { edgeKey, buildWallSet, buildNumberMap, cellKey } from "../src/game/logic.js";

const adjacent = (a, b) =>
  (a[0] === b[0] && Math.abs(a[1] - b[1]) === 1) ||
  (a[1] === b[1] && Math.abs(a[0] - b[0]) === 1);

let allOk = true;
for (const stage of STAGES) {
  const N = stage.size;
  const total = N * N;
  const walls = buildWallSet(stage.walls);
  const { map: numberMap, max, startCell } = buildNumberMap(stage.numbers);
  const sol = stage.solution;
  const errs = [];

  // 1. starts on the "1" cell
  if (!startCell || cellKey(...startCell) !== cellKey(sol[0][0], sol[0][1]))
    errs.push("does not start at number 1");

  // 2. covers every cell exactly once
  const seen = new Set();
  for (const [r, c] of sol) seen.add(cellKey(r, c));
  if (seen.size !== total || sol.length !== total)
    errs.push(`coverage ${seen.size}/${total} (len ${sol.length})`);

  // 3. each step orthogonal, adjacent, and not blocked by a wall
  let numsHit = 0;
  const firstNum = numberMap.get(cellKey(sol[0][0], sol[0][1]));
  if (firstNum) numsHit = firstNum === 1 ? 1 : -999;
  for (let i = 1; i < sol.length; i++) {
    const a = sol[i - 1];
    const b = sol[i];
    if (!adjacent(a, b)) errs.push(`non-adjacent step at ${i}`);
    if (walls.has(edgeKey(a[0], a[1], b[0], b[1])))
      errs.push(`crosses a wall at step ${i}`);
    const v = numberMap.get(cellKey(b[0], b[1]));
    if (v !== undefined) {
      if (v !== numsHit + 1) errs.push(`number ${v} out of order at step ${i}`);
      numsHit = v;
    }
  }

  // 4. all numbers visited in order, ending on the max
  if (numsHit !== max) errs.push(`only reached number ${numsHit}/${max}`);

  const ok = errs.length === 0;
  allOk = allOk && ok;
  console.log(
    `stage ${String(stage.id).padStart(2)}  ${N}x${N}  ${
      ok ? "OK ✅" : "FAIL ❌ -> " + errs.join("; ")
    }`
  );
}

console.log(
  "\n" +
    (allOk ? `ALL ${STAGES.length} STAGES VALID ✅` : "SOME STAGES FAILED ❌")
);
process.exit(allOk ? 0 : 1);
