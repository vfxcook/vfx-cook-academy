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

export const DEFAULT_GOOGLE_CLIENT_ID =
  '706720560213-1f3dmo50amk180u2a7o6qcuqh2hm435i.apps.googleusercontent.com';
export const DEFAULT_SUPABASE_URL = 'https://frnlloffzfnohagpwsti.supabase.co';

loadDotEnv(resolve(process.cwd(), '.env'));
loadDotEnv(resolve(process.cwd(), '..', '..', '.env'));

const str = (key: string, fallback = '') => process.env[key]?.trim() || fallback;
const list = (key: string) =>
  str(key)
    .split(',')
    .map(value => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
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

  sessionDays: num('SESSION_DAYS', 30),

  adminEmail: str('ADMIN_EMAIL').toLowerCase(),

  /**
   * Google Identity Services. The browser gets an ID token and the server verifies it,
   * so only client IDs are needed — no secret. Defaults to the BrahmAstra Studio client so
   * one Google consent covers every brahmastra.studio product.
   */
  google: {
    clientIds: list('GOOGLE_CLIENT_ID').length ? list('GOOGLE_CLIENT_ID') : [DEFAULT_GOOGLE_CLIENT_ID],
    get enabled() {
      return this.clientIds.length > 0;
    }
  },

  smtp: {
    host: str('SMTP_HOST'),
    port: num('SMTP_PORT', 587),
    user: str('SMTP_USER'),
    pass: str('SMTP_PASS'),
    from: str('EMAIL_FROM', 'BrahmAstra Academy <noreply@brahmastra.studio>'),
    get enabled() {
      return Boolean(this.host && this.user && this.pass);
    }
  },

  supabase: {
    url: str('SUPABASE_URL', DEFAULT_SUPABASE_URL).replace(/\/+$/, ''),
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
    callbackBaseUrl: str('CALLBACK_BASE_URL'),
    callbackSecret: str('STUDIO_CALLBACK_SECRET')
  },

  /*
   * Multi-domain auth. COOKIE_DOMAIN (e.g. `.brahmastra.studio`) shares the session across
   * subdomains; ALLOWED_ORIGINS lists the frontends that may call this API with credentials
   * (`https://*.brahmastra.studio` style wildcards allowed); PROXY_SHARED_SECRET marks
   * requests forwarded by our Cloudflare Worker so their client IP can be trusted.
   */
  cookieDomain: str('COOKIE_DOMAIN'),
  allowedOrigins: list('ALLOWED_ORIGINS'),
  proxySecret: str('PROXY_SHARED_SECRET'),

  qrCodeUrl: str('QR_CODE_URL', str('NEXT_PUBLIC_QR_CODE_URL')),
  uploadsDir: str('UPLOADS_DIR', resolve(process.cwd(), 'uploads'))
};
