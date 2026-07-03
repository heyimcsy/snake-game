import { useRef } from "react";
import { cellKey } from "../game/logic.js";

// center of a cell in svg units (1 unit == 1 cell)
const cx = (c) => c + 0.5;
const cy = (r) => r + 0.5;

// heart-topped apple outline, sized by s (half-width)
const appleBody = (s) =>
  `M 0 ${-s * 0.72}
   C ${-s * 0.55} ${-s * 1.05} ${-s * 1.02} ${-s * 0.55} ${-s * 0.96} ${-s * 0.02}
   C ${-s * 0.9} ${s * 0.62} ${-s * 0.42} ${s * 0.98} 0 ${s * 0.86}
   C ${s * 0.42} ${s * 0.98} ${s * 0.9} ${s * 0.62} ${s * 0.96} ${-s * 0.02}
   C ${s * 1.02} ${-s * 0.55} ${s * 0.55} ${-s * 1.05} 0 ${-s * 0.72} Z`;

// ambient forest-floor decor, positioned as fractions of the board so it
// scales with any grid size and always sits inside the frame
const DAPPLES = [
  [0.3, 0.26, 0.62], [0.76, 0.5, 0.7], [0.2, 0.64, 0.5], [0.62, 0.82, 0.58],
];
const FLOWERS = [
  [0.16, 0.2, "#f6d873"], [0.82, 0.72, "#e88ab0"], [0.72, 0.16, "#f2efe6"],
];
const MUSHROOMS = [[0.2, 0.82], [0.85, 0.3]];

