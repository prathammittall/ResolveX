"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "../../../../components/layout/AppShell";
import { TopographicWatermark } from "../../../../components/layout/TopographicWatermark";
import { SeverityBadge } from "../../../../components/ui/SeverityBadge";
import { ResponderAvatar } from "../../../../components/ui/ResponderAvatar";
import { Icon } from "../../../../components/ui/Icon";
import {
  ACTIVE_INCIDENT,
  RESPONDERS,
  type WarRoomFeedItem,
} from "../../../../lib/incident-data";

export default function IncidentWarRoomPage() {
  const incident = ACTIVE_INCIDENT;
  const [feed, setFeed] = useState<WarRoomFeedItem[]>(incident.warRoomFeed);
  const [draft, setDraft] = useState("");

  const toggleActionItem = (id: string) => {
    setFeed((prev) =>
      prev.map((item) =>
        item.type === "action" && item.id === id
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  };

  const handleSendMessage = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes()
    ).padStart(2, "0")}`;

    if (trimmed.startsWith("/status ")) {
      const nextStatus = trimmed.replace("/status ", "").trim();
      setFeed((prev) => [
        ...prev,
        {
          id: `wr-${prev.length + 1}`,
          type: "system",
          icon: "tune",
          text: "Asha Sharma updated status to",
          highlight: nextStatus || "Identified",
          timeUtc: `${timeStr} UTC`,
        },
      ]);
    } else if (trimmed.startsWith("/action ")) {
      const actionLabel = trimmed.replace("/action ", "").trim();
      setFeed((prev) => [
        ...prev,
        {
          id: `wr-${prev.length + 1}`,
          type: "action",
          idAttr: `action-${prev.length + 1}`,
          label: actionLabel,
          assignee: "Asha Sharma",
          priority: "P0 Action",
          completed: false,
        },
      ]);
    } else {
      setFeed((prev) => [
        ...prev,
        {
          id: `wr-${prev.length + 1}`,
          type: "message",
          responder: RESPONDERS.asha!,
          timeUtc: timeStr,
          content: trimmed,
        },
      ]);
    }

    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AppShell fullHeightStream>
      <TopographicWatermark variant="contour" position="top-right" />

      <div className="wr-stream-column">
        {/* Channel Header */}
        <header className="wr-stream-header">
          <div className="wr-row wr-gap-2">
            <Link
              href={`/incidents/${incident.id}`}
              className="wr-icon-btn"
              title={`Back to ${incident.id} summary`}
              aria-label={`Back to ${incident.id} summary`}
            >
              <Icon name="arrow_back" size={16} />
            </Link>

            <div className="wr-row wr-gap-2">
              <span
                className="wr-meta-mono"
                style={{ color: "var(--text-heading)", fontWeight: 500 }}
              >
                {incident.id}
              </span>
              <span className="wr-meta-mono">/</span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-heading)",
                }}
              >
                {incident.service}
              </span>

              <SeverityBadge variant="live" showDot pulseDot>
                Live
              </SeverityBadge>
            </div>
          </div>

          <div className="wr-row wr-gap-3">
            <span className="wr-meta-mono">
              {incident.responders.length} responders online
            </span>
            <div className="wr-avatar-stack">
              {incident.responders.map((resp) => (
                <ResponderAvatar key={resp.id} responder={resp} size="xs" />
              ))}
            </div>
          </div>
        </header>

        {/* Chronological War-Room Feed */}
        <div
          className="wr-stream-feed"
          role="log"
          aria-live="polite"
          aria-label="Incident War-Room Stream"
        >
          {feed.map((item) => {
            if (item.type === "message") {
              return (
                <div key={item.id} className="wr-feed-message">
                  <ResponderAvatar responder={item.responder} size="sm" />
                  <div className="wr-feed-message-body">
                    <div
                      className="wr-row wr-gap-2"
                      style={{ alignItems: "baseline" }}
                    >
                      <span className="wr-feed-author">
                        {item.responder.name}
                      </span>
                      <span className="wr-label-micro">
                        {item.responder.role}
                      </span>
                      <time className="wr-meta-mono">{item.timeUtc}</time>
                    </div>

                    <div className="wr-body-copy">
                      {item.metricsHighlight ? (
                        <>
                          {item.metricsHighlight.prefix}
                          <span
                            className="wr-mono"
                            style={{
                              fontSize: "13px",
                              color: "var(--severity-red)",
                              fontWeight: 500,
                            }}
                          >
                            {item.metricsHighlight.from}
                          </span>
                          {item.metricsHighlight.middle}
                          <span
                            className="wr-mono"
                            style={{
                              fontSize: "13px",
                              color: "var(--severity-green)",
                              fontWeight: 500,
                            }}
                          >
                            {item.metricsHighlight.to}
                          </span>
                          {item.metricsHighlight.suffix}
                        </>
                      ) : (
                        <>
                          {item.content}
                          {item.codeToken && (
                            <>
                              {" "}
                              <code className="wr-inline-code">
                                {item.codeToken}
                              </code>
                              .
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === "system") {
              return (
                <div key={item.id} className="wr-feed-system">
                  <div className="wr-hairline" />
                  <div className="wr-feed-system-label">
                    <Icon
                      name={item.icon === "route" ? "alt_route" : "tune"}
                      size={13}
                    />
                    <span>
                      {item.text}{" "}
                      {item.highlight && (
                        <strong
                          style={{
                            color: "var(--text-heading)",
                            fontWeight: 500,
                          }}
                        >
                          {item.highlight}
                        </strong>
                      )}{" "}
                      · {item.timeUtc}
                    </span>
                  </div>
                  <div className="wr-hairline" />
                </div>
              );
            }

            return (
              <div key={item.id} className="wr-action-item-wrapper">
                <div className="wr-card wr-action-card">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.completed}
                    aria-labelledby={`label-${item.id}`}
                    onClick={() => toggleActionItem(item.id)}
                    className={`wr-checkbox-btn ${
                      item.completed ? "wr-checkbox-btn--checked" : ""
                    }`.trim()}
                  >
                    {item.completed && <Icon name="check" size={11} />}
                  </button>

                  <div className="wr-stack wr-gap-1" style={{ flex: 1 }}>
                    <span
                      id={`label-${item.id}`}
                      onClick={() => toggleActionItem(item.id)}
                      className={`wr-action-label ${
                        item.completed ? "wr-action-label--done" : ""
                      }`.trim()}
                    >
                      {item.label}
                    </span>

                    <div className="wr-row wr-gap-2 wr-meta-mono">
                      <span className="wr-row wr-gap-1">
                        <Icon name="person" size={12} />
                        <span>Assigned to {item.assignee}</span>
                      </span>
                      <span>·</span>
                      <span
                        className="wr-row wr-gap-1"
                        style={{
                          color: "var(--severity-red)",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          className="wr-dot wr-dot--sev1"
                          style={{ width: "6px", height: "6px" }}
                          aria-hidden="true"
                        />
                        <span>{item.priority}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Composer */}
        <footer className="wr-composer-footer">
          <div className="wr-composer-box">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write an update or paste command... (e.g. /status Identified or /action Verify replica)"
              aria-label="Write an incident update or command"
              className="wr-composer-input"
            />
            <button
              type="button"
              onClick={handleSendMessage}
              className="wr-btn wr-btn--primary"
            >
              <span className="wr-mono" style={{ fontSize: "12px" }}>
                Send
              </span>
              <Icon name="send" size={14} />
            </button>
          </div>

          <div className="wr-row-between wr-meta-mono" style={{ fontSize: "11px" }}>
            <span>
              Enter to send · Type <kbd className="wr-kbd">/status</kbd> or{" "}
              <kbd className="wr-kbd">/action</kbd> for incident commands
            </span>
            <span
              className="wr-row wr-gap-1"
              style={{ color: "var(--severity-green)" }}
            >
              <span
                className="wr-dot wr-dot--green"
                style={{ width: "6px", height: "6px" }}
                aria-hidden="true"
              />
              <span>Audio/Bridge: {incident.audioBridge}</span>
            </span>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
