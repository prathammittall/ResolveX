import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// .env.test first: dotenv never overrides an already-set variable, so the disposable test database
// wins over any DATABASE_URL in .env and tests cannot reach real data by accident.
dotenv.config({ path: path.join(here, '.env.test') });
dotenv.config({ path: path.join(here, '.env') });

const url = process.env['DATABASE_URL'] ?? '';
if (!/@(localhost|127\.0\.0\.1):\d+\//.test(url) && process.env['ALLOW_REMOTE_TEST_DB'] !== '1') {
  throw new Error(
    'Refusing to run tests against a non-local database. Copy .env.test.example to .env.test and start docker-compose.test.yml.',
  );
}

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL must be set in apps/server/.env for tests');
}
