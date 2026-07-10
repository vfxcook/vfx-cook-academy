import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const comment = await prisma.timestampComment.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const canDelete = comment.userId === session.user.id || session.user.role === "ADMIN";
  if (!canDelete) {
    return NextResponse.json({ error: "You can delete only your own comment." }, { status: 403 });
  }

  await prisma.timestampComment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
