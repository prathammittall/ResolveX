import { db as defaultDb } from "../../prisma/db.js";
import type { IncidentSeverityValue } from "./types.js";
import { sendNotification } from "./notifications.js";
import { findActiveMaintenanceWindow } from "./escalation.js";

type DbClient = typeof defaultDb;
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const LOCK_DURATION_MS = 60_000;

type WorkerJob = {
  id: number;
  companyId: number;
  incidentId: number | null;
  type: "notify" | "escalate";
  attempts: number;
  payload: unknown;
};

type PolicyStep = {
  position: number;
  delaySeconds: number;
  targetType: string;
  targetId: string;
  notificationChannels: unknown;
};

function isDue(value: string, now: number): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now;
}

async function claimNextJob(
  client: DbClient,
  now: Date,
): Promise<WorkerJob | null> {
  const [pending, processing] = await Promise.all([
    client.orm.public.QueueJob.where({ status: "pending" }).all(),
    client.orm.public.QueueJob.where({ status: "processing" }).all(),
  ]);
  const candidate = [...pending, ...processing]
    .filter((job) => {
      if (job.status === "pending") return isDue(job.runAt, now.getTime());
      return job.lockedUntil !== null && isDue(job.lockedUntil, now.getTime());
    })
    .sort((a, b) => a.runAt.localeCompare(b.runAt))[0];
  if (!candidate) return null;

  return client.transaction(async (tx) => {
    const job = await tx.orm.public.QueueJob.where({ id: candidate.id })
      .forUpdate()
      .first();
    if (!job) return null;
    const reclaiming =
      job.status === "processing" &&
      job.lockedUntil !== null &&
      isDue(job.lockedUntil, Date.now());
    if (job.status !== "pending" && !reclaiming) return null;
    if (job.status === "pending" && !isDue(job.runAt, Date.now())) return null;

    await tx.orm.public.QueueJob.where({ id: job.id }).update({
      status: "processing",
      attempts: job.attempts + 1,
      lockedUntil: new Date(Date.now() + LOCK_DURATION_MS).toISOString(),
    });

    return {
      id: job.id,
      companyId: job.companyId,
      incidentId: job.incidentId,
      type: job.type,
      attempts: job.attempts + 1,
      payload: job.payload,
    };
  });
}

async function completeJob(client: DbClient, jobId: number): Promise<void> {
  await client.orm.public.QueueJob.where({ id: jobId }).update({
    status: "completed",
    lockedUntil: null,
  });
}

async function failJob(
  client: DbClient,
  job: WorkerJob,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : "Unknown queue job failure";
  await client.orm.public.QueueJob.where({ id: job.id }).update({
    status: job.attempts >= 5 ? "failed" : "pending",
    runAt: new Date(
      Date.now() + Math.min(job.attempts * 30_000, 300_000),
    ).toISOString(),
    lockedUntil: null,
    lastError: message,
  });
}

function channels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (channel): channel is string =>
      typeof channel === "string" && channel.length > 0,
  );
}

function policyStep(steps: PolicyStep[], position: number): PolicyStep | null {
  return steps.find((step) => step.position === position) ?? null;
}

async function loadSteps(
  tx: Transaction,
  policyId: number,
): Promise<PolicyStep[]> {
  const steps = await tx.orm.public.EscalationStep.where({ policyId }).all();
  return steps.sort((a, b) => a.position - b.position);
}

