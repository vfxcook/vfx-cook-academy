import assert from "node:assert/strict";
import test from "node:test";

import {
  coursePriceInr,
  getEnrollHref,
  galleryImages,
  landingBackgrounds,
  landingBrand,
  heroCopy,
} from "../src/lib/landing";

test("landing assets use the supplied logo and all rotating backgrounds", () => {
  assert.equal(landingBrand.logoSrc, "/Logo_Small_Website.png");
  assert.equal(landingBackgrounds.length, 14);
  assert.equal(new Set(landingBackgrounds.map((item) => item.src)).size, 14);
  assert.ok(landingBackgrounds.every((item) => item.src.startsWith("/BG_Images/")));
});

test("landing CTA and price use the current offer", () => {
  assert.equal(heroCopy.primaryCta, "Join Now!");
  assert.equal(coursePriceInr, 499);
});

test("gallery uses all supplied photos once", () => {
  assert.equal(galleryImages.length, 14);
  assert.deepEqual(galleryImages.map((item) => item.src), landingBackgrounds.map((item) => item.src));
});

test("landing primary action moves visitors from landing into the course page", () => {
  assert.equal(getEnrollHref({ slug: "cinematic-ai-video-creation" }), "/course/cinematic-ai-video-creation");
  assert.equal(getEnrollHref(null), "/login");
});
