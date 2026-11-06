import React from "react";
import type { MonitoredService } from "../../lib/incident-data";
import { SeverityBadge } from "./SeverityBadge";

interface UptimeTimeline24hProps {
  services: MonitoredService[];
  fleetAvailability?: string;
}

export function UptimeTimeline24h({
  services,
  fleetAvailability = "99.85% total fleet availability",
}: UptimeTimeline24hProps) {
  return (
    <section className="wr-uptime-section" aria-label="Service Health 24h Timeline">
      <div className="wr-uptime-header">
        <div className="wr-row wr-gap-3">
          <span className="wr-label-micro">Service Health · 24h Timeline</span>
          <span className="wr-divider-dot" aria-hidden="true" />
          <span className="wr-meta-mono">{fleetAvailability}</span>
        </div>

        <div className="wr-uptime-legend">
          <span className="wr-legend-item">
            <span className="wr-legend-swatch wr-legend-swatch--green" />
            Operational
          </span>
          <span className="wr-legend-item">
            <span className="wr-legend-swatch wr-legend-swatch--amber" />
            Degraded
          </span>
          <span className="wr-legend-item">
            <span className="wr-legend-swatch wr-legend-swatch--red" />
            Active Incident
          </span>
        </div>
      </div>

      <div className="wr-card wr-uptime-card">
        {services.map((service, index) => {
          const isIncident = service.status === "incident";
          const isDegraded = service.status === "degraded";

          return (
            <React.Fragment key={service.id}>
              {index > 0 && <div className="wr-hairline" />}
              <div className="wr-service-timeline-row">
                <div className="wr-row-between">
                  <div className="wr-row wr-gap-2">
                    <span
                      className={`wr-dot ${
                        isIncident
                          ? "wr-dot--sev1 wr-dot--pulse"
                          : isDegraded
                            ? "wr-dot--amber"
                            : "wr-dot--green"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="wr-service-name">{service.name}</span>
                    {isIncident ? (
                      <SeverityBadge variant="sev1">
                        {service.statusLabel}
                      </SeverityBadge>
                    ) : (
                      <span className="wr-service-status-ok">
                        {service.statusLabel}
                      </span>
                    )}
                  </div>

                  <div className="wr-row wr-gap-2 wr-meta-mono">
                    <span>Uptime</span>
                    <span
                      className={
                        isIncident
                          ? "wr-uptime-value wr-uptime-value--warn"
                          : "wr-uptime-value"
                      }
                    >
                      {service.uptime24h}
                    </span>
                  </div>
                </div>

                <div
                  className="wr-segments-grid"
                  role="img"
                  aria-label={`${service.name} 24-hour availability: ${service.uptime24h}`}
                >
                  {service.segments.map((seg, segIdx) => {
                    const isLastActive =
                      segIdx === service.segments.length - 1 &&
                      seg.status === "incident";
                    return (
                      <div
                        key={seg.hourLabel}
                        title={`${seg.hourLabel} · ${seg.detail}`}
                        className={`wr-segment wr-segment--${seg.status} ${
                          isLastActive ? "wr-segment--pulse" : ""
                        }`.trim()}
                      />
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div className="wr-uptime-axis">
          <span>24h ago</span>
          <span>18h ago</span>
          <span>12h ago</span>
          <span>6h ago</span>
          <span className="wr-uptime-axis-now">Now</span>
        </div>
      </div>
    </section>
  );
}
