import { describe, expect, it } from "vitest";
import { createSwipeState, swipeReducer } from "./swipe-state";

describe("swipe state machine", () => {
  it("starts with unique cards only", () => {
    expect(createSwipeState(["a", "a", "b"]).remaining).toEqual(["a", "b"]);
  });

  it("saves and passes the visible cards without repeated IDs", () => {
    let state = createSwipeState(["a", "b", "c"]);
    state = swipeReducer(state, { type: "choose", id: "a", decision: "saved" });
    state = swipeReducer(state, { type: "choose", id: "b", decision: "passed" });
    expect(state.remaining).toEqual(["c"]);
    expect(state.saved).toEqual(["a"]);
    expect(state.passed).toEqual(["b"]);
  });

  it("ignores duplicate or stale decisions", () => {
    const initial = createSwipeState(["a", "b"]);
    const next = swipeReducer(initial, { type: "choose", id: "a", decision: "saved" });
    expect(swipeReducer(next, { type: "choose", id: "a", decision: "saved" })).toBe(next);
    expect(swipeReducer(next, { type: "choose", id: "b", decision: "passed" }).remaining).toEqual([]);
  });

  it("undoes each decision in reverse order", () => {
    let state = createSwipeState(["a", "b"]);
    state = swipeReducer(state, { type: "choose", id: "a", decision: "saved" });
    state = swipeReducer(state, { type: "choose", id: "b", decision: "passed" });
    state = swipeReducer(state, { type: "undo" });
    expect(state.remaining).toEqual(["b"]);
    expect(state.passed).toEqual([]);
    state = swipeReducer(state, { type: "undo" });
    expect(state.remaining).toEqual(["a", "b"]);
    expect(state.saved).toEqual([]);
    expect(state.history).toHaveLength(0);
  });

  it("resets without retaining saved or passed choices", () => {
    let state = createSwipeState(["a", "b"]);
    state = swipeReducer(state, { type: "choose", id: "a", decision: "saved" });
    state = swipeReducer(state, { type: "reset", ids: ["a", "a", "b"] });
    expect(state).toEqual(createSwipeState(["a", "b"]));
  });
  it("removes a saved role without reintroducing it to the deck", () => {
    let state = createSwipeState(["a", "b"]);
    state = swipeReducer(state, { type: "choose", id: "a", decision: "saved" });
    state = swipeReducer(state, { type: "removeSaved", id: "a" });
    expect(state.remaining).toEqual(["b"]);
    expect(state.saved).toEqual([]);
    expect(state.passed).toEqual(["a"]);
    expect(state.history).toHaveLength(0);
    expect(swipeReducer(state, { type: "undo" })).toBe(state);
  });

});
