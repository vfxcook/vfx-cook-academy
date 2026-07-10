import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_BUCKET = "uploads";
let bucketReady = false;

async function ensureSupabaseBucket() {
  if (bucketReady) return;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const bucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    headers,
    cache: "no-store",
  });
  if (!bucketRes.ok) {
    const reason = await bucketRes.text();
    throw new Error(`Failed to query Supabase buckets (${bucketRes.status}): ${reason}`);
  }
  const buckets = (await bucketRes.json()) as Array<{ id?: string; name?: string }>;
  const hasBucket = buckets.some((bucket) => bucket.id === UPLOAD_BUCKET || bucket.name === UPLOAD_BUCKET);
  if (hasBucket) {
    bucketReady = true;
    return;
  }

  const createRes = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: UPLOAD_BUCKET,
      name: UPLOAD_BUCKET,
      public: true,
    }),
  });
  if (!createRes.ok) {
    const reason = await createRes.text();
    throw new Error(`Failed to create Supabase uploads bucket (${createRes.status}): ${reason}`);
  }
  bucketReady = true;
}

export async function saveUploadFile(
  file: File,
  folder: "thumbnails" | "profiles" | "videos" | "resources" | "community" | "prompts",
) {
  const ext = path.extname(file.name) || "";
  const fileName = `${Date.now()}-${randomUUID()}${ext.toLowerCase()}`;
  const objectPath = `${folder}/${fileName}`;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    await ensureSupabaseBucket();
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${UPLOAD_BUCKET}/${objectPath}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "x-upsert": "true",
        "Content-Type": file.type || "application/octet-stream",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!uploadRes.ok) {
      const reason = await uploadRes.text();
      throw new Error(`Supabase file upload failed (${uploadRes.status}): ${reason}`);
    }
    return `${supabaseUrl}/storage/v1/object/public/${UPLOAD_BUCKET}/${objectPath}`;
  }

  const targetDir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${folder}/${fileName}`;
}
