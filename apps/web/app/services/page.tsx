import React from "react";
import { AppShell } from "../../components/layout/AppShell";
import { TopographicWatermark } from "../../components/layout/TopographicWatermark";
import { UptimeTimeline24h } from "../../components/ui/UptimeTimeline24h";
import { CORE_SERVICES } from "../../lib/incident-data";

export default function ServicesPage() {
  return (
    <AppShell>
      <TopographicWatermark variant="radar" position="bottom-right" />

      <header className="wr-page-header">
        <h1 className="wr-display-title">Monitored Services</h1>
        <div className="wr-meta-mono">
          4 production services · 1 active degradation (Payments API)
        </div>
      </header>

      <UptimeTimeline24h services={CORE_SERVICES} />
    </AppShell>
  );
}
