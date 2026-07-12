import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spendStudioCredits, refundStudioCredits } from "@/lib/studio-credits";

const generateSchema = z.object({
  workflowId: z.string().optional(),
  providerModelId: z.string().min(1),
  prompt: z.string().min(3).max(5000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = generateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { workflowId, providerModelId, prompt } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const model = await tx.studioModelPricing.findUnique({ where: { providerModelId } });
    if (!model || !model.isEnabled) {
      throw new Error("MODEL_NOT_AVAILABLE");
    }
    if (workflowId) {
      const workflow = await tx.studioWorkflow.findUnique({ where: { id: workflowId } });
      if (!workflow || workflow.userId !== session.user.id) {
        throw new Error("WORKFLOW_NOT_FOUND");
      }
    }
    const generation = await tx.studioGeneration.create({
      data: {
        userId: session.user.id,
        workflowId,
        modelPricingId: model.id,
        prompt,
        creditsCharged: model.providerCredits,
        status: "QUEUED",
      },
      include: { modelPricing: true },
    });
    const balance = await spendStudioCredits({
      prisma: tx,
      userId: session.user.id,
      credits: model.providerCredits,
      referenceId: generation.id,
      note: `${model.displayName} generation queued`,
    });
    return { generation, balance };
  });

  try {
    const KIE_BASE = "https://api.kie.ai";
    // @ts-ignore
    const keySetting = await prisma.appSetting.findUnique({ where: { key: "KIE_API_KEY" } });
    const apiKey = keySetting?.value || process.env.KIE_API_KEY;
    if (!apiKey) throw new Error("KIE_API_KEY missing");

    const callbackBaseUrl = process.env.CALLBACK_BASE_URL || (request.headers.get("origin") ?? "http://localhost:3000");
    const callBackUrl = `${callbackBaseUrl.replace(/\/$/, "")}/api/studio/callback?id=${result.generation.id}`;

    let endpoint = `${KIE_BASE}/api/v1/jobs/createTask`;
    let body: any = {
      model: providerModelId,
      callBackUrl,
      input: {
        prompt,
      },
    };

    if (providerModelId.startsWith("veo3")) {
      endpoint = `${KIE_BASE}/api/v1/veo/generate`;
      body = {
        model: providerModelId,
        prompt,
        generationType: "TEXT_2_VIDEO",
        aspect_ratio: "16:9",
        resolution: "720p",
        imageUrls: [],
        watermark: "",
        enableFallback: false,
        enableTranslation: true,
        callBackUrl,
      };
    } else if (providerModelId.includes("nano-banana")) {
      body.input.image_size = "16:9";
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(await res.text());
    const kieRes = await res.json();
    if (kieRes.code !== undefined && kieRes.code !== 200) {
      throw new Error(kieRes.msg ?? "Task creation failed");
    }

    await prisma.studioGeneration.update({
      where: { id: result.generation.id },
      data: { status: "RUNNING" }
    });

  } catch (err) {
    await prisma.$transaction(async (tx) => {
      await refundStudioCredits({
        prisma: tx,
        userId: session.user.id,
        credits: result.generation.creditsCharged,
        referenceId: result.generation.id,
        note: "Provider generation failed, auto-refunded",
      });
      await tx.studioGeneration.update({
        where: { id: result.generation.id },
        data: { status: "FAILED", errorMessage: String(err) },
      });
    });
    return NextResponse.json({ error: "Provider failed to queue job", details: String(err) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    balance: result.balance,
    generation: result.generation,
    message: "Generation queued. Provider execution will run through the secured studio backend.",
  });
}
