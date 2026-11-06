import React from "react";

interface TopographicWatermarkProps {
  variant?: "radar" | "contour" | "elliptical";
  position?: "bottom-right" | "top-right";
}

export function TopographicWatermark({
  variant = "contour",
  position = "top-right",
}: TopographicWatermarkProps) {
  return (
    <div
      aria-hidden="true"
      className={`wr-watermark wr-watermark--${position}`}
    >
      {variant === "radar" && (
        <svg viewBox="0 0 400 400" fill="none" stroke="currentColor">
          <circle cx="200" cy="200" r="180" strokeWidth="1" />
          <circle
            cx="200"
            cy="200"
            r="120"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <circle cx="200" cy="200" r="60" strokeWidth="1" />
          <line x1="200" y1="20" x2="200" y2="380" strokeWidth="0.75" />
          <line x1="20" y1="200" x2="380" y2="200" strokeWidth="0.75" />
        </svg>
      )}

      {variant === "contour" && (
        <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M40 80 C 110 50, 230 40, 360 90 C 420 120, 390 260, 330 310 C 260 370, 120 380, 60 300 C 10 230, -10 130, 40 80 Z" />
          <path d="M70 100 C 130 80, 220 70, 330 110 C 380 140, 360 240, 300 280 C 240 330, 140 340, 90 270 C 40 210, 30 140, 70 100 Z" />
          <path d="M100 125 C 150 105, 210 100, 290 135 C 335 160, 320 220, 275 250 C 220 290, 150 300, 115 245 C 80 195, 75 150, 100 125 Z" />
          <path d="M130 150 C 170 135, 210 130, 260 155 C 290 175, 280 210, 245 230 C 200 255, 150 260, 130 220 C 110 185, 110 165, 130 150 Z" />
          <path d="M165 175 C 190 165, 215 160, 235 175 C 250 188, 245 205, 225 215 C 195 228, 170 230, 155 205 C 145 188, 150 180, 165 175 Z" />
        </svg>
      )}

      {variant === "elliptical" && (
        <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="1.2">
          <ellipse cx="280" cy="120" rx="60" ry="40" />
          <ellipse cx="280" cy="120" rx="100" ry="70" />
          <ellipse cx="280" cy="120" rx="145" ry="105" />
          <ellipse cx="280" cy="120" rx="195" ry="145" />
          <ellipse cx="280" cy="120" rx="250" ry="190" />
          <ellipse cx="280" cy="120" rx="310" ry="240" />
        </svg>
      )}
    </div>
  );
}
