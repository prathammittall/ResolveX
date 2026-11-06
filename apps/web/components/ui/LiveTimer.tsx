"use client";

import React, { useEffect, useState } from "react";

interface LiveTimerProps {
  initialSeconds: number;
  format?: "compact" | "hms";
  className?: string;
}

function formatDuration(totalSeconds: number, format: "compact" | "hms"): string {
  if (format === "hms") {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}m ${secs}s`;
}

export function LiveTimer({
  initialSeconds,
  format = "compact",
  className = "",
}: LiveTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`wr-tabular-mono ${className}`.trim()}>
      {formatDuration(seconds, format)}
    </span>
  );
}
