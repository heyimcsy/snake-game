import { useCallback, useEffect, useState } from "react";
import { STAGES } from "./game/stages.js";
import { recordClear } from "./lib/supabase.js";
import StartScreen from "./components/StartScreen.jsx";
import StageSelect from "./components/StageSelect.jsx";
import GameScreen from "./components/GameScreen.jsx";

const SAVE_KEY = "forest-path.cleared.v1";

function loadCleared() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export default function App() {
  const [screen, setScreen] = useState("start"); // start | select | game
  const [index, setIndex] = useState(0);
  const [cleared, setCleared] = useState(loadCleared);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify([...cleared]));
    } catch {
      /* ignore storage failures (private mode etc.) */
    }
  }, [cleared]);

  const handleSolved = useCallback((id) => {
    // bump the global clear counter for milestone levels (3/6/10/15/20/25/30).
    // fire-and-forget: no-op unless Supabase is configured.
    recordClear(id);
    setCleared((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(STAGES.length - 1, i + 1));
  }, []);

  return (
    <div className="app">
      {screen === "start" && (
        <StartScreen
          onStart={() => setScreen("select")}
          clearedCount={cleared.size}
          total={STAGES.length}
        />
      )}

      {screen === "select" && (
        <StageSelect
          stages={STAGES}
          cleared={cleared}
          onPick={(i) => {
            setIndex(i);
            setScreen("game");
          }}
          onBack={() => setScreen("start")}
        />
      )}

      {screen === "game" && (
        <GameScreen
          key={STAGES[index].id}
          stage={STAGES[index]}
          index={index}
          totalStages={STAGES.length}
          onExit={() => setScreen("select")}
          onSolved={handleSolved}
          onNext={goNext}
        />
      )}
    </div>
  );
}
