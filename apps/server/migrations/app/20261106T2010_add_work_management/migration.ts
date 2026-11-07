#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7003189e9b1c47405434bf890480e2f77161de859febb9516527052d49e61981/contract';
import startContract from '../../snapshots/7003189e9b1c47405434bf890480e2f77161de859febb9516527052d49e61981/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/87ea269d75fc85c753eb2548f6e8bb34459722889464a3c143cb499d27e57f6e/contract';
import endContract from '../../snapshots/87ea269d75fc85c753eb2548f6e8bb34459722889464a3c143cb499d27e57f6e/contract.json' with { type: 'json' };
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


function forceRls(table: string) {
  return rawSql({
    id: `rls.force.${table}`,
    label: `Force row level security on ${table}`,
    summary: `Force row level security on ${table}`,
    operationClass: 'additive',
    target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: table } },
    precheck: [],
    execute: [{ description: `force rls on ${table}`, sql: `ALTER TABLE "public"."${table}" FORCE ROW LEVEL SECURITY`, params: [] }],
    postcheck: [],
  } as never);
}

const WORK_TABLES = ['Project', 'ProjectStatus', 'Task', 'TaskComment', 'TaskActivity'];

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Project',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nextTaskNumber', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
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
        table: 'ProjectStatus',
        columns: [
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ProjectStatus_category_check_91dfd504',
            sql`"category" IN ('todo', 'in_progress', 'done')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Task',
        columns: [
          col('assigneeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dueDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('labels', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('number', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('parentId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('priority', 'text', {
            notNull: true,
            default: lit('medium'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('reporterId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('statusId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', {
            notNull: true,
            default: lit('task'),
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
            'Task_priority_check_a3ab9160',
            sql`"priority" IN ('lowest', 'low', 'medium', 'high', 'highest')`,
          ),
          checkExpression(
            'Task_type_check_422adb3e',
            sql`"type" IN ('epic', 'story', 'task', 'bug', 'subtask')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'TaskActivity',
        columns: [
          col('actorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('data', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'TaskComment',
        columns: [
          col('authorId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('organizationId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('taskId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Project',
        constraint: 'Project_organizationId_key_key',
        columns: ['organizationId', 'key'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProjectStatus',
        constraint: 'ProjectStatus_projectId_name_key',
        columns: ['projectId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Task',
        constraint: 'Task_projectId_number_key',
        columns: ['projectId', 'number'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Project',
        index: 'Project_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectStatus',
        index: 'ProjectStatus_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectStatus',
        index: 'ProjectStatus_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProjectStatus',
        index: 'ProjectStatus_projectId_position_idx_8e0c4225',
        columns: ['projectId', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_assigneeId_idx_fd12ae38',
        columns: ['assigneeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_organizationId_assigneeId_idx_89fcb564',
        columns: ['organizationId', 'assigneeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_parentId_idx_6a68f597',
        columns: ['parentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_projectId_statusId_idx_5699d1ea',
        columns: ['projectId', 'statusId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_reporterId_idx_aa245831',
        columns: ['reporterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_statusId_idx_e5a44bce',
        columns: ['statusId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskActivity',
        index: 'TaskActivity_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskActivity',
        index: 'TaskActivity_taskId_createdAt_idx_f41547ff',
        columns: ['taskId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskActivity',
        index: 'TaskActivity_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskComment',
        index: 'TaskComment_authorId_idx_e47547ed',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskComment',
        index: 'TaskComment_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskComment',
        index: 'TaskComment_taskId_createdAt_idx_f41547ff',
        columns: ['taskId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TaskComment',
        index: 'TaskComment_taskId_idx_4965c936',
        columns: ['taskId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Project',
        foreignKey: {
          name: 'Project_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectStatus',
        foreignKey: {
          name: 'ProjectStatus_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProjectStatus',
        foreignKey: {
          name: 'ProjectStatus_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_statusId_fkey',
          columns: ['statusId'],
          references: { schema: 'public', table: 'ProjectStatus', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_assigneeId_fkey',
          columns: ['assigneeId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_reporterId_fkey',
          columns: ['reporterId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskActivity',
        foreignKey: {
          name: 'TaskActivity_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskActivity',
        foreignKey: {
          name: 'TaskActivity_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskComment',
        foreignKey: {
          name: 'TaskComment_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskComment',
        foreignKey: {
          name: 'TaskComment_taskId_fkey',
          columns: ['taskId'],
          references: { schema: 'public', table: 'Task', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TaskComment',
        foreignKey: {
          name: 'TaskComment_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Project' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'ProjectStatus' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Task' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'TaskActivity' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'TaskComment' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Project',
        policy: {
          naming: { kind: 'wire', prefix: 'project_isolation', hash: '56e94fc5' },
          tableName: 'Project',
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
        table: 'ProjectStatus',
        policy: {
          naming: { kind: 'wire', prefix: 'project_status_isolation', hash: '56e94fc5' },
          tableName: 'ProjectStatus',
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
        table: 'Task',
        policy: {
          naming: { kind: 'wire', prefix: 'task_isolation', hash: '56e94fc5' },
          tableName: 'Task',
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
        table: 'TaskActivity',
        policy: {
          naming: { kind: 'wire', prefix: 'task_activity_isolation', hash: '56e94fc5' },
          tableName: 'TaskActivity',
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
        table: 'TaskComment',
        policy: {
          naming: { kind: 'wire', prefix: 'task_comment_isolation', hash: '56e94fc5' },
          tableName: 'TaskComment',
          namespaceId: 'public',
          operation: 'all',
          roles: [],
          using: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          withCheck: sql`"organizationId" = NULLIF(current_setting('app.org_id', true), '')::uuid`,
          permissive: true,
        },
      }),
      // FORCE makes the policies apply to the table owner too (managed Postgres owners otherwise bypass RLS).
      ...WORK_TABLES.map(forceRls),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
