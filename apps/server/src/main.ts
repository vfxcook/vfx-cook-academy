import { createApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

// No host argument: bind every interface, which is what Render's port detection needs.
const server = app.listen(env.port, () => {
  console.log(`[academy] API listening on port ${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal: string) {
  console.log(`[academy] ${signal} received, closing.`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export { app };
