import { useCallback, useMemo, useRef, useState } from "react";

// ---- coordinate + edge helpers --------------------------------------------
export const cellKey = (r, c) => `${r},${c}`;

export const edgeKey = (r1, c1, r2, c2) => {
  const a = `${r1},${c1}`;
  const b = `${r2},${c2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
};

export function buildWallSet(walls) {
  const set = new Set();
  for (const w of walls) {
    const [r1, c1] = w.a.split(",").map(Number);
    const [r2, c2] = w.b.split(",").map(Number);
    set.add(edgeKey(r1, c1, r2, c2));
  }
  return set;
}

export function buildNumberMap(numbers) {
  // returns Map "r,c" -> value and reverse value -> [r,c]
  const map = new Map();
  let max = 0;
  let startCell = null;
  for (const [k, v] of Object.entries(numbers)) {
    map.set(k, v);
    if (v > max) max = v;
    if (v === 1) startCell = k.split(",").map(Number);
  }
  return { map, max, startCell };
}

const areAdjacent = (a, b) =>
  (a[0] === b[0] && Math.abs(a[1] - b[1]) === 1) ||
  (a[1] === b[1] && Math.abs(a[0] - b[0]) === 1);

// ---- the game hook ---------------------------------------------------------
export function useGame(stage) {
  const N = stage.size;
  const total = N * N;

  const { map: numberMap, max: maxNumber, startCell } = useMemo(
    () => buildNumberMap(stage.numbers),
    [stage]
  );
  const wallSet = useMemo(() => buildWallSet(stage.walls), [stage]);

  const [path, setPath] = useState([]); // array of [r,c]
  const drawingRef = useRef(false);

  // fast membership: "r,c" -> index in path
  const indexOf = useMemo(() => {
    const m = new Map();
    path.forEach((cell, i) => m.set(cellKey(cell[0], cell[1]), i));
    return m;
  }, [path]);

  const head = path.length ? path[path.length - 1] : null;

  const numbersDone = useMemo(() => {
    let n = 0;
    for (const [r, c] of path) if (numberMap.has(cellKey(r, c))) n++;
    return n;
  }, [path, numberMap]);

  const isSolved = path.length === total;

  const blocked = useCallback(
    (a, b) => wallSet.has(edgeKey(a[0], a[1], b[0], b[1])),
    [wallSet]
  );

  // Can we legally step onto `cell` from the current head?
  const canExtendTo = useCallback(
    (cell) => {
      if (!head) return false;
      if (!areAdjacent(head, cell)) return false;
      if (indexOf.has(cellKey(cell[0], cell[1]))) return false; // already visited
      if (blocked(head, cell)) return false; // wall between
      const v = numberMap.get(cellKey(cell[0], cell[1]));
      if (v !== undefined && v !== numbersDone + 1) return false; // wrong order
      return true;
    },
    [head, indexOf, blocked, numberMap, numbersDone]
  );

  // pointer press on a cell
  const pressCell = useCallback(
    (cell) => {
      drawingRef.current = true;
      const k = cellKey(cell[0], cell[1]);
      setPath((prev) => {
        if (prev.length === 0) {
          // must start on the "1" cell
          if (startCell && startCell[0] === cell[0] && startCell[1] === cell[1])
            return [cell];
          return prev;
        }
        const idx = prev.findIndex((p) => cellKey(p[0], p[1]) === k);
        if (idx !== -1) {
          // tap an already-drawn cell -> truncate back to it
          return prev.slice(0, idx + 1);
        }
        // tap an adjacent legal cell -> extend by one
        const h = prev[prev.length - 1];
        if (!areAdjacent(h, cell)) return prev;
        if (wallSet.has(edgeKey(h[0], h[1], cell[0], cell[1]))) return prev;
        const done = prev.filter((p) => numberMap.has(cellKey(p[0], p[1]))).length;
        const v = numberMap.get(k);
        if (v !== undefined && v !== done + 1) return prev;
        return [...prev, cell];
      });
    },
    [startCell, wallSet, numberMap]
  );

  // pointer drag over a cell
  const dragToCell = useCallback(
    (cell) => {
      if (!drawingRef.current) return;
      const k = cellKey(cell[0], cell[1]);
      setPath((prev) => {
        if (prev.length === 0) {
          if (startCell && startCell[0] === cell[0] && startCell[1] === cell[1])
            return [cell];
          return prev;
        }
        const h = prev[prev.length - 1];
        // backtrack: dragged onto the previous cell
        if (prev.length >= 2) {
          const p2 = prev[prev.length - 2];
          if (p2[0] === cell[0] && p2[1] === cell[1]) return prev.slice(0, -1);
        }
        if (h[0] === cell[0] && h[1] === cell[1]) return prev; // still on head
        // must be adjacent, unvisited, not walled, number order ok
        if (!areAdjacent(h, cell)) return prev;
        if (prev.some((p) => p[0] === cell[0] && p[1] === cell[1])) return prev;
        if (wallSet.has(edgeKey(h[0], h[1], cell[0], cell[1]))) return prev;
        const done = prev.filter((p) => numberMap.has(cellKey(p[0], p[1]))).length;
        const v = numberMap.get(k);
        if (v !== undefined && v !== done + 1) return prev;
        return [...prev, cell];
      });
    },
    [startCell, wallSet, numberMap]
  );

  // keyboard step: move the head one cell in a direction (dr, dc).
  // Empty path -> place the head on the "1" cell. Stepping back onto the
  // previous cell retraces (erases) it; otherwise it extends if the move is
  // legal (in bounds, unvisited, no wall, numbers still in order).
  const step = useCallback(
    (dr, dc) => {
      setPath((prev) => {
        if (prev.length === 0) {
          return startCell ? [[startCell[0], startCell[1]]] : prev;
        }
        const h = prev[prev.length - 1];
        const target = [h[0] + dr, h[1] + dc];
        if (target[0] < 0 || target[0] >= N || target[1] < 0 || target[1] >= N)
          return prev;
        // retrace: stepping onto the previous cell erases the last segment
        if (prev.length >= 2) {
          const p2 = prev[prev.length - 2];
          if (p2[0] === target[0] && p2[1] === target[1]) return prev.slice(0, -1);
        }
        if (prev.some((p) => p[0] === target[0] && p[1] === target[1])) return prev;
        if (wallSet.has(edgeKey(h[0], h[1], target[0], target[1]))) return prev;
        const done = prev.filter((p) => numberMap.has(cellKey(p[0], p[1]))).length;
        const v = numberMap.get(cellKey(target[0], target[1]));
        if (v !== undefined && v !== done + 1) return prev;
        return [...prev, target];
      });
    },
    [startCell, N, wallSet, numberMap]
  );

  const endDraw = useCallback(() => {
    drawingRef.current = false;
  }, []);

  const undo = useCallback(() => {
    setPath((prev) => (prev.length ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => {
    drawingRef.current = false;
    setPath([]);
  }, []);

  return {
    N,
    total,
    path,
    head,
    numberMap,
    maxNumber,
    startCell,
    wallSet,
    numbersDone,
    isSolved,
    canExtendTo,
    pressCell,
    dragToCell,
    step,
    endDraw,
    undo,
    reset,
  };
}
