#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/33f61d869c86fb049ec3a74959ae03d3b71ae25b701cdb41f004db48a5901cc2/contract';
import startContract from '../../snapshots/33f61d869c86fb049ec3a74959ae03d3b71ae25b701cdb41f004db48a5901cc2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7003189e9b1c47405434bf890480e2f77161de859febb9516527052d49e61981/contract';
import endContract from '../../snapshots/7003189e9b1c47405434bf890480e2f77161de859febb9516527052d49e61981/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createRlsPolicy({
        schema: 'public',
        table: 'Invitation',
        policy: {
          naming: { kind: 'wire', prefix: 'invitation_by_token', hash: '815ba959' },
          tableName: 'Invitation',
          namespaceId: 'public',
          operation: 'select',
          roles: [],
          using: sql`"tokenHash" = NULLIF(current_setting('app.invite_hash', true), '')`,
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
