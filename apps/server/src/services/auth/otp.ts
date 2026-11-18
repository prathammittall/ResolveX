import { randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getAccessSecret } from './model.js';

export interface OtpRecord {
  code: string;
  userId: number;
  email: string;
  attempts: number;
  expiresAt: number;
  lastSentAt: number;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

const otpStore = new Map<string, OtpRecord>();

// Periodic cleanup of expired OTP records every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Prevent cleanup interval from holding Node.js process alive in tests
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Generate a cryptographically random 6-digit numeric OTP string.
 */
export function generateOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Save an OTP code for a user email.
 */
export function storeOtp(email: string, data: { code: string; userId: number }): OtpRecord {
  const normalized = email.trim().toLowerCase();
  const record: OtpRecord = {
    code: data.code,
    userId: data.userId,
    email: normalized,
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_MS,
    lastSentAt: Date.now(),
  };
  otpStore.set(normalized, record);
  return record;
}

/**
 * Retrieve the active OTP record for an email.
 * Returns null if missing or expired.
 */
export function getOtp(email: string): OtpRecord | null {
  const normalized = email.trim().toLowerCase();
  const record = otpStore.get(normalized);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return null;
  }
  return record;
}

/**
 * Check if a resend request is allowed according to the cooldown window.
 */
export function canResendOtp(email: string): { allowed: boolean; waitSeconds: number } {
  const normalized = email.trim().toLowerCase();
  const record = otpStore.get(normalized);
  if (!record) return { allowed: true, waitSeconds: 0 };

  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true, waitSeconds: 0 };
}

/**
 * Increment failed verification attempts.
 */
export function incrementOtpAttempts(email: string): number {
  const normalized = email.trim().toLowerCase();
  const record = otpStore.get(normalized);
  if (!record) return 0;
  record.attempts += 1;
  return record.attempts;
}

/**
 * Remove an OTP record (e.g. after successful verification or exceeding attempts).
 */
export function deleteOtp(email: string): void {
  const normalized = email.trim().toLowerCase();
  otpStore.delete(normalized);
}

/**
 * Sign an OTP challenge token (valid for 10 minutes) so only clients that passed
 * password validation can verify or resend an OTP for this user.
 */
export function signOtpToken(
  payload: { userId: number; email: string },
  secret = getAccessSecret(),
): string {
  return jwt.sign(
    { userId: payload.userId, email: payload.email.toLowerCase(), purpose: 'login_otp' },
    secret,
    { expiresIn: '10m' },
  );
}

/**
 * Verify an OTP challenge token.
 */
export function verifyOtpToken(
  token: string,
  secret = getAccessSecret(),
): { userId: number; email: string } {
  const decoded = jwt.verify(token, secret) as { userId: number; email: string; purpose?: string };
  if (decoded.purpose !== 'login_otp' || !decoded.userId || !decoded.email) {
    throw new jwt.JsonWebTokenError('Invalid OTP challenge token');
  }
  return { userId: decoded.userId, email: decoded.email };
}

export { MAX_OTP_ATTEMPTS, OTP_TTL_MS, RESEND_COOLDOWN_MS };
