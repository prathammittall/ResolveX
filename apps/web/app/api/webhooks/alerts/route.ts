import {
  isAlertProcessingError,
  processAlertWebhook,
  type AlertErrorBody,
} from 'server/incident-engine';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/alerts
 *
 * Auth (v1 shared-secret boundary until per-tenant secrets exist):
 * - Authorization: Bearer <ALERT_WEBHOOK_SECRET>
 * - or X-Webhook-Signature: sha256=<hmac-sha256-hex of raw body>
 *
 * Never send companyId in the body; ownership comes from Service.companyId.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  try {
    const result = await processAlertWebhook({
      rawBody,
      headers: {
        authorization: request.headers.get('authorization'),
        signature: request.headers.get('x-webhook-signature'),
      },
    });

    const status = result.duplicate ? 200 : 201;
    return NextResponse.json(result, { status });
  } catch (error) {
    if (isAlertProcessingError(error)) {
      const body: AlertErrorBody = {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
      return NextResponse.json(body, { status: error.status });
    }

    console.error('[webhooks/alerts] unexpected error', {
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : 'unknown',
    });

    const body: AlertErrorBody = {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'Failed to process alert',
      },
    };
    return NextResponse.json(body, { status: 500 });
  }
}
