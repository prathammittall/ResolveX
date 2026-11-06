import React from "react";

export type BadgeVariant =
  | "sev1"
  | "amber"
  | "green"
  | "cobalt"
  | "neutral"
  | "live";

interface SeverityBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  showDot?: boolean;
  pulseDot?: boolean;
  uppercase?: boolean;
}

export function SeverityBadge({
  variant,
  children,
  showDot = false,
  pulseDot = false,
  uppercase = true,
}: SeverityBadgeProps) {
  return (
    <span
      className={`wr-badge wr-badge--${variant} ${
        uppercase ? "wr-badge--upper" : ""
      }`.trim()}
    >
      {showDot && (
        <span
          className={`wr-dot wr-dot--${variant} ${
            pulseDot ? "wr-dot--pulse" : ""
          }`.trim()}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
