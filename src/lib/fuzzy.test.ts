import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  it("matches subsequences case-insensitively, rejects non-subsequences", () => {
    expect(fuzzyScore("bell", "Android 17 Bell of Mindfulness")).not.toBeNull();
    expect(fuzzyScore("BELL", "android bell")).not.toBeNull();
    expect(fuzzyScore("xyz", "android bell")).toBeNull();
  });

  it("ranks prefix/contiguous matches above scattered ones", () => {
    const prefix = fuzzyScore("and", "android work")!;
    const scattered = fuzzyScore("and", "acceptance handling day")!;
    expect(prefix).toBeGreaterThan(scattered);
  });

  it("prefers word-boundary matches", () => {
    const wordStart = fuzzyScore("bell", "android bell")!;
    const midWord = fuzzyScore("bell", "umbrellas bloom")!;
    expect(wordStart).toBeGreaterThan(midWord);
  });
});

describe("fuzzyFilter", () => {
  const tasks = ["Bell of Mindfulness", "Bug triage", "Design review", "bell schedule"];

  it("empty query returns the head of the list in order (recency)", () => {
    expect(fuzzyFilter("", tasks, 2)).toEqual(["Bell of Mindfulness", "Bug triage"]);
  });

  it("filters and ranks matches, respecting the limit", () => {
    const result = fuzzyFilter("bel", tasks, 10);
    expect(result).toContain("Bell of Mindfulness");
    expect(result).toContain("bell schedule");
    expect(result).not.toContain("Design review");
    expect(fuzzyFilter("bel", tasks, 1)).toHaveLength(1);
  });

  it("ties keep input order (earlier = more recent)", () => {
    const result = fuzzyFilter("b", ["b one", "b two"], 5);
    expect(result).toEqual(["b one", "b two"]);
  });
});
