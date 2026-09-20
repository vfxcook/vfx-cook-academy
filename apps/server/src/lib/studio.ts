import type { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from './http.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const STUDIO_BRAND_NAME = 'VFX COOK AI STUDIO';
export const STUDIO_ROUTE = '/studio';

export const STUDIO_USD_INR_RATE = 95.3;
export const STUDIO_KIE_CREDIT_USD = 0.005;
export const STUDIO_PLATFORM_MARGIN_INR = 100;
export const STUDIO_PAYMENT_BUFFER = 0.97;

export const defaultStudioCreditPacks = [
  { name: 'Starter', credits: 500, sortOrder: 1 },
  { name: 'Creator', credits: 1000, sortOrder: 2 },
  { name: 'Pro', credits: 2500, sortOrder: 3 },
  { name: 'Studio', credits: 5000, sortOrder: 4 }
];

export const defaultStudioModels = [
  { providerModelId: 'gpt-image-1', displayName: 'GPT Image', category: 'Image', providerCredits: 6, sortOrder: 1 },
  { providerModelId: 'nano-banana-pro-2k', displayName: 'Nano Banana Pro 2K', category: 'Image', providerCredits: 18, sortOrder: 2 },
  { providerModelId: 'nano-banana-pro-4k', displayName: 'Nano Banana Pro 4K', category: 'Image', providerCredits: 24, sortOrder: 3 },
  { providerModelId: 'veo-3-fast', displayName: 'Veo 3 Fast', category: 'Video', providerCredits: 80, sortOrder: 4 },
  { providerModelId: 'veo-3-quality', displayName: 'Veo 3 Quality', category: 'Video', providerCredits: 400, sortOrder: 5 }
];

/** Provider cost in INR, plus a flat margin, grossed up for the gateway cut and ending in a 9. */
export function calculateStudioCreditPack(credits: number) {
  const providerCostUsd = credits * STUDIO_KIE_CREDIT_USD;
  const providerCostInr = Math.ceil(providerCostUsd * STUDIO_USD_INR_RATE);
  const amountInr =
    Math.ceil((providerCostInr + STUDIO_PLATFORM_MARGIN_INR) / STUDIO_PAYMENT_BUFFER / 10) * 10 - 1;
  return { providerCostUsd, providerCostInr, amountInr, platformMarginInr: STUDIO_PLATFORM_MARGIN_INR };
}

export async function ensureStudioDefaults(db: PrismaClient) {
  for (const pack of defaultStudioCreditPacks) {
    const calculated = calculateStudioCreditPack(pack.credits);
    const shape = {
      name: pack.name,
      description: `${pack.credits.toLocaleString('en-IN')} Studio Credits for ${STUDIO_BRAND_NAME}`,
      credits: pack.credits,
      amountInr: calculated.amountInr,
      providerCostUsd: calculated.providerCostUsd,
      providerCostInr: calculated.providerCostInr,
      platformMarginInr: calculated.platformMarginInr,
      sortOrder: pack.sortOrder,
      isActive: true
    };
    await db.studioCreditPack.upsert({
      where: { id: `studio-pack-${pack.credits}` },
      update: shape,
      create: { id: `studio-pack-${pack.credits}`, ...shape }
    });
  }

  for (const model of defaultStudioModels) {
    const shape = {
      displayName: model.displayName,
      category: model.category,
      providerCredits: model.providerCredits,
      sortOrder: model.sortOrder,
      isEnabled: true
    };
    await db.studioModelPricing.upsert({
      where: { providerModelId: model.providerModelId },
      update: shape,
      create: { providerModelId: model.providerModelId, ...shape }
    });
  }
}

export function getOrCreateStudioBalance(db: Db, userId: string) {
  return db.studioCreditBalance.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function addStudioCredits(params: {
  db: Db;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
}) {
  const current = await getOrCreateStudioBalance(params.db, params.userId);
  const balanceAfter = current.availableCredits + params.credits;

  await params.db.studioCreditBalance.update({
    where: { userId: params.userId },
    data: {
      availableCredits: balanceAfter,
      lifetimePurchasedCredits: { increment: params.credits }
    }
  });
  await params.db.studioCreditLedger.create({
    data: {
      userId: params.userId,
      type: 'PURCHASE',
      deltaCredits: params.credits,
      balanceAfter,
      referenceId: params.referenceId,
      note: params.note
    }
  });
  return balanceAfter;
}

export async function spendStudioCredits(params: {
  db: Db;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
}) {
  const current = await getOrCreateStudioBalance(params.db, params.userId);
  if (current.availableCredits < params.credits) {
    throw new ApiError(402, 'Not enough studio credits for this generation.', 'INSUFFICIENT_CREDITS');
  }
  const balanceAfter = current.availableCredits - params.credits;

  await params.db.studioCreditBalance.update({
    where: { userId: params.userId },
    data: { availableCredits: balanceAfter, lifetimeUsedCredits: { increment: params.credits } }
  });
  await params.db.studioCreditLedger.create({
    data: {
      userId: params.userId,
      type: 'GENERATION_DEBIT',
      deltaCredits: -params.credits,
      balanceAfter,
      referenceId: params.referenceId,
      note: params.note
    }
  });
  return balanceAfter;
}

export async function refundStudioCredits(params: {
  db: Db;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
}) {
  const current = await getOrCreateStudioBalance(params.db, params.userId);
  const balanceAfter = current.availableCredits + params.credits;

  await params.db.studioCreditBalance.update({
    where: { userId: params.userId },
    data: { availableCredits: balanceAfter, lifetimeUsedCredits: { decrement: params.credits } }
  });
  await params.db.studioCreditLedger.create({
    data: {
      userId: params.userId,
      type: 'REFUND',
      deltaCredits: params.credits,
      balanceAfter,
      referenceId: params.referenceId,
      note: params.note
    }
  });
  return balanceAfter;
}
