// Pure UI state machine. Intentionally session-only and independent of API/AWS.

export type Decision = "saved" | "passed";

export type SwipeHistoryEntry = { id: string; decision: Decision };

export type SwipeState = {
  remaining: string[];
  saved: string[];
  passed: string[];
  history: SwipeHistoryEntry[];
};

export type SwipeAction =
  | { type: "choose"; id: string; decision: Decision }
  | { type: "undo" }
  | { type: "removeSaved"; id: string }
  | { type: "reset"; ids: string[] };

export function createSwipeState(ids: readonly string[]): SwipeState {
  return { remaining: [...new Set(ids)], saved: [], passed: [], history: [] };
}

export function swipeReducer(state: SwipeState, action: SwipeAction): SwipeState {
  if (action.type === "reset") return createSwipeState(action.ids);

  if (action.type === "choose") {
    // Only the visible top card may be acted on. Prevent stale or duplicate events.
    if (state.remaining[0] !== action.id) return state;
    return {
      remaining: state.remaining.slice(1),
      saved: action.decision === "saved" ? [...state.saved, action.id] : state.saved,
      passed: action.decision === "passed" ? [...state.passed, action.id] : state.passed,
      history: [...state.history, { id: action.id, decision: action.decision }],
    };
  }

  if (action.type === "removeSaved") {
    if (!state.saved.includes(action.id)) return state;
    return {
      ...state,
      saved: state.saved.filter((id) => id !== action.id),
      passed: [...state.passed, action.id],
      history: state.history.filter((entry) => entry.id !== action.id),
    };
  }

  const latest = state.history[state.history.length - 1];
  if (!latest) return state;
  return {
    remaining: [latest.id, ...state.remaining],
    saved: latest.decision === "saved" ? state.saved.filter((id) => id !== latest.id) : state.saved,
    passed: latest.decision === "passed" ? state.passed.filter((id) => id !== latest.id) : state.passed,
    history: state.history.slice(0, -1),
  };
}
