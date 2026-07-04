import { useCallback, useEffect, useMemo, useState } from "react";
import { STAGES } from "./game/stages.js";
import { recordClear, loadProgress, saveProgress } from "./lib/supabase.js";
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

  // On load, pull this user's saved progress from Supabase and merge it in, so a
  // returning player resumes after their last cleared stage on any session.
  // No-op (keeps the local cache) when Supabase is offline / not configured.
  useEffect(() => {
    let alive = true;
    loadProgress().then((remote) => {
      if (!alive || !remote || remote.length === 0) return;
      setCleared((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of remote) {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleSolved = useCallback((id) => {
    // bump the global clear counter for milestone levels (3/6/…/30/35/…/90) and
    // persist this user's own progress. Both fire-and-forget: no-op unless
    // Supabase is configured.
    recordClear(id);
    saveProgress(id);
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

  // The stage to resume on: the first one not yet cleared (or the last stage if
  // everything is done). Drives the "이어서 하기" button on the start screen.
  const resumeIndex = useMemo(() => {
    const i = STAGES.findIndex((s) => !cleared.has(s.id));
    return i === -1 ? STAGES.length - 1 : i;
  }, [cleared]);

  return (
    <div className="app">
      {screen === "start" && (
        <StartScreen
          onStart={() => setScreen("select")}
          onContinue={() => {
            setIndex(resumeIndex);
            setScreen("game");
          }}
          clearedCount={cleared.size}
          total={STAGES.length}
          resumeStageId={STAGES[resumeIndex].id}
          allCleared={cleared.size >= STAGES.length}
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
