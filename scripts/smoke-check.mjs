#!/usr/bin/env node

const apiUrl = (process.env.SMOKE_API_URL || 'http://localhost:4000/v1').replace(
  /\/$/,
  '',
);
const webUrl = (process.env.SMOKE_WEB_URL || '').replace(/\/$/, '');

async function check(name, url, assert) {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: 'application/json, text/html' },
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json ok for web checks
  }
  assert(res, json, text);
  console.log(`OK  ${name} (${res.status}, ${ms}ms) — ${url}`);
}

async function main() {
  const failures = [];

  try {
    await check('API liveness', `${apiUrl}/health`, (res, json) => {
      if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
      if (!json?.success || json?.data?.status !== 'ok') {
        throw new Error('unexpected health payload');
      }
    });
  } catch (error) {
    failures.push(`API liveness: ${error.message}`);
  }

  try {
    await check('API readiness', `${apiUrl}/health/ready`, (res, json) => {
      if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
      if (!json?.success || json?.data?.status !== 'ready') {
        throw new Error('service not ready');
      }
      if (json?.data?.checks?.database !== 'up') {
        throw new Error('database check failed');
      }
    });
  } catch (error) {
    failures.push(`API readiness: ${error.message}`);
  }

  if (webUrl) {
    try {
      await check('Web home', webUrl, (res) => {
        if (res.status < 200 || res.status >= 400) {
          throw new Error(`expected 2xx/3xx, got ${res.status}`);
        }
      });
    } catch (error) {
      failures.push(`Web home: ${error.message}`);
    }

    try {
      await check('Web login', `${webUrl}/login`, (res) => {
        if (res.status < 200 || res.status >= 400) {
          throw new Error(`expected 2xx/3xx, got ${res.status}`);
        }
      });
    } catch (error) {
      failures.push(`Web login: ${error.message}`);
    }
  }

  if (failures.length) {
    console.error('\nSmoke check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('\nAll smoke checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
