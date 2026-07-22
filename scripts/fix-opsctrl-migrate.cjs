/**
 * Called by the Prisma CLI wrapper when OpsCtrl runs `prisma migrate deploy`.
 * Clears P3009 (failed init) once, then reapplies migrations.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const prismaCli = require.resolve('prisma/build/index.js');

function run(args) {
  execSync(`node "${prismaCli}" ${args}`, {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
}

try {
  run('migrate deploy');
  process.exit(0);
} catch {
  console.warn(
    '[migrate] deploy failed — resolving failed init migration then retrying…',
  );
}

try {
  run('migrate resolve --rolled-back 20260721100000_init');
} catch {
  console.warn('[migrate] resolve skipped (already resolved or missing)');
}

run('migrate deploy');
