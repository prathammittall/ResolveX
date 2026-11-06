export type SeverityLevel = "SEV-1" | "SEV-2" | "SEV-3";
export type IncidentStage =
  | "Triggered"
  | "Acknowledged"
  | "Investigating"
  | "Identified"
  | "Resolved";

export type ServiceHealthStatus = "operational" | "degraded" | "incident";

export interface Responder {
  id: string;
  name: string;
  initials: string;
  role: string;
  team: string;
  onCallTier?: "Primary" | "Secondary";
  accentTone: "navy" | "cobalt" | "sage";
}

export interface HourlySegment {
  hourLabel: string;
  status: ServiceHealthStatus;
  detail: string;
}

export interface MonitoredService {
  id: string;
  name: string;
  publicName: string;
  tier: string;
  status: ServiceHealthStatus;
  statusLabel: string;
  uptime24h: string;
  segments: HourlySegment[];
}

export interface LifecycleStep {
  stage: IncidentStage;
  timestamp: string;
  state: "completed" | "active" | "pending";
}

export interface TimelineEvent {
  id: string;
  timeUtc: string;
  description: string;
  isLatest?: boolean;
}

export type WarRoomFeedItem =
  | {
      id: string;
      type: "message";
      responder: Responder;
      timeUtc: string;
      content: string;
      codeToken?: string;
      metricsHighlight?: {
        from: string;
        to: string;
        prefix: string;
        middle: string;
        suffix: string;
      };
    }
  | {
      id: string;
      type: "system";
      icon: "tune" | "route" | "check";
      text: string;
      highlight?: string;
      timeUtc: string;
    }
  | {
      id: string;
      type: "action";
      idAttr: string;
      label: string;
      assignee: string;
      priority: string;
      completed: boolean;
    };

export const RESPONDERS: Record<string, Responder> = {
  asha: {
    id: "asha",
    name: "Asha Sharma",
    initials: "AS",
    role: "Lead Staff SRE",
    team: "Payments & Core",
    onCallTier: "Primary",
    accentTone: "cobalt",
  },
  rohan: {
    id: "rohan",
    name: "Rohan Kumar",
    initials: "RK",
    role: "Systems Engineer",
    team: "Infrastructure",
    onCallTier: "Secondary",
    accentTone: "navy",
  },
  elena: {
    id: "elena",
    name: "Elena Rostova",
    initials: "ER",
    role: "Infrastructure",
    team: "Database Eng",
    accentTone: "sage",
  },
};

function buildHealthySegments(): HourlySegment[] {
  return Array.from({ length: 24 }, (_, idx) => {
    const hoursAgo = 23 - idx;
    return {
      hourLabel: hoursAgo === 0 ? "Now" : `${hoursAgo}h ago`,
      status: "operational" as const,
      detail: "100% availability",
    };
  });
}

function buildPaymentsSegments(): HourlySegment[] {
  return Array.from({ length: 24 }, (_, idx) => {
    const hoursAgo = 23 - idx;
    if (hoursAgo === 0) {
      return {
        hourLabel: "Now",
        status: "incident",
        detail: "Active SEV-1 · INC-1042",
      };
    }
    if (hoursAgo === 1) {
      return {
        hourLabel: "1h ago",
        status: "incident",
        detail: "INC-1042 triggered",
      };
    }
    if (hoursAgo === 2 || hoursAgo === 3) {
      return {
        hourLabel: `${hoursAgo}h ago`,
        status: "degraded",
        detail: "Elevated P99 latency",
      };
    }
    return {
      hourLabel: `${hoursAgo}h ago`,
      status: "operational",
      detail: "100% availability",
    };
  });
}

export const CORE_SERVICES: MonitoredService[] = [
  {
    id: "payments-api",
    name: "Payments API",
    publicName: "Payments API",
    tier: "tier-0 core",
    status: "incident",
    statusLabel: "SEV-1 Latency",
    uptime24h: "98.62%",
    segments: buildPaymentsSegments(),
  },
  {
    id: "auth-service",
    name: "Auth Service",
    publicName: "Authentication & SSO",
    tier: "tier-0 core",
    status: "operational",
    statusLabel: "Operational",
    uptime24h: "100.0%",
    segments: buildHealthySegments(),
  },
  {
    id: "checkout-engine",
    name: "Checkout Engine",
    publicName: "Checkout Engine",
    tier: "tier-1 core",
    status: "operational",
    statusLabel: "Operational",
    uptime24h: "99.98%",
    segments: buildHealthySegments(),
  },
  {
    id: "notification-gateway",
    name: "Notification Gateway",
    publicName: "Notification Gateway",
    tier: "tier-2 edge",
    status: "operational",
    statusLabel: "Operational",
    uptime24h: "100.0%",
    segments: buildHealthySegments(),
  },
];

