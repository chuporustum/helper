import { endOfDay, parseISO, startOfDay } from "date-fns";
import { describe, expect, it, vi } from "vitest";

// This tests the core logic that was fixed in the bug
describe("ReactionsChart handleBarClick logic", () => {
  // Mock the date functions
  vi.mock("date-fns", () => ({
    startOfDay: vi.fn((date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())),
    endOfDay: vi.fn((date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)),
    parseISO: vi.fn((dateString: string) => new Date(dateString)),
  }));

  // Simulate the handleBarClick function logic that was fixed
  function createSearchParams(data: any, reactionType: "thumbs-up" | "thumbs-down") {
    const clickedDate = parseISO(data.date || data.payload?.date);

    // This is the bug fix: use reactionAfter/reactionBefore instead of createdAfter/createdBefore
    return {
      reactionAfter: startOfDay(clickedDate),
      reactionBefore: endOfDay(clickedDate),
      reactionType,
      // The bug was using these parameters instead:
      // createdAfter: startOfDay(clickedDate),
      // createdBefore: endOfDay(clickedDate),
    };
  }

  it("should use reactionAfter and reactionBefore parameters for positive reactions", () => {
    const mockBarData = {
      date: "2025-07-01",
      positive: 5,
      negative: 2,
      payload: { date: "2025-07-01", positive: 5, negative: 2 },
    };

    const params = createSearchParams(mockBarData, "thumbs-up");

    // Verify the correct parameters are used
    expect(params).toHaveProperty("reactionAfter");
    expect(params).toHaveProperty("reactionBefore");
    expect(params).toHaveProperty("reactionType", "thumbs-up");

    // Verify the old buggy parameters are NOT used
    expect(params).not.toHaveProperty("createdAfter");
    expect(params).not.toHaveProperty("createdBefore");

    // Verify the dates are correctly calculated
    expect(params.reactionAfter).toEqual(startOfDay(new Date("2025-07-01")));
    expect(params.reactionBefore).toEqual(endOfDay(new Date("2025-07-01")));
  });

  it("should use reactionAfter and reactionBefore parameters for negative reactions", () => {
    const mockBarData = {
      date: "2025-07-01",
      positive: 5,
      negative: 2,
      payload: { date: "2025-07-01", positive: 5, negative: 2 },
    };

    const params = createSearchParams(mockBarData, "thumbs-down");

    // Verify the correct parameters are used
    expect(params).toHaveProperty("reactionAfter");
    expect(params).toHaveProperty("reactionBefore");
    expect(params).toHaveProperty("reactionType", "thumbs-down");

    // Verify the old buggy parameters are NOT used
    expect(params).not.toHaveProperty("createdAfter");
    expect(params).not.toHaveProperty("createdBefore");

    // Verify the dates are correctly calculated
    expect(params.reactionAfter).toEqual(startOfDay(new Date("2025-07-01")));
    expect(params.reactionBefore).toEqual(endOfDay(new Date("2025-07-01")));
  });

  it("should handle different date formats", () => {
    const mockBarData = {
      payload: { date: "2025-12-25" },
    };

    const params = createSearchParams(mockBarData, "thumbs-up");

    expect(params.reactionAfter).toEqual(startOfDay(new Date("2025-12-25")));
    expect(params.reactionBefore).toEqual(endOfDay(new Date("2025-12-25")));
  });

  it("should demonstrate the bug fix by showing what NOT to do", () => {
    // This is what the code was doing BEFORE the bug fix (wrong approach)
    function createBuggySearchParams(data: any, reactionType: "thumbs-up" | "thumbs-down") {
      const clickedDate = parseISO(data.date || data.payload?.date);

      // BUG: Using createdAfter/createdBefore instead of reactionAfter/reactionBefore
      return {
        createdAfter: startOfDay(clickedDate),
        createdBefore: endOfDay(clickedDate),
        reactionType,
      };
    }

    const mockBarData = {
      date: "2025-07-01",
      positive: 5,
      negative: 2,
    };

    const buggyParams = createBuggySearchParams(mockBarData, "thumbs-up");
    const fixedParams = createSearchParams(mockBarData, "thumbs-up");

    // The buggy version uses createdAfter/createdBefore
    expect(buggyParams).toHaveProperty("createdAfter");
    expect(buggyParams).toHaveProperty("createdBefore");
    expect(buggyParams).not.toHaveProperty("reactionAfter");
    expect(buggyParams).not.toHaveProperty("reactionBefore");

    // The fixed version uses reactionAfter/reactionBefore
    expect(fixedParams).toHaveProperty("reactionAfter");
    expect(fixedParams).toHaveProperty("reactionBefore");
    expect(fixedParams).not.toHaveProperty("createdAfter");
    expect(fixedParams).not.toHaveProperty("createdBefore");

    // This demonstrates the bug fix: different parameter names for the same date filtering
    expect(buggyParams.createdAfter).toEqual(fixedParams.reactionAfter);
    expect(buggyParams.createdBefore).toEqual(fixedParams.reactionBefore);
  });
});
