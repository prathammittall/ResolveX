import { describe, expect, it } from 'vitest';
import {
  generateOtpCode,
  storeOtp,
  getOtp,
  deleteOtp,
  canResendOtp,
  incrementOtpAttempts,
  signOtpToken,
  verifyOtpToken,
  MAX_OTP_ATTEMPTS,
} from './otp.js';
import { sendOtpEmail, isSmtpConfigured } from '../mailer.js';

describe('OTP & Mailer Service', () => {
  const testEmail = 'otp_tester@example.com';
  const testSecret = 'test-secret-at-least-32-chars-long-for-jwt-signing!!';

  describe('OTP Generation & Store', () => {
    it('generates a valid 6-digit numeric OTP', () => {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('stores and retrieves an OTP for an email', () => {
      const code = '123456';
      storeOtp(testEmail, { code, userId: 101 });

      const record = getOtp(testEmail);
      expect(record).not.toBeNull();
      expect(record?.code).toBe(code);
      expect(record?.userId).toBe(101);
      expect(record?.attempts).toBe(0);
      expect(record?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('increments attempts accurately up to MAX_OTP_ATTEMPTS', () => {
      storeOtp(testEmail, { code: '654321', userId: 101 });

      const a1 = incrementOtpAttempts(testEmail);
      expect(a1).toBe(1);

      const a2 = incrementOtpAttempts(testEmail);
      expect(a2).toBe(2);

      const record = getOtp(testEmail);
      expect(record?.attempts).toBe(2);
    });

    it('enforces resend cooldown', () => {
      storeOtp(testEmail, { code: '999888', userId: 101 });

      const cooldown = canResendOtp(testEmail);
      expect(cooldown.allowed).toBe(false);
      expect(cooldown.waitSeconds).toBeGreaterThan(0);
      expect(cooldown.waitSeconds).toBeLessThanOrEqual(30);
    });

    it('deletes an OTP record', () => {
      storeOtp(testEmail, { code: '555444', userId: 101 });
      deleteOtp(testEmail);

      const record = getOtp(testEmail);
      expect(record).toBeNull();
    });
  });

  describe('Signed OTP Challenge Tokens', () => {
    it('signs and verifies OTP challenge tokens', () => {
      const token = signOtpToken({ userId: 202, email: testEmail }, testSecret);
      expect(typeof token).toBe('string');

      const verified = verifyOtpToken(token, testSecret);
      expect(verified.userId).toBe(202);
      expect(verified.email).toBe(testEmail.toLowerCase());
    });

    it('rejects invalid or tampered tokens', () => {
      const token = signOtpToken({ userId: 202, email: testEmail }, testSecret);
      expect(() => verifyOtpToken(token + 'tampered', testSecret)).toThrow();
    });
  });

  describe('Nodemailer OTP Dispatcher', () => {
    it('handles email dispatch safely', async () => {
      const result = await sendOtpEmail({
        to: testEmail,
        otp: '482019',
        name: 'Alex Tester',
      });

      expect(result.success).toBe(true);
    });

    it('creates and sends mail through nodemailer JSON transport', async () => {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        jsonTransport: true,
      });

      const info = await transport.sendMail({
        from: 'ResolveX <noreply@resolvex.ai>',
        to: testEmail,
        subject: '123456 is your ResolveX verification code',
        text: 'Your code is 123456',
      });

      expect(info.messageId).toBeDefined();
      const message = JSON.parse(info.message);
      expect(message.to[0].address).toBe(testEmail);
      expect(message.subject).toContain('123456');
    });
  });
});
