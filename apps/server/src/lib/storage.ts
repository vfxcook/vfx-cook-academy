import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';
import { badRequest } from './http.js';

const BUCKET = 'uploads';
let bucketReady = false;

export type UploadFolder =
  | 'thumbnails'
  | 'profiles'
  | 'videos'
  | 'resources'
  | 'community'
  | 'prompts';

export type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const IMAGE_LIMIT = 5 * 1024 * 1024;
const COMMUNITY_IMAGE_LIMIT = 6 * 1024 * 1024;

export function assertImage(file: UploadedFile, limit = IMAGE_LIMIT, label = 'Image') {
  if (!file.mimetype.startsWith('image/')) throw badRequest(`${label} must be an image file.`);
  if (file.size > limit) {
    throw badRequest(`${label} is too large. Please use a file under ${Math.round(limit / 1024 / 1024)}MB.`);
  }
}

export function assertVideo(file: UploadedFile) {
  if (!file.mimetype.startsWith('video/')) throw badRequest('Only video files are allowed here.');
}

export const COMMUNITY_IMAGE_BYTES = COMMUNITY_IMAGE_LIMIT;

async function ensureBucket() {
  if (bucketReady) return;
  const headers = {
    apikey: env.supabase.serviceRoleKey,
    Authorization: `Bearer ${env.supabase.serviceRoleKey}`
  };

  const list = await fetch(`${env.supabase.url}/storage/v1/bucket`, { headers });
  if (!list.ok) {
    throw new Error(`Failed to query Supabase buckets (${list.status}): ${await list.text()}`);
  }
  const buckets = (await list.json()) as Array<{ id?: string; name?: string }>;
  if (buckets.some(b => b.id === BUCKET || b.name === BUCKET)) {
    bucketReady = true;
    return;
  }

  const created = await fetch(`${env.supabase.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
  });
  if (!created.ok) {
    throw new Error(`Failed to create Supabase uploads bucket (${created.status}): ${await created.text()}`);
  }
  bucketReady = true;
}

/** Stores to Supabase when configured, otherwise to the local uploads directory. */
export async function saveUpload(file: UploadedFile, folder: UploadFolder): Promise<string> {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const fileName = `${Date.now()}-${randomUUID()}${ext}`;
  const objectPath = `${folder}/${fileName}`;

  if (env.supabase.enabled) {
    await ensureBucket();
    const uploaded = await fetch(`${env.supabase.url}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: env.supabase.serviceRoleKey,
        Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
        'x-upsert': 'true',
        'Content-Type': file.mimetype || 'application/octet-stream'
      },
      body: new Uint8Array(file.buffer)
    });
    if (!uploaded.ok) {
      throw new Error(`Supabase upload failed (${uploaded.status}): ${await uploaded.text()}`);
    }
    return `${env.supabase.url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  }

  const targetDir = path.join(env.uploadsDir, folder);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, fileName), file.buffer);
  return `/uploads/${folder}/${fileName}`;
}
