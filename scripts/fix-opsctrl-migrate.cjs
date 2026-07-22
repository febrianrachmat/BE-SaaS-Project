/**
 * Called when OpsCtrl / start:prod runs migrations.
 * Recovers from P3009/P3018 (failed init) then reapplies.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const prismaCli = require.resolve('prisma/build/index.js');
const root = path.join(__dirname, '..');

function run(args) {
  execSync(`node "${prismaCli}" ${args}`, {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  });
}

function resolveFailedInit() {
  try {
    run('migrate resolve --rolled-back 20260721100000_init');
  } catch {
    console.warn('[migrate] resolve skipped (already resolved or missing)');
  }
}

try {
  run('migrate deploy');
  process.exit(0);
} catch {
  console.warn(
    '[migrate] deploy failed — resolving failed init migration then retrying…',
  );
}

resolveFailedInit();

try {
  run('migrate deploy');
  process.exit(0);
} catch {
  console.warn('[migrate] second deploy failed — resolving again and final retry…');
}

resolveFailedInit();
run('migrate deploy');
