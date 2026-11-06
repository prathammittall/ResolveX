"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "../../../components/layout/AppShell";
import { SeverityBadge } from "../../../components/ui/SeverityBadge";
import { StatusStepper } from "../../../components/ui/StatusStepper";
import { LiveTimer } from "../../../components/ui/LiveTimer";
import { ResponderAvatar } from "../../../components/ui/ResponderAvatar";
import { Icon } from "../../../components/ui/Icon";
import {
  ACTIVE_INCIDENT,
  type LifecycleStep,
  type TimelineEvent,
} from "../../../lib/incident-data";

export default function IncidentSummaryPage() {
  const incident = ACTIVE_INCIDENT;
  const [copied, setCopied] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [markedIdentified, setMarkedIdentified] = useState(false);
  const [steps, setSteps] = useState<LifecycleStep[]>(incident.lifecycle);
  const [events, setEvents] = useState<TimelineEvent[]>(
    incident.activityTimeline
  );

  const handleCopyId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(incident.id).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleMarkIdentified = () => {
    if (markedIdentified) return;
    setMarkedIdentified(true);

    const now = new Date();
    const utcTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes()
    ).padStart(2, "0")}`;

    setSteps((prev) =>
      prev.map((step) => {
        if (step.stage === "Investigating") {
          return { ...step, state: "completed", timestamp: "15:00 UTC" };
        }
        if (step.stage === "Identified") {
          return { ...step, state: "active", timestamp: `${utcTime} UTC` };
        }
        return step;
      })
    );

    setEvents((prev) => [
      ...prev.map((ev) => ({ ...ev, isLatest: false })),
      {
        id: `ev-${prev.length + 1}`,
        timeUtc: utcTime,
        description:
          "Root cause marked as Identified: primary shard connection pool saturation under v2.14.8 retry policy",
        isLatest: true,
      },
    ]);
  };

  const handleEscalate = () => {
    if (escalated) return;
    setEscalated(true);
  };

  return (
    <AppShell>
      {/* Breadcrumb Navigation */}
      <nav className="wr-breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard" className="wr-breadcrumb-link">
          <Icon name="arrow_back" size={14} />
          <span>Incidents</span>
        </Link>
        <span aria-hidden="true">/</span>
        <span style={{ color: "var(--text-heading)", fontWeight: 500 }}>
          {incident.id}
        </span>
      </nav>

      {/* Incident Header */}
      <header className="wr-incident-header">
        <div className="wr-stack wr-gap-2" style={{ maxWidth: "640px" }}>
          <div className="wr-row wr-gap-2">
            <SeverityBadge variant="neutral">{incident.id}</SeverityBadge>
            <button
              type="button"
              onClick={handleCopyId}
              className="wr-btn--ghost-mono"
            >
              {copied ? "COPIED" : "COPY"}
            </button>
            <span
              style={{
                width: "1px",
                height: "12px",
                backgroundColor: "var(--border-card)",
              }}
              aria-hidden="true"
            />
            <SeverityBadge variant="sev1" showDot>
              {incident.severity}
            </SeverityBadge>
            {escalated && (
              <SeverityBadge variant="amber">
                PAGED VP INFRA
              </SeverityBadge>
            )}
          </div>

          <h1 className="wr-display-title">{incident.title}</h1>
        </div>

        <div className="wr-row wr-gap-2">
          <button
            type="button"
            onClick={handleEscalate}
            className="wr-btn wr-btn--secondary"
          >
            <Icon name="arrow_upward" size={15} />
            <span>{escalated ? "Escalated" : "Escalate"}</span>
          </button>

          <button
            type="button"
            onClick={handleMarkIdentified}
            className="wr-btn wr-btn--primary"
          >
            <Icon name="check_circle" size={15} />
            <span>
              {markedIdentified ? "Root cause identified" : "Mark as identified"}
            </span>
          </button>
        </div>
      </header>

      {/* Card 1: Horizontal 5-Stage Lifecycle Stepper */}
      <StatusStepper steps={steps} />

      {/* Main Two-Column Content Layout (8 cols Left / 4 cols Right) */}
      <div className="wr-detail-grid">
        <div className="wr-detail-main">
          {/* Executive Summary (Negative Space Band — No Nested Card Box) */}
          <section
            className="wr-exec-summary-band"
            aria-label="Executive Summary"
          >
            <h2 className="wr-label-micro">Executive Summary</h2>
            <p className="wr-body-copy">{incident.executiveSummary}</p>
          </section>

          {/* Card 2: Chronological Activity Timeline */}
          <section
            className="wr-card wr-timeline-card"
            aria-label="Incident Activity"
          >
            <div className="wr-timeline-card-header">
              <h2 className="wr-label-micro">Incident Activity</h2>
              <span className="wr-meta-mono">
                {events.length} events recorded
              </span>
            </div>

            <ol className="wr-timeline-list">
              {events.map((event) => (
                <li key={event.id} className="wr-timeline-item">
                  <time
                    className={`wr-timeline-time ${
                      event.isLatest ? "wr-timeline-time--latest" : ""
                    }`.trim()}
                  >
                    {event.timeUtc}
                  </time>
                  <span
                    className={`wr-timeline-dot ${
                      event.isLatest ? "wr-timeline-dot--latest" : ""
                    }`.trim()}
                    aria-hidden="true"
                  />
                  <p className="wr-body-copy">{event.description}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Right Column — Card 3: Metadata Panel */}
        <aside className="wr-detail-aside" aria-label="Incident Metadata">
          <div className="wr-card wr-metadata-card">
            {/* Commander */}
            <div className="wr-meta-group">
              <span className="wr-label-micro">Incident Commander</span>
              <div className="wr-row wr-gap-2" style={{ paddingTop: "4px" }}>
                <ResponderAvatar responder={incident.commander} size="md" />
                <div className="wr-stack">
                  <span
                    style={{
                      fontSize: "15px",
                      lineHeight: "20px",
                      fontWeight: 500,
                      color: "var(--text-heading)",
                    }}
                  >
                    {incident.commander.name}
                  </span>
                  <span className="wr-meta-mono">
                    {incident.commander.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="wr-hairline" />

            {/* Impacted Service */}
            <div className="wr-meta-group">
              <span className="wr-label-micro">Impacted Service</span>
              <div className="wr-row-between" style={{ paddingTop: "2px" }}>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "var(--text-heading)",
                  }}
                >
                  {incident.service}
                </span>
                <SeverityBadge variant="neutral" uppercase={false}>
                  {incident.serviceTier}
                </SeverityBadge>
              </div>
            </div>

            <div className="wr-hairline" />

            {/* Active Duration */}
            <div className="wr-meta-group">
              <span className="wr-label-micro">Active Duration</span>
              <div
                className="wr-row wr-gap-2"
                style={{ alignItems: "baseline", paddingTop: "2px" }}
              >
                <LiveTimer
                  initialSeconds={incident.initialElapsedSeconds}
                  format="hms"
                  className="wr-elapsed-display"
                />
                <span className="wr-meta-mono">elapsed</span>
              </div>
            </div>

            <div className="wr-hairline" />

            {/* Responders Roster */}
            <div className="wr-meta-group">
              <div className="wr-row-between">
                <span className="wr-label-micro">Responders</span>
                <span className="wr-meta-mono">
                  {incident.responders.length} active
                </span>
              </div>
              <div className="wr-row wr-gap-2" style={{ paddingTop: "4px" }}>
                <div className="wr-avatar-stack">
                  {incident.responders.map((resp) => (
                    <ResponderAvatar
                      key={resp.id}
                      responder={resp}
                      size="sm"
                    />
                  ))}
                </div>
                <span className="wr-meta-mono">Sharma, Kumar, Rostova</span>
              </div>
            </div>

            <div className="wr-hairline" />

            {/* Communications Channel */}
            <div className="wr-meta-group">
              <span className="wr-label-micro">Incident Room</span>
              <div className="wr-row-between" style={{ paddingTop: "4px" }}>
                <Link
                  href={`/incidents/${incident.id}/war-room`}
                  className="wr-badge wr-badge--cobalt"
                  style={{ textTransform: "none", padding: "4px 8px" }}
                >
                  <Icon name="tag" size={13} />
                  <span>{incident.channel}</span>
                </Link>

                <Link
                  href={`/incidents/${incident.id}/war-room`}
                  className="wr-inline-link"
                >
                  <span>Open</span>
                  <Icon name="arrow_outward" size={13} />
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
