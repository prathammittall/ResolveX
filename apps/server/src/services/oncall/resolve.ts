import { db } from '../../prisma/db.js';

export type ScheduleLike = {
  id: number;
  rotationHours: number;
  rotationStart: string;
  participants: unknown;
};

export type OverrideLike = { userId: number; startsAt: string; endsAt: string };

export function participantIds(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v) && v > 0) : [];
}

/**
 * Who is on call at `at`: participants hand off in order every `rotationHours` starting at `rotationStart`.
 * The secondary is the next person in the rotation. An active override replaces the primary.
 */
export function onCallAt(schedule: ScheduleLike, overrides: OverrideLike[], at: Date = new Date()) {
  const people = participantIds(schedule.participants);
  const t = at.getTime();
  const override = overrides.find((o) => Date.parse(o.startsAt) <= t && t < Date.parse(o.endsAt));
  if (people.length === 0) {
    return { primary: override?.userId ?? null, secondary: null, shiftStart: null, shiftEnd: null, overridden: Boolean(override) };
  }
  const start = Date.parse(schedule.rotationStart);
  const len = Math.max(schedule.rotationHours, 1) * 3_600_000;
  const elapsed = Math.max(t - start, 0);
  const index = Math.floor(elapsed / len);
  const shiftStart = new Date(start + index * len);
  const shiftEnd = new Date(start + (index + 1) * len);
  const rotPrimary = people[index % people.length]!;
  const rotSecondary = people.length > 1 ? people[(index + 1) % people.length]! : null;
  return {
    primary: override?.userId ?? rotPrimary,
    secondary: override ? rotPrimary : rotSecondary,
    shiftStart: shiftStart.toISOString(),
    shiftEnd: shiftEnd.toISOString(),
    overridden: Boolean(override),
  };
}

/** Upcoming shifts for a calendar view. */
export function shiftsBetween(schedule: ScheduleLike, from: Date, to: Date, max = 200) {
  const people = participantIds(schedule.participants);
  if (people.length === 0) return [];
  const start = Date.parse(schedule.rotationStart);
  const len = Math.max(schedule.rotationHours, 1) * 3_600_000;
  let index = Math.max(Math.floor((from.getTime() - start) / len), 0);
  const shifts: Array<{ userId: number; startsAt: string; endsAt: string }> = [];
  while (shifts.length < max) {
    const s = start + index * len;
    if (s >= to.getTime()) break;
    shifts.push({ userId: people[index % people.length]!, startsAt: new Date(s).toISOString(), endsAt: new Date(s + len).toISOString() });
    index++;
  }
  return shifts;
}

export async function currentOnCallForSchedule(scheduleId: number, companyId: number, at = new Date()) {
  const schedule = await db.orm.public.OnCallSchedule.where({ id: scheduleId, companyId }).first();
  if (!schedule) return null;
  const overrides = await db.orm.public.OnCallOverride.where({ scheduleId }).all();
  return onCallAt(schedule, overrides, at);
}

/** Primary on-call for a team (first schedule of that team), used to route incidents without an owner. */
export async function currentOnCallForTeam(companyId: number, teamId: string | null, at = new Date()): Promise<number | null> {
  const schedules = await db.orm.public.OnCallSchedule.where({ companyId }).all();
  const pick = schedules.find((s) => teamId && s.teamId === teamId) ?? (teamId ? undefined : schedules[0]);
  if (!pick) return null;
  const overrides = await db.orm.public.OnCallOverride.where({ scheduleId: pick.id }).all();
  return onCallAt(pick, overrides, at).primary;
}
