#!/usr/bin/env node
// Two-stage release gate, pure rules with no model calls.
//
// Stage 1 - armed: the batch since the last version tag is big enough
//   (minBatch eligible commits) OR it has been dragging on long enough
//   (maxHours with at least one eligible commit). Only release-worthy
//   Conventional Commits prefixes are counted; ci/test/docs/style/chore/build
//   commits neither count nor release.
// Stage 2 - trigger: once armed, the next eligible commit at the head is the
//   release boundary. An idle head (ci/docs/chore/...) keeps waiting even
//   after 24h: "not suitable, not shipped, until one is suitable".
//
// Shipping pushes a new tag, so the next run's range starts from that tag:
// the eligible count and elapsed hours reset to zero without stored state.
//
// Prints "release=true" / "release=false" plus decision details as key=value
// lines, so a workflow can append stdout to $GITHUB_OUTPUT. A non-releasing
// run is a normal outcome, not a failed job.
import { execFileSync } from 'node:child_process';

const ELIGIBLE = /^(feat|fix|refactor|perf|revert)(\([^)]+\))?!?:/;
const MIN_BATCH = Number(process.env.RELEASE_MIN_BATCH ?? 5);
const MAX_HOURS = Number(process.env.RELEASE_MAX_HOURS ?? 24);
const MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function decide({
  subjects, headSubject, hours, manual = false,
  minBatch = MIN_BATCH, maxHours = MAX_HOURS,
}) {
  const eligible = subjects.filter(s => ELIGIBLE.test(s));
  const head = headSubject ?? subjects[subjects.length - 1] ?? '';
  const batchReady = eligible.length >= minBatch;
  const timeReady = hours >= maxHours && eligible.length >= 1;
  const armed = batchReady || timeReady;
  const trigger = ELIGIBLE.test(head);
  const release = manual || (armed && trigger);

  let reason = 'waiting';
  if (manual) reason = 'manual dispatch';
  else if (release) reason = `${batchReady ? 'batch' : 'time'} armed, eligible commit reached`;
  else if (!armed) reason = `waiting: ${eligible.length}/${minBatch} eligible, ${hours.toFixed(1)}h`;
  else reason = 'armed, waiting for an eligible commit';
  return { release, reason, eligible: eligible.length, total: subjects.length, hours, armed };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  git(['fetch', '--tags', '--force']);
  const head = git(['rev-parse', 'HEAD']);
  let last = null;
  try { last = git(['describe', '--tags', '--abbrev=0', head]); } catch { /* no tags yet */ }
  const range = last ? `${last}..${head}` : head;
  const subjects = git(['log', range, '--no-merges', '--format=%s'])
    .split('\n').map(s => s.trim()).filter(Boolean);
  const headSubject = git(['log', '-1', '--format=%s', head]);
  const hours = last
    ? (Date.now() / 1000 - Number(git(['log', '-1', '--format=%ct', last]))) / 3600
    : Infinity;
  const d = decide({ subjects, headSubject, hours, manual: MANUAL });
  process.stdout.write([
    `release=${d.release}`,
    `reason=${d.reason}`,
    `eligible=${d.eligible}`,
    `total=${d.total}`,
    `armed=${d.armed}`,
  ].join('\n') + '\n');
  process.stderr.write(`release gate: ${d.reason} (${d.eligible}/${d.total} eligible, ${d.hours.toFixed(1)}h)\n`);
}
