import React from "react";
import { AppShell } from "../../components/layout/AppShell";
import { TopographicWatermark } from "../../components/layout/TopographicWatermark";
import { ResponderAvatar } from "../../components/ui/ResponderAvatar";
import { SeverityBadge } from "../../components/ui/SeverityBadge";
import { RESPONDERS } from "../../lib/incident-data";

export default function OnCallPage() {
  const roster = [RESPONDERS.asha!, RESPONDERS.rohan!, RESPONDERS.elena!];

  return (
    <AppShell>
      <TopographicWatermark variant="contour" position="bottom-right" />

      <header className="wr-page-header">
        <h1 className="wr-display-title">On-Call Roster</h1>
        <div className="wr-meta-mono">
          Rotation window: 08:00 UTC – 20:00 UTC · Handover in 4h 18m
        </div>
      </header>

      <section
        className="wr-card"
        style={{ padding: "var(--space-4)", maxWidth: "720px" }}
        aria-label="Active On-Call Engineers"
      >
        <div className="wr-row-between" style={{ marginBottom: "var(--space-2)" }}>
          <span className="wr-label-micro">Active Shift Engineers</span>
          <SeverityBadge variant="green" showDot uppercase={false}>
            Escalation Policy Active
          </SeverityBadge>
        </div>

        <div className="wr-oncall-roster">
          {roster.map((person, idx) => (
            <div key={person.id} className="wr-oncall-row">
              <div className="wr-row wr-gap-3">
                <ResponderAvatar responder={person} size="md" />
                <div className="wr-stack">
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "var(--text-heading)",
                    }}
                  >
                    {person.name}
                  </span>
                  <span className="wr-meta-mono">
                    {person.role} · {person.team}
                  </span>
                </div>
              </div>

              <SeverityBadge
                variant={idx === 0 ? "cobalt" : "neutral"}
                uppercase={false}
              >
                {person.onCallTier || "Escalation Shadow"}
              </SeverityBadge>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
