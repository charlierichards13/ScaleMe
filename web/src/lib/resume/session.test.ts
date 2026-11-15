import { describe, expect, it } from "vitest";
import { createResumeSession } from "./session";
describe("ephemeral Resume handoff", () => {
  it("preserves contract data across subscribers and clears it explicitly", () => {
    const session = createResumeSession(); let changes = 0;
    const unsubscribe = session.subscribe(() => changes++);
    session.set({ id: "synthetic", text: "Skills\nPython" });
    expect(session.getSnapshot()?.text).toBe("Skills\nPython"); expect(changes).toBe(1);
    session.set(null); expect(session.getSnapshot()).toBeNull(); unsubscribe();
  });
  it("rejects invalid resume data and keeps separate sessions isolated", () => {
    const a = createResumeSession(); const b = createResumeSession();
    a.set({ id: "synthetic", text: "Synthetic only" }); expect(b.getSnapshot()).toBeNull();
    expect(() => b.set({ id: "", text: "" })).toThrow(); expect(b.getSnapshot()).toBeNull();
  });
});
