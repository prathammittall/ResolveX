import React from "react";
import { AppShell } from "../../components/layout/AppShell";
import { TopographicWatermark } from "../../components/layout/TopographicWatermark";
import { SeverityBadge } from "../../components/ui/SeverityBadge";

export default function SettingsPage() {
  return (
    <AppShell>
      <TopographicWatermark variant="contour" position="bottom-right" />

      <header className="wr-page-header">
        <h1 className="wr-display-title">Workspace Settings</h1>
        <div className="wr-meta-mono">
          Alert webhook ingestion · SOC2 compliance audit policy
        </div>
      </header>

      <section
        className="wr-card wr-stack wr-gap-3"
        style={{ padding: "var(--space-4)", maxWidth: "720px" }}
        aria-label="Webhook and Compliance Configuration"
      >
        <div className="wr-row-between">
          <div className="wr-stack wr-gap-1">
            <span className="wr-label-micro">Inbound Alert Webhook</span>
            <code className="wr-inline-code">
              POST /api/webhooks/alerts
            </code>
          </div>
          <SeverityBadge variant="green" showDot uppercase={false}>
            Active
          </SeverityBadge>
        </div>

        <div className="wr-hairline" />

        <div className="wr-row-between">
          <div className="wr-stack wr-gap-1">
            <span className="wr-label-micro">Compliance Audit Mode</span>
            <span className="wr-body-copy">
              Immutable timeline logging and HMAC-SHA256 webhook signature verification
            </span>
          </div>
          <SeverityBadge variant="cobalt" uppercase={false}>
            SOC2 Enforced
          </SeverityBadge>
        </div>
      </section>
    </AppShell>
  );
}
