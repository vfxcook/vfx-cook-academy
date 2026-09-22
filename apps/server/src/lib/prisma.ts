import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.production ? ['error'] : ['warn', 'error'] });

if (!env.production) globalForPrisma.prisma = prisma;

/**
 * Why the database is unreachable, as a short code safe to return on a public URL.
 * Prisma's own codes already say enough — P1000 credentials, P1001 host unreachable,
 * P1003 no such database — and the cases it reports without one are all about the
 * connection string itself. The message, which carries the host, stays in the logs.
 */
export function databaseFailureCode(error: unknown): string {
  const code = (error as { errorCode?: string; code?: string })?.errorCode ?? (error as { code?: string })?.code;
  if (typeof code === 'string' && code) return code;

  // Prisma 6 raises these as PrismaClientInitializationError with no code of its own,
  // so the message is all there is to go on. Only the verdict leaves this function.
  const message = error instanceof Error ? error.message : String(error);
  if (/environment variable not found/i.test(message)) return 'ENV_MISSING';
  if (/must start with the protocol|invalid connection string|invalid port/i.test(message)) {
    return 'URL_MALFORMED';
  }
  if (/authentication failed/i.test(message)) return 'P1000';
  if (/can't reach database server|connection refused|timed out/i.test(message)) return 'P1001';
  if (/database .* does not exist/i.test(message)) return 'P1003';
  return 'UNKNOWN';
}

export type { Prisma } from '@prisma/client';
