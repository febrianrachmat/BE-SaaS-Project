#!/bin/sh
# Intercept OpsCtrl's `prisma migrate deploy` and recover from P3009.
if [ "$1" = "migrate" ] && [ "$2" = "deploy" ]; then
  exec node /app/scripts/fix-opsctrl-migrate.cjs
fi
exec node /app/node_modules/prisma/build/index.js "$@"
