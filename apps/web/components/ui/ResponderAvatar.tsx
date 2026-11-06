import React from "react";
import type { Responder } from "../../lib/incident-data";

interface ResponderAvatarProps {
  responder: Pick<Responder, "name" | "initials" | "accentTone" | "role">;
  size?: "xs" | "sm" | "md";
  stacked?: boolean;
}

export function ResponderAvatar({
  responder,
  size = "md",
  stacked = false,
}: ResponderAvatarProps) {
  const toneClass =
    responder.accentTone === "cobalt"
      ? "wr-avatar--cobalt"
      : responder.accentTone === "sage"
        ? "wr-avatar--sage"
        : "wr-avatar--navy";

  return (
    <span
      className={`wr-avatar wr-avatar--${size} ${toneClass} ${
        stacked ? "wr-avatar--stacked" : ""
      }`.trim()}
      title={`${responder.name}${responder.role ? ` (${responder.role})` : ""}`}
      aria-label={responder.name}
    >
      {responder.initials}
    </span>
  );
}
