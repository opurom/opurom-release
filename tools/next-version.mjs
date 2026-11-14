#!/usr/bin/env node
// Print the next lightweight version tag for this repository. Existing tags
// arrive on stdin; the current release series and stage are read from the
// repo's version file (Cargo.toml, package.json or VERSION). Promoting that
// file to a new series restarts the dev counter at 1; a final stage (no
// suffix, e.g. `0.1.0`) returns the bare version tag `v0.1.0`.
import { nextTagForSeries, readReleaseSeries } from './version.mjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  const tags = input.split(/\s+/).filter(Boolean);
  const series = readReleaseSeries(process.cwd());
  process.stdout.write(nextTagForSeries(tags, series) + '\n');
});