async function deliverStep(
  tx: Transaction,
  args: {
    companyId: number;
    incidentId: number;
    queueJobId: number;
    step: PolicyStep;
    severity: IncidentSeverityValue;
    title: string;
    description: string | null;
  },
): Promise<void> {
  const selectedChannels = channels(args.step.notificationChannels);
  if (selectedChannels.length === 0) {
    throw new Error(
      `Escalation step ${args.step.position} has no notification channels`,
    );
  }

  for (const channel of selectedChannels) {
    const idempotencyKey = `incident:${args.incidentId}:step:${args.step.position}:${channel}`;
    const existing = await tx.orm.public.NotificationDelivery.where({
      idempotencyKey,
    }).first();
    if (existing) continue;

    const result = await sendNotification({
      channel,
      targetType: args.step.targetType,
      targetId: args.step.targetId,
      incidentId: args.incidentId,
      severity: args.severity,
      title: args.title,
      description: args.description,
      step: args.step.position,
      companyId: args.companyId,
    });
    const sentAt = new Date().toISOString();
    await tx.orm.public.NotificationDelivery.create({
      companyId: args.companyId,
      incidentId: args.incidentId,
      queueJobId: args.queueJobId,
      channel,
      recipient: `${args.step.targetType}:${args.step.targetId}`,
      status: result.delivered ? "delivered" : "failed",
      sentAt,
      deliveredAt: result.delivered ? sentAt : null,
      error: result.error ?? null,
      idempotencyKey,
    });
  }

  await tx.orm.public.IncidentEvent.create({
    incidentId: args.incidentId,
    eventType: "system",
    message: `Escalation tier ${args.step.position} notified for ${args.severity}`,
    occurredAt: new Date().toISOString(),
  });
}

async function enqueueNextStep(
  tx: Transaction,
  args: {
    companyId: number;
    incidentId: number;
    currentStep: number;
    steps: PolicyStep[];
    runAt: string;
  },
): Promise<void> {
  const nextStep = policyStep(args.steps, args.currentStep + 1);
  const idempotencyKey = `incident:${args.incidentId}:step:${args.currentStep + 1}:escalate`;
  const existing = await tx.orm.public.QueueJob.where({
    idempotencyKey,
  }).first();
  if (existing) return;

  await tx.orm.public.QueueJob.create({
    companyId: args.companyId,
    incidentId: args.incidentId,
    type: "escalate",
    status: "pending",
    runAt: args.runAt,
    attempts: 0,
    idempotencyKey,
    payload: {
      incidentId: args.incidentId,
      step: nextStep?.position ?? args.currentStep,
    } as any,
  });
}

async function processNotifyJob(
  client: DbClient,
  job: WorkerJob,
): Promise<void> {
  if (job.incidentId === null) {
    throw new Error("Notification job is missing an incident");
  }

  return client.transaction(async (tx) => {
    const incident = await tx.orm.public.Incident.where({ id: job.incidentId! })
      .forUpdate()
      .first();
    if (!incident || incident.status === "resolved" || incident.acknowledgedAt)
      return;

    const escalation = await tx.orm.public.IncidentEscalation.where({
      incidentId: incident.id,
    })
      .forUpdate()
      .first();
    if (!escalation || escalation.status !== "active") return;

    const maintenanceWindow = await findActiveMaintenanceWindow(tx, {
      companyId: incident.companyId,
      serviceId: incident.serviceId,
      severity: incident.severity as IncidentSeverityValue,
      at: new Date().toISOString(),
    });
    if (maintenanceWindow) {
      await tx.orm.public.QueueJob.where({ id: job.id }).update({
        status: "pending",
        runAt: maintenanceWindow.endsAt,
        lockedUntil: null,
        lastError: `Deferred by maintenance window "${maintenanceWindow.name}"`,
      });
      return;
    }

    const steps = await loadSteps(tx, escalation.policyId);
    const step = policyStep(steps, escalation.currentStep);
    if (!step)
      throw new Error(
        `Escalation step ${escalation.currentStep} does not exist`,
      );

    await deliverStep(tx, {
      companyId: incident.companyId,
      incidentId: incident.id,
      queueJobId: job.id,
      step,
      severity: incident.severity as IncidentSeverityValue,
      title: incident.title,
      description: incident.description,
    });

    const nextEscalationAt = new Date(
      Date.now() + step.delaySeconds * 1000,
    ).toISOString();
    await tx.orm.public.IncidentEscalation.where({ id: escalation.id }).update({
      nextEscalationAt,
    });
    await tx.orm.public.Incident.where({ id: incident.id }).update({
      acknowledgmentDueAt: nextEscalationAt,
    });
    await enqueueNextStep(tx, {
      companyId: incident.companyId,
      incidentId: incident.id,
      currentStep: escalation.currentStep,
      steps,
      runAt: nextEscalationAt,
    });
  });
}

