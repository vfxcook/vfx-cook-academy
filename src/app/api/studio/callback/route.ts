import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refundStudioCredits } from "@/lib/studio-credits";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const generationId = url.searchParams.get("id");
    
    if (!generationId) {
      console.error("[studio-callback] Missing generation id in query");
      return NextResponse.json({ received: true });
    }

    const body = await req.json();
    const data = body.data ?? body;
    const state = String(data.state ?? data.status ?? "").toLowerCase();

    console.log(`[studio-callback] generationId: ${generationId}, state: ${state}`);

    const generation = await prisma.studioGeneration.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      console.error(`[studio-callback] Generation not found: ${generationId}`);
      return NextResponse.json({ received: true });
    }
    
    // Prevent double refunds / double processing
    if (generation.status === "SUCCEEDED" || generation.status === "FAILED" || generation.status === "REFUNDED") {
      console.log(`[studio-callback] Generation ${generationId} already processed (status: ${generation.status})`);
      return NextResponse.json({ received: true });
    }

    if (body.code !== undefined && body.code !== 200) {
      const errorMsg = data.failMsg ?? body.msg ?? "Generation failed";
      await prisma.$transaction(async (tx) => {
        await refundStudioCredits({
          prisma: tx,
          userId: generation.userId,
          credits: generation.creditsCharged,
          referenceId: generation.id,
          note: "Callback reported error, auto-refunded",
        });
        await tx.studioGeneration.update({
          where: { id: generation.id },
          data: { status: "REFUNDED", errorMessage: errorMsg },
        });
      });
      return NextResponse.json({ received: true });
    }

    if (state === "success") {
      let outputUrl = null;
      try {
        const parsed = JSON.parse(data.resultJson || "{}");
        const urls = parsed.resultUrls ?? parsed.resultUrl;
        if (Array.isArray(urls) && urls.length > 0) outputUrl = urls[0];
        else if (urls) outputUrl = urls;
      } catch {
        // Fallback
      }

      if (!outputUrl) {
        outputUrl = data.videoUrl ?? (data.output?.[0] ?? data.output);
      }

      if (outputUrl) {
        await prisma.studioGeneration.update({
          where: { id: generation.id },
          data: { status: "SUCCEEDED", outputUrl },
        });
      } else {
        console.error(`[studio-callback] Success but no outputUrl found for ${generationId}`);
      }
    } else if (state === "fail" || state === "failed" || state === "error") {
      const errorMsg = data.failMsg ?? data.error ?? body.msg ?? "Generation failed";
      await prisma.$transaction(async (tx) => {
        await refundStudioCredits({
          prisma: tx,
          userId: generation.userId,
          credits: generation.creditsCharged,
          referenceId: generation.id,
          note: "Callback reported error, auto-refunded",
        });
        await tx.studioGeneration.update({
          where: { id: generation.id },
          data: { status: "REFUNDED", errorMessage: errorMsg },
        });
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[studio-callback] unhandled error", error);
    return NextResponse.json({ received: true }); // Return 200 to prevent retries
  }
}
