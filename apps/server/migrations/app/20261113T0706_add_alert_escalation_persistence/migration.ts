#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/87ea269d75fc85c753eb2548f6e8bb34459722889464a3c143cb499d27e57f6e/contract';
import startContract from '../../snapshots/87ea269d75fc85c753eb2548f6e8bb34459722889464a3c143cb499d27e57f6e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e0225e76588acf769ae388baedd5be441cdd19c6dfed7b7351ac03af5a98f258/contract';
import endContract from '../../snapshots/e0225e76588acf769ae388baedd5be441cdd19c6dfed7b7351ac03af5a98f258/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'EscalationPolicy',
        columns: [
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('serviceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'EscalationStep',
        columns: [
          col('acknowledgmentRequired', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('delaySeconds', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notificationChannels', 'jsonb', {
            notNull: true,
            codecRef: { codecId: 'pg/jsonb@1' },
          }),
          col('policyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('targetId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('targetType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'EscalationStep_targetType_check_17501856',
            sql`"targetType" IN ('user', 'team', 'webhook')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'IncidentEscalation',
        columns: [
          col('acknowledgedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currentStep', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('incidentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nextEscalationAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('policyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('active'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'IncidentEscalation_status_check_734f4e01',
            sql`"status" IN ('active', 'acknowledged', 'exhausted', 'cancelled')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'MaintenanceWindow',
        columns: [
          col('bypassSeverity', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('enabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('endsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('serviceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('timezone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'MaintenanceWindow_bypassSeverity_check_e5dcd509',
            sql`"bypassSeverity" IN ('sev1', 'sev2', 'sev3', 'sev4')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'NotificationDelivery',
        columns: [
          col('acknowledgedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('channel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('incidentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('queueJobId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('recipient', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'NotificationDelivery_status_check_bb8816fa',
            sql`"status" IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'QueueJob',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('incidentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lockedUntil', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('runAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'QueueJob_status_check_d8313f9b',
            sql`"status" IN ('pending', 'processing', 'completed', 'failed', 'cancelled')`,
          ),
          checkExpression('QueueJob_type_check_9fc40b9f', sql`"type" IN ('escalate', 'notify')`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Incident',
        column: col('acknowledgmentDueAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Incident',
        column: col('escalationPolicyId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Incident',
        column: col('escalationStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Incident',
        column: col('firstAcknowledgedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Incident',
        column: col('mttaSeconds', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'EscalationPolicy',
        constraint: 'EscalationPolicy_companyId_name_key',
        columns: ['companyId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'EscalationStep',
        constraint: 'EscalationStep_policyId_position_key',
        columns: ['policyId', 'position'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Incident',
        constraint: 'Incident_escalationStatus_check_d92203ad',
        expression: sql`"escalationStatus" IN ('active', 'acknowledged', 'exhausted', 'cancelled')`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'IncidentEscalation',
        constraint: 'IncidentEscalation_incidentId_key',
        columns: ['incidentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'NotificationDelivery',
        constraint: 'NotificationDelivery_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'QueueJob',
        constraint: 'QueueJob_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EscalationPolicy',
        index: 'EscalationPolicy_companyId_enabled_idx_0f7516a0',
        columns: ['companyId', 'enabled'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EscalationPolicy',
        index: 'EscalationPolicy_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EscalationPolicy',
        index: 'EscalationPolicy_serviceId_enabled_idx_71358b09',
        columns: ['serviceId', 'enabled'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EscalationPolicy',
        index: 'EscalationPolicy_serviceId_idx_b5d9acbf',
        columns: ['serviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EscalationStep',
        index: 'EscalationStep_policyId_idx_17c369b7',
        columns: ['policyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'Incident_escalationPolicyId_idx_b1f620eb',
        columns: ['escalationPolicyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'IncidentEscalation',
        index: 'IncidentEscalation_policyId_idx_17c369b7',
        columns: ['policyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'IncidentEscalation',
        index: 'IncidentEscalation_status_nextEscalationAt_idx_94a105ce',
        columns: ['status', 'nextEscalationAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MaintenanceWindow',
        index: 'MaintenanceWindow_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MaintenanceWindow',
        index: 'MaintenanceWindow_companyId_startsAt_endsAt_idx_52b53cdb',
        columns: ['companyId', 'startsAt', 'endsAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MaintenanceWindow',
        index: 'MaintenanceWindow_createdById_idx_8bf640ed',
        columns: ['createdById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MaintenanceWindow',
        index: 'MaintenanceWindow_serviceId_idx_b5d9acbf',
        columns: ['serviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MaintenanceWindow',
        index: 'MaintenanceWindow_serviceId_startsAt_endsAt_idx_e4925605',
        columns: ['serviceId', 'startsAt', 'endsAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_companyId_incidentId_idx_5b953ff6',
        columns: ['companyId', 'incidentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_incidentId_idx_20b6f3c9',
        columns: ['incidentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_incidentId_status_idx_da8bb603',
        columns: ['incidentId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_queueJobId_idx_1f5ee8c1',
        columns: ['queueJobId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QueueJob',
        index: 'QueueJob_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QueueJob',
        index: 'QueueJob_companyId_status_runAt_idx_3c51a5a7',
        columns: ['companyId', 'status', 'runAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QueueJob',
        index: 'QueueJob_incidentId_idx_20b6f3c9',
        columns: ['incidentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'QueueJob',
        index: 'QueueJob_status_runAt_idx_97459e4a',
        columns: ['status', 'runAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EscalationPolicy',
        foreignKey: {
          name: 'EscalationPolicy_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EscalationPolicy',
        foreignKey: {
          name: 'EscalationPolicy_serviceId_fkey',
          columns: ['serviceId'],
          references: { schema: 'public', table: 'Service', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EscalationStep',
        foreignKey: {
          name: 'EscalationStep_policyId_fkey',
          columns: ['policyId'],
          references: { schema: 'public', table: 'EscalationPolicy', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Incident',
        foreignKey: {
          name: 'Incident_escalationPolicyId_fkey',
          columns: ['escalationPolicyId'],
          references: { schema: 'public', table: 'EscalationPolicy', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'IncidentEscalation',
        foreignKey: {
          name: 'IncidentEscalation_incidentId_fkey',
          columns: ['incidentId'],
          references: { schema: 'public', table: 'Incident', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'IncidentEscalation',
        foreignKey: {
          name: 'IncidentEscalation_policyId_fkey',
          columns: ['policyId'],
          references: { schema: 'public', table: 'EscalationPolicy', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MaintenanceWindow',
        foreignKey: {
          name: 'MaintenanceWindow_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MaintenanceWindow',
        foreignKey: {
          name: 'MaintenanceWindow_serviceId_fkey',
          columns: ['serviceId'],
          references: { schema: 'public', table: 'Service', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MaintenanceWindow',
        foreignKey: {
          name: 'MaintenanceWindow_createdById_fkey',
          columns: ['createdById'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'NotificationDelivery',
        foreignKey: {
          name: 'NotificationDelivery_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'NotificationDelivery',
        foreignKey: {
          name: 'NotificationDelivery_incidentId_fkey',
          columns: ['incidentId'],
          references: { schema: 'public', table: 'Incident', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'NotificationDelivery',
        foreignKey: {
          name: 'NotificationDelivery_queueJobId_fkey',
          columns: ['queueJobId'],
          references: { schema: 'public', table: 'QueueJob', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'QueueJob',
        foreignKey: {
          name: 'QueueJob_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'QueueJob',
        foreignKey: {
          name: 'QueueJob_incidentId_fkey',
          columns: ['incidentId'],
          references: { schema: 'public', table: 'Incident', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
