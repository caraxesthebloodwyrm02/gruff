#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve(process.cwd(), 'router_agents.json');
const payload = JSON.parse(readFileSync(configPath, 'utf8'));

const tiers = new Set(['hold', 'practice', 'school']);

function fail(msg) {
  console.error(`route-config smoke failed: ${msg}`);
  process.exit(2);
}

if (payload.schemaVersion !== 'gruff-router-config-v1') {
  fail(`unexpected schemaVersion: ${payload.schemaVersion}`);
}
if (!payload.policyVersion || typeof payload.policyVersion !== 'string') {
  fail('policyVersion missing');
}
if (!payload.chains || typeof payload.chains !== 'object') {
  fail('chains missing');
}
if (!payload.defaultChain || !Array.isArray(payload.chains[payload.defaultChain])) {
  fail('defaultChain invalid');
}
if (!tiers.has(payload.defaultUnknownActorTier)) {
  fail('defaultUnknownActorTier invalid');
}
if (!payload.toolPolicies || typeof payload.toolPolicies !== 'object') {
  fail('toolPolicies missing');
}
if (!payload.toolPolicies['*']) {
  fail("'*' fallback tool policy missing");
}
for (const [tool, policy] of Object.entries(payload.toolPolicies)) {
  if (!policy || typeof policy !== 'object') fail(`invalid policy for ${tool}`);
  if (!tiers.has(policy.maxTier)) fail(`invalid maxTier for ${tool}`);
  if (!policy.chain || !Array.isArray(payload.chains[policy.chain])) {
    fail(`unknown chain for ${tool}`);
  }
}

console.log(`route-config smoke OK (${configPath})`);
