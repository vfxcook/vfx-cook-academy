import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv(resolve(process.cwd(), '.env'));
loadDotEnv(resolve(process.cwd(), '..', '..', '.env'));

const str = (key: string, fallback = '') => process.env[key]?.trim() || fallback;
const num = (key: string, fallback: number) => {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  get production() {
    return this.nodeEnv === 'production';
  },
  port: num('PORT', 8080),
  appUrl: str('APP_URL', str('NEXTAUTH_URL', 'http://localhost:5173')),
  webDist: str('WEB_DIST', ''),

  sessionSecret: str('SESSION_SECRET', str('NEXTAUTH_SECRET', '')),
  sessionDays: num('SESSION_DAYS', 30),

  adminEmail: str('ADMIN_EMAIL').toLowerCase(),
  adminPassword: str('ADMIN_PASSWORD'),

  google: {
    clientId: str('GOOGLE_CLIENT_ID'),
    clientSecret: str('GOOGLE_CLIENT_SECRET'),
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    }
  },

  smtp: {
    host: str('SMTP_HOST'),
    port: num('SMTP_PORT', 587),
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS'),
    from: str('EMAIL_FROM', 'VFX Cook Academy <noreply@vfxcook.com>'),
    get enabled() {
      return Boolean(this.host && this.user && this.pass);
    }
  },

  supabase: {
    url: str('SUPABASE_URL'),
    serviceRoleKey: str('SUPABASE_SERVICE_ROLE_KEY'),
    get enabled() {
      return Boolean(this.url && this.serviceRoleKey);
    }
  },

  razorpay: {
    keyId: str('RAZORPAY_KEY_ID'),
    keySecret: str('RAZORPAY_KEY_SECRET'),
    webhookSecret: str('RAZORPAY_WEBHOOK_SECRET'),
    get enabled() {
      return Boolean(this.keyId && this.keySecret);
    }
  },

  studio: {
    kieApiKey: str('KIE_API_KEY'),
    callbackBaseUrl: str('CALLBACK_BASE_URL')
  },

  qrCodeUrl: str('QR_CODE_URL', str('NEXT_PUBLIC_QR_CODE_URL')),
  uploadsDir: str('UPLOADS_DIR', resolve(process.cwd(), 'uploads')),
  allowedWriteOrigins: str('ALLOWED_WRITE_ORIGINS')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
};

if (env.production && !env.sessionSecret) {
  throw new Error('SESSION_SECRET is required in production.');
}
