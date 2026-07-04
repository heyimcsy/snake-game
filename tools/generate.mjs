// Puzzle generator for "숲속 길잇기" (Forest Path)
// Strategy: build a real Hamiltonian path (guaranteed solvable), place numbers
// along it in order (1 at start, max at end), add walls that do NOT lie on the
// solution path, then try to force a UNIQUE solution by adding more off-path
// walls. Verified with a backtracking solver (connectivity + dead-end pruning).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- tiny seeded RNG (mulberry32) for reproducible output ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (r, c) => `${r},${c}`;
const edgeKey = (r1, c1, r2, c2) => {
  const a = `${r1},${c1}`;
  const b = `${r2},${c2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
};

function neighbors(r, c, N) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < N - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < N - 1) out.push([r, c + 1]);
  return out;
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- random Hamiltonian path via Warnsdorff-ish backtracking ----------
function randomHamPath(N, rng) {
  const total = N * N;
  const start = [Math.floor(rng() * N), Math.floor(rng() * N)];
  const visited = new Set([key(start[0], start[1])]);
  const path = [start];
  let steps = 0;
  const stepLimit = 2_000_000;

  function dfs() {
    if (path.length === total) return true;
    if (++steps > stepLimit) return false;
    const [r, c] = path[path.length - 1];
    // candidate unvisited neighbors, sorted by fewest onward options (Warnsdorff)
    let cand = neighbors(r, c, N).filter(([nr, nc]) => !visited.has(key(nr, nc)));
    cand = shuffle(cand, rng);
    cand.sort((A, B) => onward(A) - onward(B));
    for (const [nr, nc] of cand) {
      visited.add(key(nr, nc));
      path.push([nr, nc]);
      if (dfs()) return true;
      path.pop();
      visited.delete(key(nr, nc));
    }
    return false;
  }
  function onward([r, c]) {
    let n = 0;
    for (const [nr, nc] of neighbors(r, c, N))
      if (!visited.has(key(nr, nc))) n++;
    return n;
  }

  return dfs() ? path : null;
}

// ---------- solution counter (returns {count, aborted}) ----------
function countSolutions(N, numberGrid, wallSet, nodeLimit = 800000, solLimit = 2) {
  const total = N * N;
  let start = null;
  let maxNum = 0;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const v = numberGrid[r][c];
      if (v) {
        if (v === 1) start = [r, c];
        if (v > maxNum) maxNum = v;
      }
    }
  if (!start) return { count: 0, aborted: false };

  const visited = Array.from({ length: N }, () => Array(N).fill(false));
  let count = 0;
  let nodes = 0;
  let aborted = false;

  const blocked = (r, c, nr, nc) => wallSet.has(edgeKey(r, c, nr, nc));
  function avail(r, c) {
    const out = [];
    for (const [nr, nc] of neighbors(r, c, N))
      if (!visited[nr][nc] && !blocked(r, c, nr, nc)) out.push([nr, nc]);
    return out;
  }

  // prune: remaining unvisited region must be fully reachable from head (single
  // connected blob), and have at most one dead-end (the eventual endpoint).
  function pruneOK(hr, hc, remaining) {
    // reachability flood from head across unvisited cells
    const seen = new Set();
    const stack = [];
    for (const [nr, nc] of avail(hr, hc)) {
      const k = key(nr, nc);
      if (!seen.has(k)) {
        seen.add(k);
        stack.push([nr, nc]);
      }
    }
    let reach = 0;
    let deadEnds = 0;
    while (stack.length) {
      const [r, c] = stack.pop();
      reach++;
      const a = avail(r, c);
      if (a.length === 0) deadEnds++; // isolated within unvisited (endpoint only)
      for (const [nr, nc] of a) {
        const k = key(nr, nc);
        if (!seen.has(k)) {
          seen.add(k);
          stack.push([nr, nc]);
        }
      }
    }
    if (reach !== remaining) return false; // unreachable cells exist
    if (deadEnds > 1) return false; // can't have >1 forced endpoint
    return true;
  }

  function dfs(r, c, seq, len) {
    if (++nodes > nodeLimit) {
      aborted = true;
      return;
    }
    if (count >= solLimit) return;
    if (len === total) {
      if (seq === maxNum) count++;
      return;
    }
    if (!pruneOK(r, c, total - len)) return;
    for (const [nr, nc] of avail(r, c)) {
      const v = numberGrid[nr][nc];
      if (v && v !== seq + 1) continue;
      visited[nr][nc] = true;
      dfs(nr, nc, v ? v : seq, len + 1);
      visited[nr][nc] = false;
      if (count >= solLimit || aborted) return;
    }
  }

  visited[start[0]][start[1]] = true;
  dfs(start[0], start[1], 1, 1);
  return { count, aborted };
}

// ---------- place numbers along a path ----------
function placeNumbers(path, count) {
  const total = path.length;
  // indices along the path that receive numbers, strictly increasing
  const idxs = [0];
  if (count > 2) {
    const interior = new Set();
    // evenly spaced-ish interior positions with slight jitter kept deterministic
    for (let k = 1; k < count - 1; k++) {
      let idx = Math.round((k * (total - 1)) / (count - 1));
      idx = Math.min(total - 2, Math.max(1, idx));
      while (interior.has(idx) || idx === 0) idx++;
      interior.add(idx);
    }
    [...interior].sort((a, b) => a - b).forEach((i) => idxs.push(i));
  }
  idxs.push(total - 1);
  const numbers = {};
  idxs.forEach((pathIdx, order) => {
    const [r, c] = path[pathIdx];
    numbers[key(r, c)] = order + 1;
  });
  return numbers;
}

// ---------- build number grid helper ----------
function numberGridFrom(N, numbers) {
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  for (const [k, v] of Object.entries(numbers)) {
    const [r, c] = k.split(",").map(Number);
    g[r][c] = v;
  }
  return g;
}

// ---------- candidate off-path walls ----------
function offPathWalls(N, path) {
  const onPath = new Set();
  for (let i = 1; i < path.length; i++) {
    const [r1, c1] = path[i - 1];
    const [r2, c2] = path[i];
    onPath.add(edgeKey(r1, c1, r2, c2));
  }
  const cands = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (c < N - 1) {
        const e = edgeKey(r, c, r, c + 1);
        if (!onPath.has(e)) cands.push(e);
      }
      if (r < N - 1) {
        const e = edgeKey(r, c, r + 1, c);
        if (!onPath.has(e)) cands.push(e);
      }
    }
  return cands;
}

function wallsToArray(wallSet) {
  return [...wallSet].map((e) => {
    const [a, b] = e.split("|");
    return { a, b };
  });
}

// ---------- prune to a MINIMAL wall set (for "open" boards) ----------
// Given a wall set that already forces a unique solution, drop every wall that
// isn't load-bearing: remove it, and if the solution is still unique keep it
// removed. The result is the fewest walls that still pin the answer — a more
// OPEN board where the path direction is far less forced, which plays harder
// (fewer forced corridors to coast along). Only used for the later stages.
function pruneWalls(N, grid, wallSet, rng, minKeep = 0, maxMs = 20000) {
  const keep = new Set(wallSet);
  // Bound each uniqueness re-check: on an open board a full "confirm unique"
  // search is expensive, so cap the node budget. A wall we can't clear within
  // the budget is conservatively kept (treated as load-bearing) — this bounds
  // per-check time and keeps us to boards whose uniqueness we can still verify.
  const NODE_BUDGET = 45000;
  // Two stop conditions keep generation bounded no matter how nasty a seed is:
  //   1. minKeep — stop once the board is open enough (the deep, near-minimal
  //      removals are by far the priciest to verify, so this floor is the main
  //      practical lever). Lower floor = more open = harder.
  //   2. maxMs — a hard wall-clock cap. A rare pathological seed can't reach its
  //      floor within budget; rather than grind for minutes we stop early and
  //      keep the extra walls. The board stays unique + solvable, just a little
  //      less open. Bounds every stage to pre-prune time + maxMs.
  const deadline = Date.now() + maxMs;
  for (const e of shuffle([...wallSet], rng)) {
    if (keep.size <= minKeep || Date.now() > deadline) break;
    keep.delete(e);
    const res = countSolutions(N, grid, keep, NODE_BUDGET);
    if (res.aborted || res.count !== 1) keep.add(e); // load-bearing → put back
  }
  return keep;
}

// ---------- generate one stage ----------
export function generateStage(N, numCount, targetWalls, rng, seedBase, pruneTo = 0) {
  let fallback = null;
  const maxAttempts = 600;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const path = randomHamPath(N, rng);
    if (!path) continue;
    const numbers = placeNumbers(path, numCount);
    const grid = numberGridFrom(N, numbers);
    const cands = shuffle(offPathWalls(N, path), rng);

    const wallSet = new Set();
    const take = Math.min(targetWalls, cands.length);
    for (let i = 0; i < take; i++) wallSet.add(cands[i]);
    let ci = take;

    // verify + try to reach uniqueness by adding off-path walls greedily
    const wallCap = Math.min(cands.length, targetWalls * 2 + 6);
    let res = countSolutions(N, grid, wallSet);
    while (!res.aborted && res.count > 1 && ci < wallCap) {
      wallSet.add(cands[ci++]);
      res = countSolutions(N, grid, wallSet);
    }

    if (!res.aborted && res.count === 1) {
      const finalWalls =
        pruneTo > 0 ? pruneWalls(N, grid, wallSet, rng, pruneTo) : wallSet;
      return {
        size: N,
        numbers,
        walls: wallsToArray(finalWalls),
        solution: path.map(([r, c]) => [r, c]),
        unique: true,
      };
    }
    // keep first solvable (built from a real path -> always solvable) as fallback
    if (!fallback)
      fallback = {
        size: N,
        numbers,
        walls: wallsToArray(wallSet),
        solution: path.map(([r, c]) => [r, c]),
        unique: false,
      };
  }
  return fallback;
}

// ---------- difficulty curve (PRD) ----------
const CONFIGS = [
  { N: 4, nums: 3, walls: 0 }, // 1  입문
  { N: 4, nums: 3, walls: 1 }, // 2
  { N: 4, nums: 2, walls: 2 }, // 3
  { N: 5, nums: 4, walls: 1 }, // 4  초급
  { N: 5, nums: 3, walls: 3 }, // 5
  { N: 5, nums: 3, walls: 4 }, // 6
  { N: 6, nums: 5, walls: 3 }, // 7  중급
  { N: 6, nums: 4, walls: 5 }, // 8
  { N: 6, nums: 4, walls: 6 }, // 9
  { N: 6, nums: 3, walls: 7 }, // 10
  { N: 7, nums: 6, walls: 6 }, // 11 고급
  { N: 7, nums: 6, walls: 8 }, // 12
  { N: 7, nums: 5, walls: 9 }, // 13
  { N: 7, nums: 5, walls: 10 }, // 14
  { N: 7, nums: 6, walls: 11 }, // 15
  { N: 7, nums: 5, walls: 12 }, // 16 마스터
  // 8×8 needs ~19–37 walls for a unique solution; seed near that threshold so the
  // greedy wall-filling converges fast instead of exploding (same effect as 9×9).
  { N: 8, nums: 6, walls: 16 }, // 17
  { N: 8, nums: 6, walls: 18 }, // 18
  { N: 8, nums: 5, walls: 18 }, // 19
  { N: 8, nums: 7, walls: 18 }, // 20
  { N: 8, nums: 5, walls: 20 }, // 21
  { N: 8, nums: 6, walls: 20 }, // 22
  // 9×9 needs ~45–50 walls to force a unique solution; starting low makes the
  // greedy wall-filling explode near the uniqueness boundary (measured: base 18
  // → ~200s, base 22–24 → ~10s), so seed these high.
  { N: 9, nums: 8, walls: 22 }, // 23 전설
  { N: 9, nums: 7, walls: 24 }, // 24
  { N: 9, nums: 6, walls: 24 }, // 25
  { N: 9, nums: 8, walls: 24 }, // 26
  { N: 9, nums: 7, walls: 26 }, // 27
  { N: 9, nums: 6, walls: 26 }, // 28
  { N: 9, nums: 8, walls: 26 }, // 29
  { N: 9, nums: 7, walls: 28 }, // 30
  // ---- 초월 (31–40): 9×9, tighter number clues + denser walls than 전설.
  // 9×9 reaches a unique solution around ~35–64 walls; these seeds keep the
  // greedy wall-filling near that band so each stage generates in a few seconds.
  { N: 9, nums: 7, walls: 28 }, // 31
  { N: 9, nums: 6, walls: 34 }, // 32
  { N: 9, nums: 8, walls: 30 }, // 33
  { N: 9, nums: 6, walls: 30 }, // 34
  { N: 9, nums: 7, walls: 30 }, // 35  ← milestone
  { N: 9, nums: 5, walls: 30 }, // 36
  { N: 9, nums: 7, walls: 32 }, // 37
  { N: 9, nums: 6, walls: 32 }, // 38
  { N: 9, nums: 5, walls: 32 }, // 39
  { N: 9, nums: 6, walls: 32 }, // 40  ← milestone
  // ---- 신화 (41–50): 10×10. A 10×10 needs ~55–80 walls to force a unique
  // solution; seeding the base far below that makes the greedy fill explode
  // (measured: base 36 → 60–80 s, base ~48–52 → <2 s), so seed these high.
  { N: 10, nums: 9, walls: 48 }, // 41
  { N: 10, nums: 8, walls: 48 }, // 42
  { N: 10, nums: 8, walls: 48 }, // 43
  { N: 10, nums: 7, walls: 50 }, // 44
  { N: 10, nums: 9, walls: 48 }, // 45  ← milestone
  { N: 10, nums: 7, walls: 50 }, // 46
  { N: 10, nums: 8, walls: 50 }, // 47
  { N: 10, nums: 7, walls: 50 }, // 48
  { N: 10, nums: 6, walls: 50 }, // 49
  { N: 10, nums: 8, walls: 52 }, // 50  ← milestone
  // ---- 환상 (51–60): 10×10, hardest. Fewest clues, densest walls. ----
  { N: 10, nums: 7, walls: 50 }, // 51
  { N: 10, nums: 6, walls: 50 }, // 52
  { N: 10, nums: 8, walls: 52 }, // 53
  { N: 10, nums: 6, walls: 52 }, // 54
  { N: 10, nums: 7, walls: 52 }, // 55  ← milestone
  { N: 10, nums: 5, walls: 52 }, // 56
  { N: 10, nums: 7, walls: 52 }, // 57
  { N: 10, nums: 6, walls: 52 }, // 58
  { N: 10, nums: 5, walls: 52 }, // 59
  { N: 10, nums: 6, walls: 52 }, // 60  ← milestone
  // ---- 심연 / 혼돈 / 무한 (61–90): 10×10, OPEN boards. ------------------------
  // Player feedback: stages with FEWER walls play harder — with less forced
  // direction you must plan the whole route yourself instead of coasting down
  // forced corridors. So here we seed near the uniqueness threshold (base 48,
  // fast to generate) and then PRUNE walls down to `prune` — the fewest walls
  // that still pin a unique solution we can verify. Lower `prune` = more open =
  // harder (and slower to generate). nums stays 9 so the low floors stay
  // reachable/fast. See generateStage(..., pruneTo) + pruneWalls().
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 61  심연
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 62
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 63
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 64
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 65  ← milestone
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 66
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 67
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 68
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 69
  { N: 10, nums: 9, walls: 48, prune: 50 }, // 70  ← milestone
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 71  혼돈
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 72
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 73
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 74
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 75  ← milestone
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 76
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 77
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 78
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 79
  { N: 10, nums: 9, walls: 48, prune: 46 }, // 80  ← milestone
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 81  무한
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 82
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 83
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 84
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 85  ← milestone
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 86
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 87
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 88
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 89
  { N: 10, nums: 9, walls: 48, prune: 44 }, // 90  ← milestone
];

function main() {
  const stages = [];
  CONFIGS.forEach((cfg, i) => {
    const rng = mulberry32(1000 + i * 7919);
    const t0 = Date.now();
    const s = generateStage(cfg.N, cfg.nums, cfg.walls, rng, i, cfg.prune ?? 0);
    const stage = {
      id: i + 1,
      size: s.size,
      numbers: s.numbers,
      walls: s.walls,
      solution: s.solution,
    };
    stages.push(stage);
    console.error(
      `stage ${String(i + 1).padStart(2)}: ${cfg.N}x${cfg.N}  nums=${
        Object.keys(s.numbers).length
      }  walls=${s.walls.length}  unique=${s.unique}  ${Date.now() - t0}ms`
    );
  });

  const out = `// AUTO-GENERATED by tools/generate.mjs — do not edit by hand.
// Each stage is verified solvable (built from a real Hamiltonian path);
// most are also verified to have a unique solution.
export const STAGES = ${JSON.stringify(stages, null, 2)};
`;

  const dest = join(__dirname, "..", "src", "game", "stages.js");
  writeFileSync(dest, out);
  console.error(`\nwrote ${stages.length} stages -> ${dest}`);
}

// Run the full generation only when invoked directly (so the module can also be
// imported for timing/verification without side effects).
if (process.argv[1] && process.argv[1].endsWith("generate.mjs")) {
  main();
}
