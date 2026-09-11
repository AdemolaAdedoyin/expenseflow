import { spawnSync } from 'node:child_process';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/expenseflow_test?schema=public';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: options.env ?? process.env,
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function databaseName(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (!name.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run regression tests against "${name || 'unknown'}". TEST_DATABASE_URL must target a database whose name contains "test".`,
    );
  }

  return name;
}

function prepareDefaultLocalDatabase() {
  console.log('Preparing local PostgreSQL and Redis services...');
  run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);

  const exists = capture('docker', [
    'compose',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-tAc',
    "SELECT 1 FROM pg_database WHERE datname = 'expenseflow_test'",
  ]);

  if (exists !== '1') {
    console.log('Creating isolated expenseflow_test database...');
    run('docker', [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'CREATE DATABASE expenseflow_test',
    ]);
  }
}

const configuredTestUrl = process.env.TEST_DATABASE_URL;
const testDatabaseUrl = configuredTestUrl ?? DEFAULT_TEST_DATABASE_URL;
const testDatabaseName = databaseName(testDatabaseUrl);

// The default path is deliberately self-contained for local development: it starts
// the Compose dependencies and creates the disposable test DB if needed. Advanced
// environments can set TEST_DATABASE_URL to use an already-provisioned test DB.
if (!configuredTestUrl) {
  prepareDefaultLocalDatabase();
}

const testEnv = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  REDIS_URL: process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379',
};

console.log(`Running regression suite against ${testDatabaseName}...`);

run('npm', ['run', 'db:generate'], { env: testEnv });
run('npm', ['run', 'db:deploy'], { env: testEnv });
run('npm', ['test'], { env: testEnv });
run('npm', ['run', 'test:integration'], { env: testEnv });
run('npm', ['run', 'test:e2e'], { env: testEnv });
run('npm', ['run', 'build'], { env: testEnv });

console.log('Regression suite completed successfully.');
