import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("Date filtering bug fix verification", () => {
  it("should use inclusive date comparisons (gte/lte) instead of exclusive (gt/lt) for reaction filtering", () => {
    const searchFilePath = join(process.cwd(), "lib/data/conversation/search.ts");
    const searchFileContent = readFileSync(searchFilePath, "utf-8");

    expect(searchFileContent).toContain("gte(conversationMessages.reactionCreatedAt");
    expect(searchFileContent).toContain("lte(conversationMessages.reactionCreatedAt");

    const gteMatches = searchFileContent.match(/gte\(conversationMessages\.reactionCreatedAt/g);
    const lteMatches = searchFileContent.match(/lte\(conversationMessages\.reactionCreatedAt/g);
    const gtMatches = searchFileContent.match(/gt\(conversationMessages\.reactionCreatedAt/g);
    const ltMatches = searchFileContent.match(/lt\(conversationMessages\.reactionCreatedAt/g);

    expect(gteMatches).toHaveLength(1);
    expect(lteMatches).toHaveLength(1);
    expect(gtMatches).toBeNull();
    expect(ltMatches).toBeNull();
  });

  it("should import gte and lte from drizzle-orm", () => {
    const searchFilePath = join(process.cwd(), "lib/data/conversation/search.ts");
    const searchFileContent = readFileSync(searchFilePath, "utf-8");

    expect(searchFileContent).toMatch(/import\s*{[^}]*gte[^}]*}\s*from\s*["']drizzle-orm["']/);
    expect(searchFileContent).toMatch(/import\s*{[^}]*lte[^}]*}\s*from\s*["']drizzle-orm["']/);
  });
});
