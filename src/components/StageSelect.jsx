const BANDS = [
  { label: "입문", max: 3 },
  { label: "초급", max: 6 },
  { label: "중급", max: 10 },
  { label: "고급", max: 15 },
  { label: "마스터", max: 22 },
  { label: "전설", max: 30 },
  { label: "초월", max: 40 },
  { label: "신화", max: 50 },
  { label: "환상", max: 60 },
  { label: "심연", max: 70 },
  { label: "혼돈", max: 80 },
  { label: "무한", max: 90 },
];

function bandFor(id) {
  return BANDS.find((b) => id <= b.max)?.label ?? "";
}

export default function StageSelect({ stages, cleared, onPick, onBack }) {
  return (
    <div className="screen select">
      <header className="select-head">
        <button className="ghost-btn" onClick={onBack}>
          ←
        </button>
        <h2>단계 선택</h2>
        <span className="count">
          {cleared.size}/{stages.length}
        </span>
      </header>

      <div className="stage-grid">
        {stages.map((s, i) => {
          const isCleared = cleared.has(s.id);
          // unlocked if it's the first, already cleared, or the previous is cleared
          const unlocked =
            i === 0 || isCleared || cleared.has(stages[i - 1].id);
          return (
            <button
              key={s.id}
              className={
                "stage-cell" +
                (isCleared ? " cleared" : "") +
                (!unlocked ? " locked" : "")
              }
              disabled={!unlocked}
              onClick={() => unlocked && onPick(i)}
            >
              <span className="band">{bandFor(s.id)}</span>
              <span className="no">{s.id}</span>
              <span className="size">
                {s.size}×{s.size}
              </span>
              <span className="mark">
                {isCleared ? "🌟" : unlocked ? "🌱" : "🔒"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
