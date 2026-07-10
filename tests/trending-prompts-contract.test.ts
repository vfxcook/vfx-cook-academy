import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const storage = readFileSync("src/lib/storage.ts", "utf8");
const adminActions = readFileSync("src/lib/admin-actions.ts", "utf8");
const nav = readFileSync("src/lib/admin-workspace.ts", "utf8");
const home = readFileSync("src/app/page.tsx", "utf8");

test("trending prompts are backed by database and admin uploads", () => {
  assert.match(schema, /model TrendingPrompt/);
  assert.match(schema, /prompt\s+String/);
  assert.match(schema, /imageUrl\s+String/);
  assert.match(storage, /"prompts"/);
  assert.match(adminActions, /createTrendingPrompt/);
  assert.match(adminActions, /deleteTrendingPrompt/);
});

test("trending prompts appear in admin nav and homepage copy cards", () => {
  assert.match(nav, /Prompts/);
  assert.ok(existsSync("src/app/admin/prompts/page.tsx"));
  assert.ok(existsSync("src/components/TrendingPrompts.tsx"));
  assert.match(home, /trendingPrompt/);
  assert.match(readFileSync("src/components/TrendingPrompts.tsx", "utf8"), /navigator\.clipboard/);
});
