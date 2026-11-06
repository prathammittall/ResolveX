import React from "react";
import Link from "next/link";
import { AppShell } from "../components/layout/AppShell";
import { TopographicWatermark } from "../components/layout/TopographicWatermark";
import { SeverityBadge } from "../components/ui/SeverityBadge";
import { LiveTimer } from "../components/ui/LiveTimer";
import { ResponderAvatar } from "../components/ui/ResponderAvatar";
import { UptimeTimeline24h } from "../components/ui/UptimeTimeline24h";
import { Icon } from "../components/ui/Icon";
import {
  ACTIVE_INCIDENT,
  CORE_SERVICES,
  RESPONDERS,
} from "../lib/incident-data";

export default function OverviewPage() {
  const incident = ACTIVE_INCIDENT;
  const onCallPrimary = RESPONDERS.asha!;
  const onCallSecondary = RESPONDERS.rohan!;

  return (
    <AppShell>
      <TopographicWatermark variant="radar" position="bottom-right" />

      {/* Top Status Section */}
      <header className="wr-page-header">
        <div className="wr-row wr-gap-2">
          <span
            className="wr-dot wr-dot--sev1 wr-dot--pulse"
            aria-hidden="true"
          />
          <h1 className="wr-display-title">1 active incident</h1>
        </div>
        <div className="wr-meta-mono">
          Updated just now · Alert engine active
        </div>
      </header>

      {/* Main Body: Two Columns (7 cols Focal Incident / 5 cols On-Call Roster) */}
      <section className="wr-overview-grid" aria-label="Active Incident and On-Call">
        {/* Left Column: Focal Active Incident Card */}
        <article className="wr-card wr-incident-focal-card">
          <div>
            <div className="wr-incident-card-top">
              <div className="wr-row wr-gap-2">
                <Link
                  href={`/incidents/${incident.id}`}
                  className="wr-meta-mono"
                >
                  {incident.id}
                </Link>
                <SeverityBadge variant="sev1">
                  {incident.severity}
                </SeverityBadge>
              </div>
              <SeverityBadge variant="neutral" uppercase={false}>
                {incident.service}
              </SeverityBadge>
            </div>

            <div className="wr-incident-card-body">
              <h2 className="wr-card-title">
                <Link href={`/incidents/${incident.id}`}>
                  {incident.title}
                </Link>
              </h2>
              <p className="wr-body-muted">{incident.shortSummary}</p>
            </div>
          </div>

          <div className="wr-incident-card-footer">
            <div className="wr-row wr-gap-4">
              <div className="wr-metric-pair">
                <span className="wr-meta-mono wr-row wr-gap-1">
                  <Icon name="timer" size={13} />
                  <span>Elapsed</span>
                </span>
                <LiveTimer
                  initialSeconds={incident.overviewElapsedSeconds}
                  format="compact"
                  className="wr-metric-value"
                />
              </div>

              <div className="wr-vline" aria-hidden="true" />

              <div className="wr-row wr-gap-2">
                <ResponderAvatar responder={incident.commander} size="sm" />
                <div className="wr-stack">
                  <span
                    style={{
                      fontSize: "13px",
                      lineHeight: "18px",
                      fontWeight: 500,
                      color: "var(--text-heading)",
                    }}
                  >
                    {incident.commander.name}
                  </span>
                  <span className="wr-meta-mono" style={{ fontSize: "11px" }}>
                    Commander
                  </span>
                </div>
              </div>
            </div>

            <div className="wr-row wr-gap-2">
              <Link
                href={`/incidents/${incident.id}`}
                className="wr-btn wr-btn--secondary"
              >
                <span>Summary</span>
              </Link>
              <Link
                href={`/incidents/${incident.id}/war-room`}
                className="wr-btn wr-btn--primary"
              >
                <span>Open war room</span>
                <Icon name="arrow_forward" size={15} />
              </Link>
            </div>
          </div>
        </article>

        {/* Right Column: On-Call Companion Card (Negative Space — No Nested Boxes) */}
        <aside className="wr-card wr-oncall-card" aria-label="On Call Now">
          <div>
            <div className="wr-row-between">
              <span className="wr-label-micro">On Call Now</span>
              <span
                className="wr-meta-mono wr-row wr-gap-1"
                style={{ fontSize: "11px", color: "var(--accent-sage)" }}
              >
                <span className="wr-dot wr-dot--sage" aria-hidden="true" />
                <span>Escalation active</span>
              </span>
            </div>

            <div className="wr-oncall-roster">
              <div className="wr-oncall-row">
                <div className="wr-row wr-gap-2">
                  <ResponderAvatar responder={onCallPrimary} size="md" />
                  <div className="wr-stack">
                    <span
                      style={{
                        fontSize: "14px",
                        lineHeight: "20px",
                        fontWeight: 500,
                        color: "var(--text-heading)",
                      }}
                    >
                      {onCallPrimary.name}
                    </span>
                    <span className="wr-meta-mono" style={{ fontSize: "11px" }}>
                      {onCallPrimary.team}
                    </span>
                  </div>
                </div>
                <SeverityBadge variant="cobalt" uppercase={false}>
                  Primary
                </SeverityBadge>
              </div>

              <div className="wr-oncall-row">
                <div className="wr-row wr-gap-2">
                  <ResponderAvatar responder={onCallSecondary} size="md" />
                  <div className="wr-stack">
                    <span
                      style={{
                        fontSize: "14px",
                        lineHeight: "20px",
                        fontWeight: 500,
                        color: "var(--text-heading)",
                      }}
                    >
                      {onCallSecondary.name}
                    </span>
                    <span className="wr-meta-mono" style={{ fontSize: "11px" }}>
                      {onCallSecondary.team}
                    </span>
                  </div>
                </div>
                <SeverityBadge variant="neutral" uppercase={false}>
                  Secondary
                </SeverityBadge>
              </div>
            </div>
          </div>

          <div className="wr-oncall-footer">
            <span className="wr-meta-mono">Handover in 4h 18m</span>
            <Link href="/on-call" className="wr-inline-link">
              <span>Schedule</span>
              <Icon name="north_east" size={12} />
            </Link>
          </div>
        </aside>
      </section>

      {/* Bottom Section: 24h Service Health Timeline */}
      <UptimeTimeline24h services={CORE_SERVICES} />
    </AppShell>
  );
}
