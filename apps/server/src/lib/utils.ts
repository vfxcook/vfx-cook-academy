import crypto from 'node:crypto';

/** Ambiguous glyphs (0/O, 1/I/L) are left out so codes survive being read aloud. */
const LICENSE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeLicenseCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += LICENSE_ALPHABET[bytes[i] % LICENSE_ALPHABET.length];
  }
  return code;
}

export function makeGiftCode() {
  const block = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `GIFT-${block()}${block()}-${block()}`;
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function parseDateInput(raw: unknown): Date | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
