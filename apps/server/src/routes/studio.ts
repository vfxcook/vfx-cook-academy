import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { env } from '../lib/env.js';
import { ApiError, badRequest, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { createOrder, verifyCheckoutSignature } from '../lib/razorpay.js';
import { settleStudioPurchase } from '../lib/settle.js';
import { timingSafeEqual } from '../lib/utils.js';
import {
  STUDIO_BRAND_NAME,
  ensureStudioDefaults,
  getOrCreateStudioBalance,
  refundStudioCredits,
  spendStudioCredits
} from '../lib/studio.js';

export const studioRouter = Router();

studioRouter.get(
  '/overview',
  requireUser,
  route(async (req, res) => {
    await ensureStudioDefaults(prisma);

    const [balance, packs, models, ledger, purchases, generations] = await Promise.all([
      getOrCreateStudioBalance(prisma, req.user!.id),
      prisma.studioCreditPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.studioModelPricing.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.studioCreditLedger.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 12
      }),
      prisma.studioCreditPurchase.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { pack: { select: { name: true } } }
      }),
      prisma.studioGeneration.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 24,
        include: { modelPricing: { select: { displayName: true, category: true } } }
      })
    ]);

    res.json({ brand: STUDIO_BRAND_NAME, balance, packs, models, ledger, purchases, generations });
  })
);

studioRouter.post(
  '/credits/order',
  requireUser,
  route(async (req, res) => {
    const { packId } = parse(z.object({ packId: z.string().min(1) }), req.body);

    await ensureStudioDefaults(prisma);
    const pack = await prisma.studioCreditPack.findFirst({ where: { id: packId, isActive: true } });
    if (!pack) throw notFound('That credit pack is not available.');

    const order = await createOrder({
      amountInr: pack.amountInr,
      receipt: `studio_${req.user!.id.slice(-8)}_${Date.now()}`,
      notes: {
        kind: 'studio_credit_purchase',
        userId: req.user!.id,
        packId: pack.id,
        credits: String(pack.credits)
      }
    });

    await prisma.studioCreditPurchase.create({
      data: {
        userId: req.user!.id,
        packId: pack.id,
        amountInr: pack.amountInr,
        credits: pack.credits,
        razorpayOrderId: order.id,
        status: 'PENDING'
      }
    });

    res.json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      keyId: env.razorpay.keyId,
      description: `${pack.name} — ${pack.credits} ${STUDIO_BRAND_NAME} credits`
    });
  })
);

studioRouter.post(
  '/credits/verify',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1)
      }),
      req.body
    );

    if (!verifyCheckoutSignature(data.razorpayOrderId, data.razorpayPaymentId, data.razorpaySignature)) {
      throw badRequest('We could not verify that payment signature.');
    }

    const result = await prisma.$transaction(tx =>
      settleStudioPurchase(tx, {
        orderId: data.razorpayOrderId,
        paymentId: data.razorpayPaymentId,
        userId: req.user!.id
      })
    );
    if (!result.found) throw notFound('Purchase not found.');
    const balance = result.balance;

    res.json({ ok: true, balance });
  })
);

studioRouter.get(
  '/workflows',
  requireUser,
  route(async (req, res) => {
    const workflows = await prisma.studioWorkflow.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      take: 12
    });
    res.json({ workflows });
  })
);

studioRouter.post(
  '/workflows',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({
        workflowId: z.string().optional(),
        title: z.string().trim().min(2).max(120),
        canvasJson: z.unknown()
      }),
      req.body
    );

    if (data.workflowId) {
      const existing = await prisma.studioWorkflow.findUnique({
        where: { id: data.workflowId },
        select: { userId: true }
      });
      if (!existing || existing.userId !== req.user!.id) throw notFound('Workflow not found.');
    }

    const canvasJson = data.canvasJson as never;
    const workflow = data.workflowId
      ? await prisma.studioWorkflow.update({
          where: { id: data.workflowId },
          data: { title: data.title, canvasJson }
        })
      : await prisma.studioWorkflow.create({
          data: { userId: req.user!.id, title: data.title, canvasJson }
        });

    res.json({ workflow });
  })
);

const KIE_BASE = 'https://api.kie.ai';

async function providerKey() {
  const stored = await prisma.appSetting.findUnique({ where: { key: 'KIE_API_KEY' } });
  return stored?.value || env.studio.kieApiKey;
}

/**
 * The provider calls back unauthenticated, and students can see their own generation
 * ids. Without a signature anyone could post a fake failure, collect the refund and keep
 * the provider bill running. The key is STUDIO_CALLBACK_SECRET, or derived from the
 * provider key when that is unset, so no extra configuration is required.
 */
async function callbackSignature(generationId: string) {
  const secret = env.studio.callbackSecret || (await providerKey());
  if (!secret) return '';
  return crypto.createHmac('sha256', `academy-callback:${secret}`).update(generationId).digest('hex');
}

