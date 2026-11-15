import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import FitExplorer from "./fit-explorer";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
afterEach(() => vi.unstubAllGlobals());
it("seeds the existing Fit Explorer's textarea with escaped extracted text and keeps live AI locked", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const text = "EXPERIENCE\n<script>synthetic-canary</script>";
  const html = renderToString(createElement(FitExplorer, { uploadedResume: { id: "synthetic", text } }));
  expect(html).toContain("&lt;script&gt;synthetic-canary&lt;/script&gt;");
  expect(html).not.toContain("<script>synthetic-canary</script>");
  expect(html).toContain("Analyze my fit"); expect(html).toContain("disabled");
  expect(fetch).not.toHaveBeenCalled();
});
