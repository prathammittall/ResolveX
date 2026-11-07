#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0a03ea8ff9641836278d7d8b22a20ebf811bb4dbc4e194ace45c2e70f5350c90/contract';
import startContract from '../../snapshots/0a03ea8ff9641836278d7d8b22a20ebf811bb4dbc4e194ace45c2e70f5350c90/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/33f61d869c86fb049ec3a74959ae03d3b71ae25b701cdb41f004db48a5901cc2/contract';
import endContract from '../../snapshots/33f61d869c86fb049ec3a74959ae03d3b71ae25b701cdb41f004db48a5901cc2/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
  sql,
} from '@prisma/orm-postgres/migration';


/** A hand-written statement wrapped in the planner's operation shape (precheck/execute/postcheck). */
function statement(id: string, label: string, table: string, sqlText: string, operationClass: 'additive' | 'data' = 'additive') {
  return rawSql({
    id,
    label,
    summary: label,
    operationClass,
    target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: table } },
    precheck: [],
    execute: [{ description: label, sql: sqlText, params: [] }],
    postcheck: [],
  } as never);
}

const BACKFILL_ORGANIZATIONS = `
INSERT INTO "public"."Organization" ("id", "name", "slug", "companyId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."name",
       lower(trim(both '-' from regexp_replace(c."name", '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || c."id",
       c."id", c."createdAt", c."updatedAt"
FROM "public"."Company" c
WHERE NOT EXISTS (SELECT 1 FROM "public"."Organization" o WHERE o."companyId" = c."id")`;

const BACKFILL_MEMBERSHIPS = `
INSERT INTO "public"."Membership" ("id", "organizationId", "userId", "role", "createdAt")
SELECT gen_random_uuid(), o."id", u."id", u."role", u."createdAt"
FROM "public"."User" u
JOIN "public"."Organization" o ON o."companyId" = u."companyId"
ON CONFLICT ("organizationId", "userId") DO NOTHING`;

const TENANT_TABLES = ['Organization', 'Membership', 'Invitation', 'Team', 'TeamMember', 'AuditLog'];

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('metadata', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('requestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Invitation',
        columns: [
          col('acceptedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invitedById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('member'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Invitation_role_check_3fdadd58',
            sql`"role" IN ('owner', 'admin', 'responder', 'member', 'viewer')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Membership',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('member'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Membership_role_check_3fdadd58',
            sql`"role" IN ('owner', 'admin', 'responder', 'member', 'viewer')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Organization',
        columns: [
          col('companyId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Team',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'TeamMember',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('isLead', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('teamId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Invitation',
        constraint: 'Invitation_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Membership',
        constraint: 'Membership_organizationId_userId_key',
        columns: ['organizationId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Organization',
        constraint: 'Organization_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Organization',
        constraint: 'Organization_companyId_key',
        columns: ['companyId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Team',
        constraint: 'Team_organizationId_name_key',
        columns: ['organizationId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'TeamMember',
        constraint: 'TeamMember_teamId_userId_key',
        columns: ['teamId', 'userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_createdAt_idx_c52d1cc3',
        columns: ['organizationId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_entityType_entityId_idx_120e40ec',
        columns: ['organizationId', 'entityType', 'entityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invitation',
        index: 'Invitation_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invitation',
        index: 'Invitation_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invitation',
        index: 'invitation_one_pending_per_email_a6702b91',
        columns: ['organizationId', 'email'],
        extras: { where: sql`("acceptedAt" IS NULL AND "revokedAt" IS NULL)`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Membership',
        index: 'Membership_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Membership',
        index: 'Membership_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Team',
        index: 'Team_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TeamMember',
        index: 'TeamMember_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TeamMember',
        index: 'TeamMember_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TeamMember',
        index: 'TeamMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AuditLog',
        foreignKey: {
          name: 'AuditLog_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Invitation',
        foreignKey: {
          name: 'Invitation_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Membership',
        foreignKey: {
          name: 'Membership_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Membership',
        foreignKey: {
          name: 'Membership_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Organization',
        foreignKey: {
          name: 'Organization_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Team',
        foreignKey: {
          name: 'Team_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TeamMember',
        foreignKey: {
          name: 'TeamMember_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TeamMember',
        foreignKey: {
          name: 'TeamMember_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'Team', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TeamMember',
        foreignKey: {
          name: 'TeamMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'AuditLog' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Invitation' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Membership' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Organization' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Team' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'TeamMember' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'AuditLog',
        policy: {
          naming: { kind: 'wire', prefix: 'audit_log_isolation', hash: '56e94fc5' },
          tableName: 'AuditLog',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Invitation',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_isolation', hash: '56e94fc5' },
          tableName: 'Invitation',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Membership',
        policy: {
          naming: { kind: 'wire', prefix: 'membership_isolation', hash: '56e94fc5' },
          tableName: 'Membership',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Membership',
        policy: {
          naming: { kind: 'wire', prefix: 'membership_self_read', hash: 'dfc6391f' },
          tableName: 'Membership',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: sql`"userId" = NULLIF(current_setting('app.user_id', true), '')::int`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Organization',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_isolation', hash: '70de70f9' },
          tableName: 'Organization',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"id" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"id" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Organization',
        policy: {
          naming: { kind: 'wire', prefix: 'organization_member_read', hash: '9acd85c7' },
          tableName: 'Organization',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: sql`EXISTS (SELECT 1 FROM "Membership" m WHERE m."organizationId" = "Organization"."id" AND m."userId" = NULLIF(current_setting('app.user_id', true), '')::int)`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Team',
        policy: {
          naming: { kind: 'wire', prefix: 'team_isolation', hash: '56e94fc5' },
          tableName: 'Team',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'TeamMember',
        policy: {
          naming: { kind: 'wire', prefix: 'team_member_isolation', hash: '56e94fc5' },
          tableName: 'TeamMember',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      // Existing Company/User rows become Organization/Membership rows (no data is dropped or changed).
      statement('data.backfillOrganizations', 'Backfill organizations from companies', 'Organization', BACKFILL_ORGANIZATIONS, 'data'),
      statement('data.backfillMemberships', 'Backfill memberships from users', 'Membership', BACKFILL_MEMBERSHIPS, 'data'),
      // FORCE makes the policies apply to the table owner too, so RLS still protects tenants if the app
      // connects with the owning role (the default on managed Postgres).
      ...TENANT_TABLES.map((table) =>
        statement(`rls.force.${table}`, `Force row level security on ${table}`, table, `ALTER TABLE "public"."${table}" FORCE ROW LEVEL SECURITY`),
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
