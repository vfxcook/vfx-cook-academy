import type { PrismaClient } from "@/generated/prisma";

export const STUDIO_BRAND_NAME = "VFX COOK AI STUDIO";
export const STUDIO_ROUTE = "/creators-space";

export const STUDIO_USD_INR_RATE = 95.3;
export const STUDIO_KIE_CREDIT_USD = 0.005;
export const STUDIO_PLATFORM_MARGIN_INR = 100;
export const STUDIO_PAYMENT_BUFFER = 0.97;

export const defaultStudioCreditPacks = [
  { name: "Starter", credits: 500, sortOrder: 1 },
  { name: "Creator", credits: 1000, sortOrder: 2 },
  { name: "Pro", credits: 2500, sortOrder: 3 },
  { name: "Studio", credits: 5000, sortOrder: 4 },
];

export const defaultStudioModels = [
  {
    providerModelId: "gpt-image-1",
    displayName: "GPT Image",
    category: "Image",
    providerCredits: 6,
    sortOrder: 1,
  },
  {
    providerModelId: "nano-banana-pro-2k",
    displayName: "Nano Banana Pro 2K",
    category: "Image",
    providerCredits: 18,
    sortOrder: 2,
  },
  {
    providerModelId: "nano-banana-pro-4k",
    displayName: "Nano Banana Pro 4K",
    category: "Image",
    providerCredits: 24,
    sortOrder: 3,
  },
  {
    providerModelId: "veo-3-fast",
    displayName: "Veo 3 Fast",
    category: "Video",
    providerCredits: 80,
    sortOrder: 4,
  },
  {
    providerModelId: "veo-3-quality",
    displayName: "Veo 3 Quality",
    category: "Video",
    providerCredits: 400,
    sortOrder: 5,
  },
];

export function calculateStudioCreditPack(credits: number) {
  const providerCostUsd = credits * STUDIO_KIE_CREDIT_USD;
  const providerCostInr = Math.ceil(providerCostUsd * STUDIO_USD_INR_RATE);
  const amountInr = Math.ceil((providerCostInr + STUDIO_PLATFORM_MARGIN_INR) / STUDIO_PAYMENT_BUFFER / 10) * 10 - 1;
  return {
    providerCostUsd,
    providerCostInr,
    amountInr,
    platformMarginInr: STUDIO_PLATFORM_MARGIN_INR,
  };
}

export async function ensureStudioDefaults(prisma: PrismaClient) {
  for (const pack of defaultStudioCreditPacks) {
    const calculated = calculateStudioCreditPack(pack.credits);
    await prisma.studioCreditPack.upsert({
      where: { id: `studio-pack-${pack.credits}` },
      update: {
        name: pack.name,
        description: `${pack.credits.toLocaleString("en-IN")} Studio Credits for ${STUDIO_BRAND_NAME}`,
        credits: pack.credits,
        amountInr: calculated.amountInr,
        providerCostUsd: calculated.providerCostUsd,
        providerCostInr: calculated.providerCostInr,
        platformMarginInr: calculated.platformMarginInr,
        sortOrder: pack.sortOrder,
        isActive: true,
      },
      create: {
        id: `studio-pack-${pack.credits}`,
        name: pack.name,
        description: `${pack.credits.toLocaleString("en-IN")} Studio Credits for ${STUDIO_BRAND_NAME}`,
        credits: pack.credits,
        amountInr: calculated.amountInr,
        providerCostUsd: calculated.providerCostUsd,
        providerCostInr: calculated.providerCostInr,
        platformMarginInr: calculated.platformMarginInr,
        sortOrder: pack.sortOrder,
        isActive: true,
      },
    });
  }

  for (const model of defaultStudioModels) {
    await prisma.studioModelPricing.upsert({
      where: { providerModelId: model.providerModelId },
      update: {
        displayName: model.displayName,
        category: model.category,
        providerCredits: model.providerCredits,
        sortOrder: model.sortOrder,
        isEnabled: true,
      },
      create: {
        providerModelId: model.providerModelId,
        displayName: model.displayName,
        category: model.category,
        providerCredits: model.providerCredits,
        sortOrder: model.sortOrder,
        isEnabled: true,
      },
    });
  }
}
