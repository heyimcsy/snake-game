export default function StartScreen({
  onStart,
  onContinue,
  clearedCount,
  total,
  resumeStageId,
  allCleared,
}) {
  const hasProgress = clearedCount > 0 && !allCleared;
  return (
    <div className="screen start">
      <div className="canopy" aria-hidden="true">
        <span>🌲</span>
        <span>🌳</span>
        <span>🍃</span>
        <span>🌿</span>
        <span>🌲</span>
      </div>
      <h1 className="title">
        숲속 <span>길잇기</span>
      </h1>
      <p className="subtitle">
        모든 칸을 한 번씩 지나며 숫자를 순서대로 잇는 두뇌 퍼즐
      </p>

      <ul className="rules-mini">
        <li>🪧 숫자를 1→2→3 순서대로 지나기</li>
        <li>🌿 모든 칸을 정확히 한 번씩 밟기</li>
        <li>↔️ 상하좌우로만, 하나의 길로</li>
      </ul>

      {hasProgress && (
        <button className="primary-btn big" onClick={onContinue}>
          이어서 하기 · STAGE {resumeStageId}
        </button>
      )}

      <button
        className={hasProgress ? "ghost-btn wide" : "primary-btn big"}
        onClick={onStart}
      >
        {hasProgress ? "단계 선택" : "시작하기"}
      </button>

      {clearedCount > 0 && (
        <p className="cleared-note">
          {allCleared
            ? `🎉 전체 ${total}단계 완주! 🌟`
            : `지금까지 ${clearedCount} / ${total} 단계 클리어 🌟`}
        </p>
      )}
    </div>
  );
}
