import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Symmetric encryption for secrets we must be able to read back (monitor auth headers, GitHub tokens,
 * webhook signing secrets). AES-256-GCM with a random 96-bit IV; output is `v1:<iv>:<tag>:<ciphertext>` (base64url).
 *
 * The key comes from SECRETS_ENCRYPTION_KEY. Without it we derive one from JWT_REFRESH_SECRET so development
 * works, but production deployments should set a dedicated key (rotating JWT secrets would otherwise make
 * stored secrets unreadable).
 */
function key(): Buffer {
  const configured = process.env.SECRETS_ENCRYPTION_KEY;
  if (configured && configured.length >= 32) return createHash('sha256').update(configured).digest();
  const fallback = process.env.JWT_REFRESH_SECRET;
  if (!fallback) throw new Error('SECRETS_ENCRYPTION_KEY (or JWT_REFRESH_SECRET) must be configured');
  return createHash('sha256').update(`resolvex-secrets:${fallback}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, ct] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Unsupported secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export function randomToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`;
}

export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** Constant-time comparison of two hex/ascii strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
