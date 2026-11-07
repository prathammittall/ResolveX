#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f7443ea005c81dea8e650fcee03653f0ae607d44fba9d0fae213eef57e0c89fa/contract';
import endContract from '../../snapshots/f7443ea005c81dea8e650fcee03653f0ae607d44fba9d0fae213eef57e0c89fa/contract.json' with { type: 'json' };
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

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'AlertEvent',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('incidentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('processingStatus', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('providerEventId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('receivedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('serviceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AlertEvent_processingStatus_check_332ce1ba',
            sql`"processingStatus" IN ('pending', 'processed', 'ignored', 'failed')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Company',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Incident',
        columns: [
          col('acknowledgedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('assignedResponderId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('detectedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('serviceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('open'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Incident_severity_check_b5a34339',
            sql`"severity" IN ('sev1', 'sev2', 'sev3', 'sev4')`,
          ),
          checkExpression(
            'Incident_status_check_8d988f5f',
            sql`"status" IN ('open', 'acknowledged', 'investigating', 'mitigated', 'resolved')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'IncidentEvent',
        columns: [
          col('actorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('incidentId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'IncidentEvent_eventType_check_7b7e5669',
            sql`"eventType" IN ('created', 'acknowledged', 'status_change', 'comment', 'assignment', 'resolved', 'system')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Post',
        columns: [
          col('authorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('content', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Service',
        columns: [
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('criticality', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('environment', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('healthStatus', 'text', {
            notNull: true,
            default: lit('unknown'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('monitoredUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('serviceType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Service_criticality_check_17ceeab6',
            sql`"criticality" IN ('low', 'medium', 'high', 'critical')`,
          ),
          checkExpression(
            'Service_environment_check_536025e4',
            sql`"environment" IN ('production', 'staging', 'development')`,
          ),
          checkExpression(
            'Service_healthStatus_check_864775dd',
            sql`"healthStatus" IN ('healthy', 'degraded', 'down', 'unknown')`,
          ),
          checkExpression(
            'Service_serviceType_check_1b3ecf97',
            sql`"serviceType" IN ('http', 'api', 'database', 'queue', 'worker', 'other')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('refreshToken', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('member'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'User_role_check_3fdadd58',
            sql`"role" IN ('owner', 'admin', 'responder', 'member', 'viewer')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'AlertEvent',
        constraint: 'AlertEvent_serviceId_provider_providerEventId_key',
        columns: ['serviceId', 'provider', 'providerEventId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Service',
        constraint: 'Service_companyId_name_key',
        columns: ['companyId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AlertEvent',
        index: 'AlertEvent_incidentId_idx_20b6f3c9',
        columns: ['incidentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AlertEvent',
        index: 'AlertEvent_processingStatus_idx_6f216ba4',
        columns: ['processingStatus'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AlertEvent',
        index: 'AlertEvent_receivedAt_idx_9e532856',
        columns: ['receivedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AlertEvent',
        index: 'AlertEvent_serviceId_idx_b5d9acbf',
        columns: ['serviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Company',
        index: 'Company_name_idx_ce87e6ba',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'Incident_assignedResponderId_idx_875d53ec',
        columns: ['assignedResponderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'Incident_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'Incident_companyId_severity_idx_90a18f52',
        columns: ['companyId', 'severity'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'Incident_companyId_status_idx_86f6fb02',
        columns: ['companyId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'Incident_serviceId_idx_b5d9acbf',
        columns: ['serviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Incident',
        index: 'incident_one_unresolved_per_service_d6ea26f8',
        columns: ['serviceId'],
        extras: { where: sql`(status <> 'resolved')`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'IncidentEvent',
        index: 'IncidentEvent_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'IncidentEvent',
        index: 'IncidentEvent_incidentId_idx_20b6f3c9',
        columns: ['incidentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'IncidentEvent',
        index: 'IncidentEvent_incidentId_occurredAt_idx_d02cf665',
        columns: ['incidentId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Post',
        index: 'Post_authorId_idx_e47547ed',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Service',
        index: 'Service_companyId_environment_idx_419a7d88',
        columns: ['companyId', 'environment'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Service',
        index: 'Service_companyId_healthStatus_idx_5d60ac2e',
        columns: ['companyId', 'healthStatus'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Service',
        index: 'Service_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_companyId_role_idx_0ce20beb',
        columns: ['companyId', 'role'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AlertEvent',
        foreignKey: {
          name: 'AlertEvent_serviceId_fkey',
          columns: ['serviceId'],
          references: { schema: 'public', table: 'Service', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AlertEvent',
        foreignKey: {
          name: 'AlertEvent_incidentId_fkey',
          columns: ['incidentId'],
          references: { schema: 'public', table: 'Incident', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Incident',
        foreignKey: {
          name: 'Incident_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Incident',
        foreignKey: {
          name: 'Incident_serviceId_fkey',
          columns: ['serviceId'],
          references: { schema: 'public', table: 'Service', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Incident',
        foreignKey: {
          name: 'Incident_assignedResponderId_fkey',
          columns: ['assignedResponderId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'IncidentEvent',
        foreignKey: {
          name: 'IncidentEvent_incidentId_fkey',
          columns: ['incidentId'],
          references: { schema: 'public', table: 'Incident', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'IncidentEvent',
        foreignKey: {
          name: 'IncidentEvent_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Post',
        foreignKey: {
          name: 'Post_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Service',
        foreignKey: {
          name: 'Service_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'User',
        foreignKey: {
          name: 'User_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
