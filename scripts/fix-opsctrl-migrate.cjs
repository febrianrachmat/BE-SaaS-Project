/**
 * Called when OpsCtrl / start:prod runs migrations.
 * Recovers from failed migrations (P3009/P3018) then reapplies.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const prismaCli = require.resolve('prisma/build/index.js');
const root = path.join(__dirname, '..');

const KNOWN_MIGRATIONS = [
  '20260721100000_init',
  '20260722130000_add_google_oauth',
];

function run(args) {
  execSync(`node "${prismaCli}" ${args}`, {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  });
}

function resolveFailed() {
  for (const name of KNOWN_MIGRATIONS) {
    try {
      run(`migrate resolve --rolled-back ${name}`);
    } catch {
      // already resolved / not failed
    }
  }
}

try {
  run('migrate deploy');
  process.exit(0);
} catch {
  console.warn(
    '[migrate] deploy failed — resolving failed migrations then retrying…',
  );
}

resolveFailed();

try {
  run('migrate deploy');
  process.exit(0);
} catch {
  console.warn('[migrate] second deploy failed — final resolve + retry…');
}

resolveFailed();
run('migrate deploy');
