// Vercel entry: the whole Express API as one serverless function. Every /api/* request
// is rewritten here (see vercel.json) and keeps its original path, so routing is unchanged.
import { createApp } from '../apps/server/dist/app.js';

export default createApp();
