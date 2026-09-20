import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.production ? ['error'] : ['warn', 'error'] });

if (!env.production) globalForPrisma.prisma = prisma;

export type { Prisma } from '@prisma/client';
