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
function mulberry32(seed) {
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

// ---------- generate one stage ----------
function generateStage(N, numCount, targetWalls, rng, seedBase) {
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

    const stage = {
      size: N,
      numbers,
      walls: wallsToArray(wallSet),
      solution: path.map(([r, c]) => [r, c]),
    };

    if (!res.aborted && res.count === 1) {
      return { ...stage, unique: true };
    }
    // keep first solvable (built from a real path -> always solvable) as fallback
    if (!fallback) fallback = { ...stage, unique: false };
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
];

const stages = [];
CONFIGS.forEach((cfg, i) => {
  const rng = mulberry32(1000 + i * 7919);
  const s = generateStage(cfg.N, cfg.nums, cfg.walls, rng, i);
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
    }  walls=${s.walls.length}  unique=${s.unique}`
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
