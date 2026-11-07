#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0a03ea8ff9641836278d7d8b22a20ebf811bb4dbc4e194ace45c2e70f5350c90/contract';
import endContract from '../../snapshots/0a03ea8ff9641836278d7d8b22a20ebf811bb4dbc4e194ace45c2e70f5350c90/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fd0271d5f1d204a7c576b1af8318f201e1681f4c75de95ae4e539f19c68ae4df/contract';
import startContract from '../../snapshots/fd0271d5f1d204a7c576b1af8318f201e1681f4c75de95ae4e539f19c68ae4df/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'WebhookKey',
        columns: [
          col('companyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('createdById', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('keyHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('keyPrefix', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastUsedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('serviceId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WebhookKey',
        constraint: 'WebhookKey_keyHash_key',
        columns: ['keyHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebhookKey',
        index: 'WebhookKey_companyId_idx_33acc5ed',
        columns: ['companyId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebhookKey',
        index: 'WebhookKey_serviceId_idx_b5d9acbf',
        columns: ['serviceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebhookKey',
        foreignKey: {
          name: 'WebhookKey_companyId_fkey',
          columns: ['companyId'],
          references: { schema: 'public', table: 'Company', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebhookKey',
        foreignKey: {
          name: 'WebhookKey_serviceId_fkey',
          columns: ['serviceId'],
          references: { schema: 'public', table: 'Service', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
