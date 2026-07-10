import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const markReadSchema = z.object({
  notificationId: z.string().min(1).optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actorUser: {
          select: { name: true, email: true, image: true },
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        isRead: false,
      },
    }),
  ]);

  return NextResponse.json({ items, unreadCount });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = markReadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.markAll) {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.notificationId) {
    return NextResponse.json({ error: "notificationId is required." }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: {
      id: parsed.data.notificationId,
      userId: session.user.id,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
