import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const workflowSchema = z.object({
  workflowId: z.string().optional(),
  title: z.string().min(2).max(120),
  canvasJson: z.unknown(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workflows = await prisma.studioWorkflow.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });
  return NextResponse.json({ workflows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = workflowSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workflow", details: parsed.error.flatten() }, { status: 400 });
  }
  const { workflowId, title } = parsed.data;
  const canvasJson = parsed.data.canvasJson as Prisma.InputJsonValue;
  if (workflowId) {
    const existing = await prisma.studioWorkflow.findUnique({
      where: { id: workflowId },
      select: { userId: true },
    });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }
  }
  const workflow = workflowId
    ? await prisma.studioWorkflow.update({
        where: { id: workflowId },
        data: { title, canvasJson },
      })
    : await prisma.studioWorkflow.create({
        data: { userId: session.user.id, title, canvasJson },
      });

  return NextResponse.json({ workflow });
}
