"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TopographicWatermark } from "../../components/layout/TopographicWatermark";
import { SeverityBadge } from "../../components/ui/SeverityBadge";
import { ACTIVE_INCIDENT, CORE_SERVICES } from "../../lib/incident-data";

export default function PublicStatusPage() {
  const incident = ACTIVE_INCIDENT;
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="wr-public-status-page">
      <TopographicWatermark variant="elliptical" position="top-right" />

      <main className="wr-public-column">
        {/* Minimalist Brand Header */}
        <header className="wr-public-header">
          <div className="wr-row wr-gap-2">
            <span className="wr-public-mark" aria-hidden="true">
              A
            </span>
            <span className="wr-label-micro">Acme Co Status</span>
          </div>

          <div className="wr-meta-mono">Updated 15:10 UTC</div>
        </header>

        {/* Overall System Headline */}
        <section className="wr-public-banner" aria-label="Overall System Status">
          <div className="wr-row wr-gap-2">
            <span
              className="wr-dot wr-dot--amber wr-dot--pulse"
              style={{ width: "10px", height: "10px" }}
              aria-hidden="true"
            />
            <h1 className="wr-display-title">Degraded performance</h1>
          </div>
          <p className="wr-body-muted">
            Checkout &amp; Payments API experiencing elevated P99 latency.
            Traffic failover to secondary cluster in progress.
          </p>
        </section>

        {/* Active Incident Card */}
        <section className="wr-public-section" aria-label="Active Incident">
          <article className="wr-card wr-public-incident-card">
            <div
              className="wr-row-between"
              style={{
                paddingBottom: "var(--space-3)",
                borderBottom: "1px solid var(--border-card)",
              }}
            >
              <div className="wr-row wr-gap-2">
                <h2
                  style={{
                    fontSize: "16px",
                    lineHeight: "24px",
                    fontWeight: 600,
                    color: "var(--text-heading)",
                  }}
                >
                  {incident.publicTitle}
                </h2>
                <SeverityBadge variant="amber" uppercase={false}>
                  Investigating
                </SeverityBadge>
              </div>

              <time className="wr-meta-mono">15:08 UTC</time>
            </div>

            <div
              className="wr-stack wr-gap-2"
              style={{ paddingTop: "var(--space-3)" }}
            >
              <p className="wr-body-copy">{incident.publicSummary}</p>
              <div className="wr-meta-mono" style={{ paddingTop: "4px" }}>
                Impacted component:{" "}
                <span style={{ color: "var(--text-heading)", fontWeight: 500 }}>
                  {incident.service}
                </span>
              </div>
            </div>
          </article>
        </section>

        {/* Services Status Rows */}
        <section className="wr-public-section" aria-label="System Services">
          <div
            className="wr-row-between"
            style={{ marginBottom: "var(--space-2)" }}
          >
            <h3 className="wr-label-micro">System Services</h3>
            <span className="wr-meta-mono">{CORE_SERVICES.length} services</span>
          </div>

          <div className="wr-card wr-public-services-list">
            {CORE_SERVICES.map((svc) => {
              const isDegraded = svc.status !== "operational";
              return (
                <div key={svc.id} className="wr-public-service-row">
                  <div className="wr-row wr-gap-2">
                    <span
                      className={`wr-dot ${
                        isDegraded ? "wr-dot--amber" : "wr-dot--green"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        fontSize: "14px",
                        lineHeight: "20px",
                        fontWeight: 500,
                        color: "var(--text-main)",
                      }}
                    >
                      {svc.publicName}
                    </span>
                  </div>

                  <span
                    className="wr-meta-mono"
                    style={{
                      fontWeight: 500,
                      color: isDegraded
                        ? "var(--severity-amber)"
                        : "var(--severity-green)",
                    }}
                  >
                    {isDegraded ? "Degraded" : "Operational"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="wr-public-footer">
        <span className="wr-meta-mono">Acme Co Infrastructure Status</span>

        <div className="wr-row wr-gap-4">
          <button
            type="button"
            onClick={() => setSubscribed((prev) => !prev)}
            className="wr-inline-link"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            {subscribed
              ? "Subscribed to webhook & RSS updates"
              : "Subscribe to updates →"}
          </button>

          <Link href="/dashboard" className="wr-meta-mono">
            War-Room Console
          </Link>
        </div>
      </footer>
    </div>
  );
}