studioRouter.post(
  '/generate',
  requireUser,
  route(async (req, res) => {
    const data = parse(
      z.object({
        workflowId: z.string().optional(),
        providerModelId: z.string().min(1),
        prompt: z.string().trim().min(3, 'Describe the shot you want.').max(5000)
      }),
      req.body
    );

    const queued = await prisma.$transaction(async tx => {
      const model = await tx.studioModelPricing.findUnique({
        where: { providerModelId: data.providerModelId }
      });
      if (!model?.isEnabled) throw badRequest('That model is not available right now.');

      if (data.workflowId) {
        const workflow = await tx.studioWorkflow.findUnique({ where: { id: data.workflowId } });
        if (!workflow || workflow.userId !== req.user!.id) throw notFound('Workflow not found.');
      }

      const generation = await tx.studioGeneration.create({
        data: {
          userId: req.user!.id,
          workflowId: data.workflowId,
          modelPricingId: model.id,
          prompt: data.prompt,
          creditsCharged: model.providerCredits,
          status: 'QUEUED'
        },
        include: { modelPricing: { select: { displayName: true, category: true } } }
      });

      const balance = await spendStudioCredits({
        db: tx,
        userId: req.user!.id,
        credits: model.providerCredits,
        referenceId: generation.id,
        note: `${model.displayName} generation queued`
      });

      return { generation, balance };
    });

    try {
      const apiKey = await providerKey();
      if (!apiKey) throw new Error('KIE_API_KEY is not configured.');

      const base = (env.studio.callbackBaseUrl || env.appUrl).replace(/\/$/, '');
      const sig = await callbackSignature(queued.generation.id);
      const callBackUrl = `${base}/api/studio/callback?id=${queued.generation.id}&sig=${sig}`;

      let endpoint = `${KIE_BASE}/api/v1/jobs/createTask`;
      let body: Record<string, unknown> = {
        model: data.providerModelId,
        callBackUrl,
        input: { prompt: data.prompt }
      };

      if (data.providerModelId.startsWith('veo')) {
        endpoint = `${KIE_BASE}/api/v1/veo/generate`;
        body = {
          model: data.providerModelId,
          prompt: data.prompt,
          generationType: 'TEXT_2_VIDEO',
          aspect_ratio: '16:9',
          resolution: '720p',
          imageUrls: [],
          watermark: '',
          enableFallback: false,
          enableTranslation: true,
          callBackUrl
        };
      } else if (data.providerModelId.includes('nano-banana')) {
        (body.input as Record<string, unknown>).image_size = '16:9';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());

      const payload = (await response.json()) as { code?: number; msg?: string };
      if (payload.code !== undefined && payload.code !== 200) {
        throw new Error(payload.msg ?? 'Provider rejected the task.');
      }

      await prisma.studioGeneration.update({
        where: { id: queued.generation.id },
        data: { status: 'RUNNING' }
      });
    } catch (error) {
      // The credit is given straight back — a job that never started is never charged.
      await prisma.$transaction(async tx => {
        await refundStudioCredits({
          db: tx,
          userId: req.user!.id,
          credits: queued.generation.creditsCharged,
          referenceId: queued.generation.id,
          note: 'Provider never queued the job, credits returned'
        });
        await tx.studioGeneration.update({
          where: { id: queued.generation.id },
          data: { status: 'FAILED', errorMessage: String(error) }
        });
      });
      throw new ApiError(502, 'The provider could not start that generation. Your credits are back.', 'PROVIDER_FAILED');
    }

    res.json({
      ok: true,
      balance: queued.balance,
      generation: { ...queued.generation, status: 'RUNNING' }
    });
  })
);

studioRouter.get(
  '/generations',
  requireUser,
  route(async (req, res) => {
    const generations = await prisma.studioGeneration.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 24,
      include: { modelPricing: { select: { displayName: true, category: true } } }
    });
    const balance = await getOrCreateStudioBalance(prisma, req.user!.id);
    res.json({ generations, balance });
  })
);

/** Provider callback. Unauthenticated by design; it is keyed by generation id. */
studioRouter.post(
  '/callback',
  route(async (req, res) => {
    const generationId = String(req.query.id ?? '').trim();
    if (!generationId) return res.json({ received: true });

    const expected = await callbackSignature(generationId);
    if (!expected || !timingSafeEqual(expected, String(req.query.sig ?? ''))) {
      return res.json({ received: true });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = (body.data ?? body) as Record<string, unknown>;
    const state = String(data.state ?? data.status ?? '').toLowerCase();

    const generation = await prisma.studioGeneration.findUnique({ where: { id: generationId } });
    if (!generation) return res.json({ received: true });

    // Terminal states are final, so a repeated callback cannot double-refund.
    if (['SUCCEEDED', 'FAILED', 'REFUNDED'].includes(generation.status)) {
      return res.json({ received: true });
    }

    const failWithRefund = async (message: string) => {
      await prisma.$transaction(async tx => {
        await refundStudioCredits({
          db: tx,
          userId: generation.userId,
          credits: generation.creditsCharged,
          referenceId: generation.id,
          note: 'Provider reported a failure, credits returned'
        });
        await tx.studioGeneration.update({
          where: { id: generation.id },
          data: { status: 'REFUNDED', errorMessage: message }
        });
      });
    };

    if (body.code !== undefined && body.code !== 200) {
      await failWithRefund(String(data.failMsg ?? body.msg ?? 'Generation failed.'));
      return res.json({ received: true });
    }

    if (state === 'success') {
      let outputUrl: string | null = null;
      try {
        const parsed = JSON.parse(String(data.resultJson ?? '{}')) as {
          resultUrls?: string[];
          resultUrl?: string;
        };
        const urls = parsed.resultUrls ?? parsed.resultUrl;
        outputUrl = Array.isArray(urls) ? urls[0] ?? null : urls ?? null;
      } catch {
        outputUrl = null;
      }
      if (!outputUrl) {
        const fallback = data.videoUrl ?? data.output;
        outputUrl = Array.isArray(fallback) ? String(fallback[0]) : fallback ? String(fallback) : null;
      }

      if (outputUrl) {
        await prisma.studioGeneration.update({
          where: { id: generation.id },
          data: { status: 'SUCCEEDED', outputUrl }
        });
      } else {
        await failWithRefund('Provider reported success without an output file.');
      }
    } else if (['fail', 'failed', 'error'].includes(state)) {
      await failWithRefund(String(data.failMsg ?? data.error ?? body.msg ?? 'Generation failed.'));
    }

    return res.json({ received: true });
  })
);