async function processEscalateJob(
  client: DbClient,
  job: WorkerJob,
): Promise<void> {
  if (job.incidentId === null) {
    throw new Error("Escalation job is missing an incident");
  }

  return client.transaction(async (tx) => {
    const incident = await tx.orm.public.Incident.where({ id: job.incidentId! })
      .forUpdate()
      .first();
    if (!incident || incident.status === "resolved" || incident.acknowledgedAt)
      return;

    const escalation = await tx.orm.public.IncidentEscalation.where({
      incidentId: incident.id,
    })
      .forUpdate()
      .first();
    if (!escalation || escalation.status !== "active") return;

    const maintenanceWindow = await findActiveMaintenanceWindow(tx, {
      companyId: incident.companyId,
      serviceId: incident.serviceId,
      severity: incident.severity as IncidentSeverityValue,
      at: new Date().toISOString(),
    });
    if (maintenanceWindow) {
      await tx.orm.public.QueueJob.where({ id: job.id }).update({
        status: "pending",
        runAt: maintenanceWindow.endsAt,
        lockedUntil: null,
        lastError: `Deferred by maintenance window "${maintenanceWindow.name}"`,
      });
      return;
    }

    const steps = await loadSteps(tx, escalation.policyId);
    const nextStep = policyStep(steps, escalation.currentStep + 1);
    if (!nextStep) {
      await tx.orm.public.IncidentEscalation.where({
        id: escalation.id,
      }).update({
        status: "exhausted",
        nextEscalationAt: null,
      });
      await tx.orm.public.Incident.where({ id: incident.id }).update({
        escalationStatus: "exhausted",
        acknowledgmentDueAt: null,
      });
      await tx.orm.public.IncidentEvent.create({
        incidentId: incident.id,
        eventType: "system",
        message: "Escalation policy exhausted without acknowledgment",
        occurredAt: new Date().toISOString(),
      });
      return;
    }

    await tx.orm.public.IncidentEscalation.where({ id: escalation.id }).update({
      currentStep: nextStep.position,
    });
    const idempotencyKey = `incident:${incident.id}:step:${nextStep.position}:notify`;
    const existingJob = await tx.orm.public.QueueJob.where({
      idempotencyKey,
    }).first();
    if (!existingJob) {
      await tx.orm.public.QueueJob.create({
        companyId: incident.companyId,
        incidentId: incident.id,
        type: "notify",
        status: "pending",
        runAt: new Date().toISOString(),
        attempts: 0,
        idempotencyKey,
        payload: {
          incidentId: incident.id,
          policyId: escalation.policyId,
          step: nextStep.position,
        } as any,
      });
    }
  });
}

export async function processNextQueueJob(
  client: DbClient = defaultDb,
): Promise<boolean> {
  const job = await claimNextJob(client, new Date());
  if (!job) return false;

  try {
    if (job.type === "notify") await processNotifyJob(client, job);
    else await processEscalateJob(client, job);

    const current = await client.orm.public.QueueJob.where({
      id: job.id,
    }).first();
    if (current?.status === "processing") await completeJob(client, job.id);
  } catch (error) {
    console.error(
      `[queue-worker] job ${job.id} failed:`,
      error instanceof Error ? error.message : "unknown",
    );
    await failJob(client, job, error);
  }

  return true;
}

export async function runQueueWorker(
  options: { pollIntervalMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  while (!options.signal?.aborted) {
    const processed = await processNextQueueJob();
    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}
