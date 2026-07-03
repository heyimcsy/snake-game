import { createClient } from "@supabase/supabase-js";

// Supabase is configured via Vite env vars (see .env.example).
// When they're missing the client stays null and every call below becomes a
// harmless no-op, so the game still runs fully offline.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

// Only these milestone stages have a counter column in the `snake-game` table.
// stage id -> column: 3 -> count_3, 6 -> count_6, 10 -> count_10, 15 -> count_15
export const MILESTONE_LEVELS = [3, 6, 10, 15];

// Which milestone a stage rolls up to (the end of its difficulty band):
// 1..3 -> 3, 4..6 -> 6, 7..10 -> 10, 11..15 -> 15
export function milestoneFor(stageId) {
  return MILESTONE_LEVELS.find((m) => stageId <= m) ?? MILESTONE_LEVELS.at(-1);
}

// Bump the global clear counter for a milestone level.
// Fire-and-forget: never throws, never blocks the UI, logs on failure.
export async function recordClear(stageId) {
  if (!supabase || !MILESTONE_LEVELS.includes(stageId)) return;
  try {
    const { error } = await supabase.rpc("increment_snake_clear", {
      level: stageId,
    });
    if (error) console.warn("[supabase] clear count failed:", error.message);
  } catch (e) {
    console.warn("[supabase] clear count error:", e?.message ?? e);
  }
}

// How many people have cleared this stage's milestone so far.
// Returns a number, or null when unavailable (offline / not configured / error).
export async function fetchClearCount(stageId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("get_snake_clear_count", {
      level: milestoneFor(stageId),
    });
    if (error) {
      console.warn("[supabase] read count failed:", error.message);
      return null;
    }
    return typeof data === "number" ? data : null;
  } catch (e) {
    console.warn("[supabase] read count error:", e?.message ?? e);
    return null;
  }
}
