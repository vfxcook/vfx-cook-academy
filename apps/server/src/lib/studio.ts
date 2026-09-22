import type { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from './http.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const STUDIO_BRAND_NAME = 'Academy AI Studio';

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
      description: `${pack.credits.toLocaleString('en-IN')} credits for the ${STUDIO_BRAND_NAME}`,
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

type CreditChange = {
  db: Db;
  userId: string;
  credits: number;
  referenceId?: string;
  note?: string;
};

/*
 * Every balance change is a single atomic increment or a guarded decrement, never a
 * read-then-write. Two generations started in the same instant therefore cannot both
 * spend the same credits, and the ledger's balanceAfter is the row as actually written.
 */

export async function addStudioCredits(change: CreditChange) {
  await getOrCreateStudioBalance(change.db, change.userId);
  const row = await change.db.studioCreditBalance.update({
    where: { userId: change.userId },
    data: {
      availableCredits: { increment: change.credits },
      lifetimePurchasedCredits: { increment: change.credits }
    }
  });
  await change.db.studioCreditLedger.create({
    data: {
      userId: change.userId,
      type: 'PURCHASE',
      deltaCredits: change.credits,
      balanceAfter: row.availableCredits,
      referenceId: change.referenceId,
      note: change.note
    }
  });
  return row.availableCredits;
}

export async function spendStudioCredits(change: CreditChange) {
  await getOrCreateStudioBalance(change.db, change.userId);
  const spent = await change.db.studioCreditBalance.updateMany({
    where: { userId: change.userId, availableCredits: { gte: change.credits } },
    data: {
      availableCredits: { decrement: change.credits },
      lifetimeUsedCredits: { increment: change.credits }
    }
  });
  if (spent.count === 0) {
    throw new ApiError(402, 'Not enough studio credits for this generation.', 'INSUFFICIENT_CREDITS');
  }

  const row = await change.db.studioCreditBalance.findUniqueOrThrow({ where: { userId: change.userId } });
  await change.db.studioCreditLedger.create({
    data: {
      userId: change.userId,
      type: 'GENERATION_DEBIT',
      deltaCredits: -change.credits,
      balanceAfter: row.availableCredits,
      referenceId: change.referenceId,
      note: change.note
    }
  });
  return row.availableCredits;
}

export async function refundStudioCredits(change: CreditChange) {
  await getOrCreateStudioBalance(change.db, change.userId);
  const row = await change.db.studioCreditBalance.update({
    where: { userId: change.userId },
    data: {
      availableCredits: { increment: change.credits },
      lifetimeUsedCredits: { decrement: change.credits }
    }
  });
  await change.db.studioCreditLedger.create({
    data: {
      userId: change.userId,
      type: 'REFUND',
      deltaCredits: change.credits,
      balanceAfter: row.availableCredits,
      referenceId: change.referenceId,
      note: change.note
    }
  });
  return row.availableCredits;
}

/** Admin top-ups and deductions. A deduction can never take the balance below zero. */
export async function adjustStudioCredits(change: CreditChange) {
  await getOrCreateStudioBalance(change.db, change.userId);

  const adjusted = await change.db.studioCreditBalance.updateMany({
    where: {
      userId: change.userId,
      ...(change.credits < 0 ? { availableCredits: { gte: Math.abs(change.credits) } } : {})
    },
    data: {
      availableCredits: { increment: change.credits },
      ...(change.credits > 0
        ? { lifetimePurchasedCredits: { increment: change.credits } }
        : { lifetimeUsedCredits: { increment: Math.abs(change.credits) } })
    }
  });
  if (adjusted.count === 0) {
    throw new ApiError(400, 'That deduction would take the balance below zero.', 'INSUFFICIENT_CREDITS');
  }

  const row = await change.db.studioCreditBalance.findUniqueOrThrow({ where: { userId: change.userId } });
  await change.db.studioCreditLedger.create({
    data: {
      userId: change.userId,
      type: 'ADMIN_ADJUSTMENT',
      deltaCredits: change.credits,
      balanceAfter: row.availableCredits,
      referenceId: change.referenceId,
      note: change.note
    }
  });
  return row.availableCredits;
}