export const ACTIVE_INCIDENT = {
  id: "INC-1042",
  severity: "SEV-1" as SeverityLevel,
  title: "API latency elevated",
  publicTitle: "Elevated API latency",
  service: "Payments API",
  serviceTier: "tier-0 core",
  channel: "inc-1042-payments",
  audioBridge: "#warroom-1042",
  initialElapsedSeconds: 20 * 60 + 57, // 00:20:57
  overviewElapsedSeconds: 23 * 60 + 34, // 23m 34s
  shortSummary:
    "P99 latency exceeding 2,400ms threshold on checkout payment handoff endpoints.",
  executiveSummary:
    "P99 latency exceeding 2,400ms threshold across checkout payment handoff endpoints following deployment v2.14.8. Automated fallbacks active; degraded checkout completion rates observed in EU-West.",
  publicSummary:
    "Traffic has been rerouted to secondary clusters. Primary shard connection saturation is stabilizing; P99 latency is trending down from peak levels as traffic settles.",
  commander: RESPONDERS.asha!,
  responders: [RESPONDERS.asha!, RESPONDERS.rohan!, RESPONDERS.elena!],
  lifecycle: [
    { stage: "Triggered", timestamp: "14:48 UTC", state: "completed" },
    { stage: "Acknowledged", timestamp: "14:52 UTC", state: "completed" },
    { stage: "Investigating", timestamp: "In progress", state: "active" },
    { stage: "Identified", timestamp: "Pending", state: "pending" },
    { stage: "Resolved", timestamp: "Pending", state: "pending" },
  ] as LifecycleStep[],
  activityTimeline: [
    {
      id: "ev-1",
      timeUtc: "14:48",
      description: "Latency alert triggered by Datadog APM monitor",
    },
    {
      id: "ev-2",
      timeUtc: "14:52",
      description:
        "Asha Sharma acknowledged page and assumed incident commander",
    },
    {
      id: "ev-3",
      timeUtc: "14:58",
      description:
        "Rohan Kumar joined war room; isolated to payments gateway pool",
    },
    {
      id: "ev-4",
      timeUtc: "15:04",
      description:
        "Traffic rerouted via standby checkout cluster; p99 latency stabilizing to ~800ms",
    },
    {
      id: "ev-5",
      timeUtc: "15:09",
      description:
        "Database connection pool exhaustion confirmed on primary shard",
      isLatest: true,
    },
  ] as TimelineEvent[],
  warRoomFeed: [
    {
      id: "wr-1",
      type: "message",
      responder: RESPONDERS.rohan!,
      timeUtc: "14:58",
      content:
        "Database connection pool exhaustion confirmed on primary shard",
      codeToken: "db-payments-01",
    },
    {
      id: "wr-2",
      type: "system",
      icon: "tune",
      text: "Asha Sharma updated status to",
      highlight: "Investigating",
      timeUtc: "15:00 UTC",
    },
    {
      id: "wr-3",
      type: "message",
      responder: RESPONDERS.asha!,
      timeUtc: "15:02",
      content:
        "Standby replica checkout cluster is taking 40% of traffic. Rerouting remaining checkout requests now.",
    },
    {
      id: "wr-4",
      type: "action",
      idAttr: "action-eu-drain",
      label:
        "Verify latency drop on EU-West payment gateway after route drain",
      assignee: "Rohan Kumar",
      priority: "P0 Action",
      completed: false,
    },
    {
      id: "wr-5",
      type: "system",
      icon: "route",
      text: "Traffic rerouted via standby checkout cluster",
      timeUtc: "15:05 UTC",
    },
    {
      id: "wr-6",
      type: "message",
      responder: RESPONDERS.elena!,
      timeUtc: "15:08",
      content: "",
      metricsHighlight: {
        prefix: "P99 latency down from ",
        from: "2,400ms",
        middle: " to ",
        to: "620ms",
        suffix: ". Error budget burn rate leveling out.",
      },
    },
  ] as WarRoomFeedItem[],
};
