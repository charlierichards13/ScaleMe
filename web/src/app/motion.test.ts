import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Reduced-motion guard (Issue #43): every animation and smooth scrolling in
 * globals.css must live inside `@media (prefers-reduced-motion: no-preference)`,
 * so users who ask for reduced motion (and browsers that never run the
 * animations) get the final, fully visible page.
 */
const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Returns the source of every `@media` block whose query matches, by brace matching. */
function mediaBlocks(source: string, query: RegExp): string[] {
  const blocks: string[] = [];
  const pattern = /@media\s*([^{]+)\{/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (!query.test(match[1])) continue;
    let depth = 1;
    let index = pattern.lastIndex;
    while (depth > 0 && index < source.length) {
      if (source[index] === "{") depth++;
      if (source[index] === "}") depth--;
      index++;
    }
    blocks.push(source.slice(match.index, index));
  }
  return blocks;
}

const motionDeclaration = /\banimation(-name)?\s*:|\bscroll-behavior\s*:\s*smooth/;

describe("reduced motion", () => {
  const allowed = mediaBlocks(css, /prefers-reduced-motion:\s*no-preference/);

  it("has a no-preference block that holds the welcome/onboarding motion", () => {
    expect(allowed).toHaveLength(1);
    for (const name of ["sm-rise", "sm-float", "sm-drift", "sm-trace", "sm-step-in", "sm-reveal", "scroll-behavior"]) {
      expect(allowed[0], name).toContain(name);
    }
  });

  it("declares no animation or smooth scrolling outside that block", () => {
    const outside = allowed.reduce((source, block) => source.replace(block, ""), css);
    const offending = outside.split("\n").filter((line) => motionDeclaration.test(line));
    expect(offending).toEqual([]);
  });

  it("keyframes start visible enough to read if a time-based animation stalls", () => {
    const rise = css.match(/@keyframes sm-rise\s*\{[\s\S]*?from\s*\{([^}]*)\}/)?.[1] ?? "";
    const opacity = Number(rise.match(/opacity:\s*([\d.]+)/)?.[1]);
    expect(opacity).toBeGreaterThanOrEqual(0.4);
  });
});
