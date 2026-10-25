import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// Load apps/server/.env even when the process cwd is apps/web (Next.js).
dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
