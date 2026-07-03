import { useEffect, useRef, useState } from "react";
import Board from "./Board.jsx";
import { useGame } from "../game/logic.js";
import { fetchClearCount, milestoneFor } from "../lib/supabase.js";

export default function GameScreen({
  stage,
  index,
  totalStages,
  onExit,
  onSolved,
  onNext,
}) {
  const game = useGame(stage);
  const [justWon, setJustWon] = useState(false);
  const [clearCount, setClearCount] = useState(null);
  const reportedRef = useRef(false);

  // remount game state whenever the stage changes
  useEffect(() => {
    game.reset();
    setJustWon(false);
    reportedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

  // how many people have cleared this stage's milestone so far
  useEffect(() => {
    let alive = true;
    setClearCount(null);
    fetchClearCount(stage.id).then((n) => alive && setClearCount(n));
    return () => {
      alive = false;
    };
  }, [stage.id]);

  useEffect(() => {
    if (game.isSolved && !reportedRef.current) {
      reportedRef.current = true;
      onSolved(stage.id);
      // brief delay so the final segment finishes drawing before the banner
      const t = setTimeout(() => setJustWon(true), 420);
      // re-read the count so it reflects this clear
      const t2 = setTimeout(() => {
        fetchClearCount(stage.id).then((n) => n != null && setClearCount(n));
      }, 900);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }
  }, [game.isSolved, onSolved, stage.id]);

  // keyboard controls: arrow keys / WASD move the head, Backspace/Z steps back
  const { step, undo } = game;
  useEffect(() => {
    const onKey = (e) => {
      if (justWon || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowUp": case "w": case "W": step(-1, 0); break;
        case "ArrowDown": case "s": case "S": step(1, 0); break;
        case "ArrowLeft": case "a": case "A": step(0, -1); break;
        case "ArrowRight": case "d": case "D": step(0, 1); break;
        case "Backspace": case "z": case "Z": undo(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, undo, justWon]);

  const isLast = index === totalStages - 1;

  return (
    <div className="screen game">
      <header className="game-head">
        <button className="ghost-btn" onClick={onExit} aria-label="단계 선택으로">
          ← 단계
        </button>
        <div className="stage-title">
          <span className="stage-num">STAGE {stage.id}</span>
          <span className="stage-sub">
            {stage.size}×{stage.size} 숲
          </span>
        </div>
        <div className="progress" aria-label="진행도">
          <span className="pill">
            🌿 {game.path.length}/{game.total}
          </span>
          <span className="pill">
            🪧 {game.numbersDone}/{game.maxNumber}
          </span>
        </div>
      </header>

      <p className="hint-line">
        <b>1</b> 표지판에서 출발해 <b>모든 칸</b>을 한 번씩 지나 숫자를 순서대로
        이어보세요.
      </p>
      <p className="kbd-hint">
        드래그 또는 <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd>
        <span className="kbd-alt">(WASD)</span> 방향키로 이동 ·{" "}
        <kbd>⌫</kbd> 한 칸 되돌리기
      </p>

      {clearCount != null && (
        <p className="clear-count">
          🌲 지금까지 <b>STAGE {milestoneFor(stage.id)}</b>까지 통과한 모험가{" "}
          <b>{clearCount.toLocaleString()}</b>명
        </p>
      )}

      <div className="board-wrap">
        <Board game={game} />
      </div>

      <div className="controls">
        <button className="ctrl-btn" onClick={game.undo} disabled={!game.path.length}>
          ↩︎ 한 칸
        </button>
        <button className="ctrl-btn danger" onClick={game.reset} disabled={!game.path.length}>
          ⟲ 다시
        </button>
      </div>

      {justWon && (
        <div className="win-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="win-card">
            <div className="win-emoji">🌳✨</div>
            <h2>숲길 완성!</h2>
            <p>STAGE {stage.id}을(를) 클리어했어요.</p>
            <div className="win-actions">
              <button className="ghost-btn" onClick={onExit}>
                단계 선택
              </button>
              {!isLast ? (
                <button className="primary-btn" onClick={onNext}>
                  다음 단계 →
                </button>
              ) : (
                <button className="primary-btn" onClick={onExit}>
                  🎉 전체 완주!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
