/**
 * OpsCtrl migrate job runs `prisma migrate deploy`.
 * If a previous init attempt failed (P3009), mark it rolled back once then redeploy.
 */
const { execSync } = require('node:child_process');

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

try {
  run('npx prisma migrate deploy');
  process.exit(0);
} catch {
  console.warn(
    '[migrate] deploy failed — resolving failed init migration then retrying…',
  );
}

try {
  run('npx prisma migrate resolve --rolled-back 20260721100000_init');
} catch {
  console.warn('[migrate] resolve skipped (already resolved or missing)');
}

run('npx prisma migrate deploy');
