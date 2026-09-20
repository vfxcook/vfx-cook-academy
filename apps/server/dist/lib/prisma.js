import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({ log: env.production ? ['error'] : ['warn', 'error'] });
if (!env.production)
    globalForPrisma.prisma = prisma;
//# sourceMappingURL=prisma.js.map