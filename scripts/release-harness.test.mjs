import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { percentile95, qualify, reviewToolPreflight } from './release-support.mjs';
test('nearest-rank p95 retains all samples and rejects invalid/empty inputs', () => {
  const samples = Array.from({ length: 20 }, (_, n) => n + 1);
  assert.equal(percentile95(samples), 19);
  assert.equal(samples[0], 1);
  for (const invalid of [[], [NaN], [-1], [Infinity]]) assert.throws(() => percentile95(invalid));
});
test('dataset qualification cannot use inherited completion or rejected action padding', () => {
  const run = {
    attempts: Array.from({ length: 26 }, (_, i) => ({
      baselineEventCount: 1,
      incident: {
        scenarioId: `INC-${i + 1}`,
        completionReached: true,
        eventLog: [{ type: 'completion_reached' }],
      },
    })),
    operations: [],
  };
  assert.throws(() => qualify(run));
  for (const attempt of run.attempts)
    attempt.incident.eventLog.push({ type: 'completion_reached' });
  assert.equal(qualify(run).completedIncidents.length, 26);
  assert.throws(() => qualify(run, true));
});
test('missing packaging tool/plugin causes a non-mutating preflight rejection', () => {
  assert.equal(reviewToolPreflight({ LOCALAPPDATA: 'C:/fixture' }, () => false).ok, false);
  assert.equal(reviewToolPreflight({}, () => true).ok, false);
  assert.equal(
    reviewToolPreflight({ LOCALAPPDATA: 'C:/fixture' }, () => true).code,
    'UNVERIFIED_TOOL_CACHE',
  );
});
test('manifest corruption is rejected before running any tool', () => {
  assert.equal(
    reviewToolPreflight(
      { LOCALAPPDATA: 'C:/fixture' },
      () => true,
      () => Buffer.from('{}'),
    ).ok,
    false,
  );
});
test('review overlay keeps real entry, isolated profile, runtime skip and unsigned current-user scope', () => {
  const review = JSON.parse(
    readFileSync(new URL('../src-tauri/tauri.review.conf.json', import.meta.url), 'utf8'),
  );
  const production = JSON.parse(
    readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  );
  assert.equal(production.identifier, 'com.vantage.orpheus');
  // Production bundling is enabled with the repository icons and is never signed here.
  assert.equal(production.bundle.active, true);
  assert.equal(production.bundle.windows?.signCommand, undefined);
  assert.equal(production.bundle.windows?.certificateThumbprint, undefined);
  // A strict CSP is inherited by the review overlay (which declares no security block).
  assert.equal(production.app.security.csp['default-src'], "'self'");
  assert.equal(production.app.security.csp['script-src'], "'self'");
  assert.equal(production.app.security.csp['style-src'], "'self'");
  assert.doesNotMatch(JSON.stringify(production.app.security.csp), /https?:\/\/(?!ipc\.localhost)/);
  assert.equal(review.identifier, 'com.vantage.orpheus.review');
  assert.equal(review.app.windows[0].label, 'qa034');
  assert.equal(review.app.windows[0].dataDirectory, 'review-v1');
  assert.equal(review.build.frontendDist, '../.qa/review/web');
  assert.equal(review.bundle.windows.webviewInstallMode.type, 'skip');
  assert.equal(review.bundle.windows.nsis.installMode, 'currentUser');
  assert.equal(review.app.security, undefined);
  assert.equal(review.bundle.windows.signCommand, undefined);
});
