import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const header = readFileSync("src/components/Header.tsx", "utf8");

test("VFX COOK AI STUDIO has credit-backed database contracts", () => {
  assert.match(schema, /model StudioCreditBalance/);
  assert.match(schema, /model StudioCreditPack/);
  assert.match(schema, /model StudioCreditPurchase/);
  assert.match(schema, /model StudioCreditLedger/);
  assert.match(schema, /model StudioWorkflow/);
  assert.match(schema, /model StudioGeneration/);
  assert.match(schema, /model StudioModelPricing/);
});

test("VFX COOK AI STUDIO keeps the parked module and Razorpay credit APIs", () => {
  assert.ok(existsSync("src/components/VfxCookAiStudio.tsx"));
  assert.ok(existsSync("src/components/StudioCreditCheckoutButton.tsx"));
  assert.ok(existsSync("src/app/api/studio/credits/route.ts"));
  assert.ok(existsSync("src/app/api/studio/credits/order/route.ts"));
  assert.ok(existsSync("src/app/api/studio/credits/verify/route.ts"));
  assert.ok(existsSync("src/app/api/studio/workflows/route.ts"));
  assert.ok(existsSync("src/app/api/studio/generate/route.ts"));
});

test("Studio is disabled for launch while preserving the VFX COOK AI STUDIO module", () => {
  const component = existsSync("src/components/VfxCookAiStudio.tsx")
    ? readFileSync("src/components/VfxCookAiStudio.tsx", "utf8")
    : "";
  assert.equal(existsSync("src/app/creators-space/page.tsx"), false);
  assert.equal(existsSync("src/app/admin/studio/page.tsx"), false);
  assert.doesNotMatch(header, /Creators Space/);
  assert.match(component, /VFX COOK AI STUDIO/);
  assert.doesNotMatch(component, /HeliosGen/i);
});
