import { afterEach, describe, expect, it } from "vitest";
import { sendNotification, type NotificationRequest } from "./notifications.js";

const request: NotificationRequest = {
  channel: "in_app",
  targetType: "team",
  targetId: "primary-on-call",
  incidentId: 10,
  severity: "sev1",
  title: "Checkout outage",
  description: "Payment requests are failing",
  step: 0,
};

const originalEmailEndpoint = process.env.NOTIFICATION_EMAIL_WEBHOOK_URL;
const originalSmtpHost = process.env.SMTP_HOST;
const originalSmtpFrom = process.env.SMTP_FROM;
const originalMailFrom = process.env.MAIL_FROM;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalEmailEndpoint === undefined)
    delete process.env.NOTIFICATION_EMAIL_WEBHOOK_URL;
  else process.env.NOTIFICATION_EMAIL_WEBHOOK_URL = originalEmailEndpoint;
  if (originalSmtpHost === undefined) delete process.env.SMTP_HOST;
  else process.env.SMTP_HOST = originalSmtpHost;
  if (originalSmtpFrom === undefined) delete process.env.SMTP_FROM;
  else process.env.SMTP_FROM = originalSmtpFrom;
  if (originalMailFrom === undefined) delete process.env.MAIL_FROM;
  else process.env.MAIL_FROM = originalMailFrom;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("sendNotification", () => {
  it("delivers in-app notifications without external configuration", async () => {
    await expect(sendNotification(request)).resolves.toEqual({
      delivered: true,
    });
  });

  it("reports missing email adapter configuration", async () => {
    delete process.env.NOTIFICATION_EMAIL_WEBHOOK_URL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    delete process.env.MAIL_FROM;
    await expect(
      sendNotification({ ...request, channel: "email" }),
    ).resolves.toEqual({
      delivered: false,
      error: "SMTP email is not configured",
    });
  });

  it("rejects invalid webhook targets", async () => {
    await expect(
      sendNotification({
        ...request,
        channel: "webhook",
        targetId: "file:///secret",
      }),
    ).resolves.toEqual({
      delivered: false,
      error: "Webhook notification endpoint must use HTTP or HTTPS",
    });
  });
});
