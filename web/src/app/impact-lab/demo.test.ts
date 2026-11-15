import { describe, expect, it } from "vitest";
import { copyableBullet, evidence, initialReviews, reviewEvidence, sources, suggestions, suggestionStatus, type Suggestion } from "./demo";

describe("FICTIONAL DEMO evidence guard", () => {
  it("starts with two drafts, neither exportable", () => {
    expect(suggestions).toHaveLength(2);
    for (const item of suggestions) {
      expect(suggestionStatus(item, initialReviews())).toBe("review");
      expect(copyableBullet(item, initialReviews())).toBeNull();
    }
  });

  it("links every statement to an exact candidate source, never job text", () => {
    for (const item of evidence) {
      expect(sources[item.source].text).toContain(item.quote);
      expect(item.source).toMatch(/^(resume|answer)-/);
    }
    for (const item of suggestions) {
      expect(item.evidenceIds.every((id) => evidence.some((entry) => entry.id === id))).toBe(true);
      expect(item.improved).not.toMatch(/\d|%/);
      expect(item.missing).toContain("No metrics are added");
      expect(item.questions.map((entry) => entry.topic)).toEqual([
        "Personal contribution", "Engineering decisions", "Technical challenges", "Measurable outcomes", "Business impact",
      ]);
    }
  });

  for (const item of suggestions) {
    it(`${item.id}: requires all claims, blocks rejection, and supports undo/reset`, () => {
      const initial = initialReviews();
      let state = reviewEvidence(initial, item.evidenceIds[0], "confirmed");
      expect(copyableBullet(item, state)).toBeNull();
      state = reviewEvidence(state, item.evidenceIds[1], "confirmed");
      expect(copyableBullet(item, state)).toBe(item.improved);
      state = reviewEvidence(state, item.evidenceIds[0], "rejected");
      expect(suggestionStatus(item, state)).toBe("blocked");
      expect(copyableBullet(item, state)).toBeNull();
      state = reviewEvidence(state, item.evidenceIds[0], "reported");
      expect(suggestionStatus(item, state)).toBe("review");
      expect(initial).toEqual(initialReviews());
      expect(copyableBullet(item, initialReviews())).toBeNull();
    });
  }

  it("keeps independent suggestions and sessions isolated", () => {
    const confirmed = suggestions[0].evidenceIds.reduce((state, id) => reviewEvidence(state, id, "confirmed"), initialReviews());
    expect(copyableBullet(suggestions[0], confirmed)).not.toBeNull();
    expect(copyableBullet(suggestions[1], confirmed)).toBeNull();
    expect(copyableBullet(suggestions[0], initialReviews())).toBeNull();
  });

  it("fails closed on absent reviews, empty/spoofed links, and unknown review IDs", () => {
    expect(copyableBullet(suggestions[0], {})).toBeNull();
    for (const evidenceIds of [[], ["job-text"], ["invented-answer"]]) {
      const invalid = { ...suggestions[0], evidenceIds } as unknown as Suggestion;
      expect(suggestionStatus(invalid, { "job-text": "confirmed", "invented-answer": "confirmed" })).toBe("blocked");
    }
    const state = initialReviews();
    expect(reviewEvidence(state, "missing-metric", "confirmed")).toBe(state);
  });
});
