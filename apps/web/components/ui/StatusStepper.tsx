import React from "react";
import type { LifecycleStep } from "../../lib/incident-data";
import { Icon } from "./Icon";

interface StatusStepperProps {
  steps: LifecycleStep[];
}

export function StatusStepper({ steps }: StatusStepperProps) {
  return (
    <section className="wr-card wr-stepper-card" aria-label="Incident Lifecycle">
      <div className="wr-stepper-grid">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <div
              key={step.stage}
              className={`wr-step wr-step--${step.state}`}
            >
              <div className="wr-step-track-row">
                <div className="wr-step-node">
                  {step.state === "completed" ? (
                    <Icon name="check" size={12} />
                  ) : step.state === "active" ? (
                    <span className="wr-step-node-core--active" />
                  ) : (
                    <span className="wr-step-node-core--pending" />
                  )}
                </div>
                {!isLast && <div className="wr-step-connector" />}
              </div>

              <div className="wr-step-labels">
                <span className="wr-step-title">{step.stage}</span>
                <span className="wr-step-time">{step.timestamp}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