function Apple({ r, c, v, isStart, isEnd }) {
  const s = 0.34;
  return (
    <g className="apple" transform={`translate(${cx(c)} ${cy(r)})`}>
      <ellipse className="apple-shadow" cx="0" cy={s * 0.95} rx={s * 0.85} ry={s * 0.28} />
      {isStart && <circle className="apple-ring start" r={s * 1.25} />}
      {isEnd && <circle className="apple-ring end" r={s * 1.25} />}
      <path d={appleBody(s)} fill="url(#appleGrad)" />
      <ellipse
        cx={-s * 0.32}
        cy={-s * 0.34}
        rx={s * 0.24}
        ry={s * 0.15}
        fill="rgba(255,255,255,.75)"
        transform="rotate(-20)"
      />
      <path
        d={`M 0 ${-s * 0.82} q 0.02 -0.14 0.12 -0.2`}
        stroke="#6d4c1b"
        strokeWidth="0.06"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M 0.05 ${-s * 0.86} q 0.26 -0.16 0.34 0.06 q -0.24 0.12 -0.34 -0.06 Z`}
        fill="#4f9e46"
      />
      <text
        className="apple-num"
        x="0"
        y="0.02"
        fontSize="0.4"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {v}
      </text>
    </g>
  );
}

export default function Board({ game }) {
  const {
    N,
    path,
    numberMap,
    maxNumber,
    startCell,
    isSolved,
    pressCell,
    dragToCell,
    endDraw,
  } = game;

  const boardRef = useRef(null);
  const lastCellRef = useRef(null);

  // translate a pointer event into a [r,c] cell (clamped to the grid)
  const cellFromEvent = (e) => {
    const rect = boardRef.current.getBoundingClientRect();
    let c = Math.floor(((e.clientX - rect.left) / rect.width) * N);
    let r = Math.floor(((e.clientY - rect.top) / rect.height) * N);
    r = Math.max(0, Math.min(N - 1, r));
    c = Math.max(0, Math.min(N - 1, c));
    return [r, c];
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    boardRef.current.setPointerCapture?.(e.pointerId);
    const cell = cellFromEvent(e);
    lastCellRef.current = cellKey(cell[0], cell[1]);
    pressCell(cell);
  };

  const onPointerMove = (e) => {
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    const cell = cellFromEvent(e);
    const k = cellKey(cell[0], cell[1]);
    if (k === lastCellRef.current) return; // still in the same cell
    lastCellRef.current = k;
    dragToCell(cell);
  };

  const onPointerUp = (e) => {
    boardRef.current.releasePointerCapture?.(e.pointerId);
    lastCellRef.current = null;
    endDraw();
  };

  // snake head: position + facing angle from the last drawn segment
  let head = null;
  if (path.length >= 2) {
    const [hr, hc] = path[path.length - 1];
    const [pr, pc] = path[path.length - 2];
    head = { r: hr, c: hc, ang: (Math.atan2(hr - pr, hc - pc) * 180) / Math.PI };
  }

  // walls -> svg segments on shared cell borders (rendered as bushes)
  const wallLines = game.wallSet
    ? [...game.wallSet].map((e) => {
        const [a, b] = e.split("|");
        const [r1, c1] = a.split(",").map(Number);
        const [r2, c2] = b.split(",").map(Number);
        if (r1 === r2) {
          const x = Math.max(c1, c2);
          return { key: e, x1: x, y1: r1, x2: x, y2: r1 + 1, vert: true };
        }
        const y = Math.max(r1, r2);
        return { key: e, x1: c1, y1: y, x2: c1 + 1, y2: y, vert: false };
      })
    : [];

  const segments = path.slice(1).map((cell, i) => ({
    key: cellKey(cell[0], cell[1]),
    x1: cx(path[i][1]),
    y1: cy(path[i][0]),
    x2: cx(cell[1]),
    y2: cy(cell[0]),
  }));

  return (
    <div
      className={"board" + (isSolved ? " solved" : "")}
      ref={boardRef}
      style={{ "--n": N }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* mossy cell tiles */}
      <div className="cells" style={{ "--n": N }}>
        {Array.from({ length: N * N }).map((_, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const k = cellKey(r, c);
          const inPath = path.some((p) => p[0] === r && p[1] === c);
          return <div key={k} className={"cell" + (inPath ? " visited" : "")} />;
        })}
      </div>

      {/* overlay: decor + bushes + snake + apples */}
      <svg
        className="overlay"
        viewBox={`0 0 ${N} ${N}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="snakeBody" x1="0" y1="0" x2="0" y2={N} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7ec36a" />
            <stop offset="1" stopColor="#3f8a3c" />
          </linearGradient>
          <radialGradient id="appleGrad" cx="35%" cy="30%" r="78%">
            <stop offset="0" stopColor="#ff6f5e" />
            <stop offset="1" stopColor="#c62828" />
          </radialGradient>
          <radialGradient id="headGrad" cx="40%" cy="28%" r="80%">
            <stop offset="0" stopColor="#8ed07a" />
            <stop offset="1" stopColor="#4a9741" />
          </radialGradient>
        </defs>

        {/* sun dapples + flowers + mushrooms */}
        <g className="decor">
          {DAPPLES.map(([x, y, rr], i) => (
            <circle key={"d" + i} cx={x * N} cy={y * N} r={rr} fill="rgba(255,244,190,.15)" />
          ))}
          {FLOWERS.map(([x, y, col], i) => (
            <g key={"f" + i} transform={`translate(${x * N} ${y * N})`}>
              {Array.from({ length: 5 }).map((_, k) => {
                const a = (k / 5) * Math.PI * 2;
                return (
                  <circle
                    key={k}
                    cx={Math.cos(a) * 0.08}
                    cy={Math.sin(a) * 0.08}
                    r="0.055"
                    fill={col}
                  />
                );
              })}
              <circle r="0.045" fill="#8a5a20" />
            </g>
          ))}
          {MUSHROOMS.map(([x, y], i) => (
            <g key={"m" + i} transform={`translate(${x * N} ${y * N})`}>
              <rect x="-0.04" y="0" width="0.08" height="0.13" rx="0.03" fill="#f0e6cf" />
              <ellipse cx="0" cy="0" rx="0.15" ry="0.09" fill="#c0503a" />
              <circle cx="-0.05" cy="-0.03" r="0.028" fill="#f5e9d0" />
              <circle cx="0.05" cy="0.01" r="0.022" fill="#f5e9d0" />
            </g>
          ))}
        </g>

        {/* bushes on walls */}
        <g className="bushes">
          {wallLines.map((w) => {
            const mx = (w.x1 + w.x2) / 2;
            const my = (w.y1 + w.y2) / 2;
            const along = w.vert ? [0, 1] : [1, 0];
            return (
              <g key={w.key}>
                {[-1, 0, 1].map((k) => (
                  <circle
                    key={k}
                    cx={mx + along[0] * k * 0.26}
                    cy={my + along[1] * k * 0.26}
                    r="0.2"
                    fill="#3c6f34"
                  />
                ))}
                <circle cx={mx} cy={my} r="0.12" fill="#4f9e46" />
              </g>
            );
          })}
        </g>

        {/* snake body: outline + body + spine (each segment draws in) */}
        <g className="snake">
          <g className="outline">
            {segments.map((s) => (
              <line className="seg" key={s.key} pathLength="1" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#2f6330" strokeWidth="0.62" />
            ))}
          </g>
          <g className="body">
            {segments.map((s) => (
              <line className="seg" key={s.key} pathLength="1" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="url(#snakeBody)" strokeWidth="0.5" />
            ))}
          </g>
          <g className="spine">
            {segments.map((s) => (
              <line className="seg" key={s.key} pathLength="1" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="rgba(226,255,205,.5)" strokeWidth="0.1" />
            ))}
          </g>
        </g>

        {/* snake head */}
        {head && (
          <g className="head" transform={`translate(${cx(head.c)} ${cy(head.r)}) rotate(${head.ang})`}>
            <ellipse cx="0.04" cy="0" rx="0.46" ry="0.36" fill="url(#headGrad)" stroke="#2f6330" strokeWidth="0.05" />
            <path d="M 0.44 0 q 0.18 0 0.22 0" stroke="#c8362b" strokeWidth="0.045" fill="none" />
            <path d="M 0.5 0 l 0.16 -0.03 M 0.5 0 l 0.16 0.03" stroke="#c8362b" strokeWidth="0.04" fill="none" strokeLinecap="round" />
            <circle cx="0.08" cy="-0.14" r="0.1" fill="#fff" />
            <circle cx="0.11" cy="-0.14" r="0.05" fill="#25341c" />
            <circle cx="0.08" cy="0.14" r="0.1" fill="#fff" />
            <circle cx="0.11" cy="0.14" r="0.05" fill="#25341c" />
            <ellipse cx="-0.05" cy="-0.16" rx="0.16" ry="0.08" fill="rgba(255,255,255,.28)" />
          </g>
        )}

        {/* numbered apples on top so numbers stay readable */}
        <g className="apples">
          {[...numberMap.entries()].map(([k, v]) => {
            const [r, c] = k.split(",").map(Number);
            return (
              <Apple
                key={k}
                r={r}
                c={c}
                v={v}
                isStart={v === 1}
                isEnd={v === maxNumber && maxNumber > 1}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
