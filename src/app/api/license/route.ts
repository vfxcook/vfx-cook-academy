import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const activateSchema = z.object({
  courseId: z.string().min(1),
  licenseCode: z.string().min(4).max(20),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = activateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { courseId, licenseCode } = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId,
      },
    },
  });

  if (!enrollment?.licenseCode) {
    return NextResponse.json({ error: "License not generated yet." }, { status: 400 });
  }

  if (enrollment.licenseExpiresAt && enrollment.licenseExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "License code expired. Contact support." },
      { status: 400 },
    );
  }

  if (enrollment.licenseCode !== licenseCode.trim().toUpperCase()) {
    return NextResponse.json({ error: "Incorrect license code." }, { status: 400 });
  }

  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      isActive: true,
      activatedAt: new Date(),
      licenseCode: null,
      licenseExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
