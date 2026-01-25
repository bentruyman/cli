import { describe, expect, it } from "bun:test";

import { levenshteinDistance, findSuggestions } from "../src/suggestions";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns 0 for identical strings with different case", () => {
    expect(levenshteinDistance("Hello", "hello")).toBe(0);
    expect(levenshteinDistance("HELLO", "hello")).toBe(0);
  });

  it("returns length of non-empty string when other is empty", () => {
    expect(levenshteinDistance("", "hello")).toBe(5);
    expect(levenshteinDistance("hello", "")).toBe(5);
  });

  it("returns 0 for two empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("returns 1 for single insertion", () => {
    expect(levenshteinDistance("hello", "helllo")).toBe(1);
  });

  it("returns 1 for single deletion", () => {
    expect(levenshteinDistance("helllo", "hello")).toBe(1);
  });

  it("returns 1 for single substitution", () => {
    expect(levenshteinDistance("hello", "hallo")).toBe(1);
  });

  it("calculates correct distance for multiple edits", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("saturday", "sunday")).toBe(3);
  });

  it("handles completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });
});

describe("findSuggestions", () => {
  const candidates = ["add", "list", "remove", "update", "status", "verbose"];

  it("returns closest match for typo", () => {
    const result = findSuggestions("addd", candidates);
    expect(result[0]).toBe("add");
  });

  it("returns multiple suggestions sorted by distance", () => {
    const result = findSuggestions("stat", candidates);
    expect(result).toContain("status");
  });

  it("returns empty array when no good matches", () => {
    const result = findSuggestions("xyz", candidates);
    expect(result).toEqual([]);
  });

  it("returns empty array for very short inputs", () => {
    const result = findSuggestions("a", candidates);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty candidates", () => {
    const result = findSuggestions("hello", []);
    expect(result).toEqual([]);
  });

  it("is case-insensitive", () => {
    const result = findSuggestions("ADD", candidates);
    expect(result).toContain("add");
  });

  it("limits results to 3 suggestions", () => {
    const manyCandidates = ["test1", "test2", "test3", "test4", "test5"];
    const result = findSuggestions("test", manyCandidates);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("suggests similar flag names", () => {
    const flags = ["verbose", "version", "force", "debug", "quiet"];
    expect(findSuggestions("vrebose", flags)).toContain("verbose");
    expect(findSuggestions("forse", flags)).toContain("force");
  });

  it("does not include exact matches (distance 0)", () => {
    const result = findSuggestions("add", candidates);
    expect(result).not.toContain("add");
  });

  it("respects custom maxDistance", () => {
    // "remov" to "remove" has distance 1, so with maxDistance=1 it should be included
    const result = findSuggestions("remov", candidates, 1);
    expect(result).toContain("remove");

    // But with maxDistance=0, nothing should match (exact matches only, but we exclude those)
    const noResult = findSuggestions("remov", candidates, 0);
    expect(noResult).toEqual([]);
  });
});
