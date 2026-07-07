import { auth } from "@/lib/auth";

export async function isAdminSession() {
  const session = await auth();
  return Boolean(session?.user?.id && session.user.role === "ADMIN");
}
