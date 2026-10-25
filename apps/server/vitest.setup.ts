import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env'),
});

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL must be set in apps/server/.env for tests');
}
