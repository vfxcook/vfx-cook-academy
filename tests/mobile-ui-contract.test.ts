import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/app/globals.css", "utf8");
const classroomPlayer = readFileSync("src/components/ClassroomPlayer.tsx", "utf8");
const coursePage = readFileSync("src/app/course/[slug]/page.tsx", "utf8");
const homePage = readFileSync("src/app/page.tsx", "utf8");
const checkoutPage = readFileSync("src/app/checkout/[slug]/page.tsx", "utf8");

test("course player exposes mobile layout hooks", () => {
  assert.match(classroomPlayer, /className="classroom-layout"/);
  assert.match(classroomPlayer, /className="classroom-community-layout"/);
  assert.match(classroomPlayer, /className="classroom-action-bar"/);
  assert.match(classroomPlayer, /lesson-list-button/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.classroom-layout/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.classroom-community-layout/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.classroom-action-bar/);
});

test("course-taking pages do not show launch banners above learning content", () => {
  assert.doesNotMatch(coursePage, /course-detail-hero/);
  assert.doesNotMatch(classroomPlayer, /classroom-intro-card/);
  assert.doesNotMatch(coursePage + classroomPlayer, /Course details collapsed/);
});

test("launch UI follows mobile accessibility hardening rules", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(homePage, /ðŸ’¬|💬/);
  assert.doesNotMatch(classroomPlayer, /✅|🔒/);
});

test("checkout exposes trust and recovery sections", () => {
  assert.match(checkoutPage, /checkout-shell/);
  assert.match(checkoutPage, /checkout-trust-list/);
  assert.match(checkoutPage, /Need help\?/);
  assert.match(checkoutPage, /aria-live="polite"/);
});
