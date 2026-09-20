import { createApp } from './app.js';
import { env } from './lib/env.js';
import { prisma } from './lib/prisma.js';
const app = createApp();
const server = app.listen(env.port, () => {
    console.log(`[academy] API listening on http://127.0.0.1:${env.port} (${env.nodeEnv})`);
});
async function shutdown(signal) {
    console.log(`[academy] ${signal} received, closing.`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
export { app };
//# sourceMappingURL=main.js.map