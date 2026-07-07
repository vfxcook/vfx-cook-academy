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

  const bucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket/${UPLOAD_BUCKET}`, {
    headers,
    cache: "no-store",
  });
  if (bucketRes.ok) {
    bucketReady = true;
    return;
  }
  if (bucketRes.status !== 404) {
    throw new Error("Failed to verify Supabase uploads bucket.");
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
    throw new Error("Failed to create Supabase uploads bucket.");
  }
  bucketReady = true;
}

export async function saveUploadFile(file: File, folder: "thumbnails" | "profiles" | "videos" | "resources") {
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
      throw new Error("Supabase file upload failed.");
    }
    return `${supabaseUrl}/storage/v1/object/public/${UPLOAD_BUCKET}/${objectPath}`;
  }

  const targetDir = path.join(process.cwd(), "public", "uploads", folder);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, fileName), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${folder}/${fileName}`;
}
