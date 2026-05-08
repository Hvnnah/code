import type { DraftComment } from "@features/code-review/stores/reviewDraftsStore";
import { describe, expect, it } from "vitest";
import { buildPlanAnnotationsPrompt } from "./planAnnotationPrompts";

function draft(overrides: Partial<DraftComment> = {}): DraftComment {
  return {
    id: "d1",
    taskId: "t1",
    filePath: "plan:tc1",
    startLine: 1,
    endLine: 1,
    side: "additions",
    text: "comment",
    createdAt: 0,
    ...overrides,
  };
}

describe("buildPlanAnnotationsPrompt", () => {
  it("returns empty string when no drafts", () => {
    expect(buildPlanAnnotationsPrompt([])).toBe("");
  });

  it("formats a single-line draft", () => {
    const out = buildPlanAnnotationsPrompt([
      draft({ startLine: 5, endLine: 5, text: "use X here" }),
    ]);
    expect(out).toBe(
      "Please revise the plan based on this inline comment on line 5:\n\nuse X here",
    );
  });

  it("formats a single multi-line range", () => {
    const out = buildPlanAnnotationsPrompt([
      draft({ startLine: 5, endLine: 7, text: "rework this" }),
    ]);
    expect(out).toBe(
      "Please revise the plan based on this inline comment on lines 5-7:\n\nrework this",
    );
  });

  it("formats multiple drafts as a bulleted list, sorted by startLine", () => {
    const out = buildPlanAnnotationsPrompt([
      draft({ id: "b", startLine: 12, endLine: 12, text: "second" }),
      draft({ id: "a", startLine: 5, endLine: 7, text: "first\nmore" }),
    ]);
    expect(out).toBe(
      "Please revise the plan based on these inline comments:\n\n" +
        "- On lines 5-7:\n  first\n  more\n\n" +
        "- On line 12:\n  second",
    );
  });
});
