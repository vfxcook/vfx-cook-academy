import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/app/globals.css", "utf8");
const classroomPlayer = readFileSync("src/components/ClassroomPlayer.tsx", "utf8");
const coursePage = readFileSync("src/app/course/[slug]/page.tsx", "utf8");

test("course player exposes mobile layout hooks", () => {
  assert.match(classroomPlayer, /className="classroom-layout"/);
  assert.match(classroomPlayer, /className="classroom-community-layout"/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.classroom-layout/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.classroom-community-layout/);
});

test("course detail hero has mobile-safe class hooks", () => {
  assert.match(coursePage, /className="card course-detail-hero"/);
  assert.match(coursePage, /className="course-detail-title"/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.course-detail-title/);
});
