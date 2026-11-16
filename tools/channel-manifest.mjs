#!/usr/bin/env node
// Generate and sign the OTA update-channel manifest for a train release.
//
// Inputs: the release tag, the framework bundle path (the full tar.gz asset)
// and the publisher private key as PEM in OPUROM_CHANNEL_KEY. Outputs, next
// to the bundle: update-channel.json plus its detached Ed25519 signature
// update-channel.json.sig, keyed by the manifest's own asset name — the same
// verifyBytes contract the package CLI uses.
//
// The manifest's `latest` must equal the tag version and `bundleSha256` is the
// digest over the bundle bytes; spec: TOOLCHAIN_AND_PACKAGES.md §3.0.2.
import { createPrivateKey, sign as detachedSign } from 'node:crypto';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ASSET = 'update-channel.json';

function die(message) {
  process.stderr.write(`channel-manifest: ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
function flag(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const tag = flag('--tag');
const bundle = flag('--bundle');
const outDir = flag('--out') ?? path.dirname(bundle ?? '.');
if (!tag || !bundle) die('usage: channel-manifest --tag <vX.Y.Z[-dev.N]> --bundle <path> [--out <dir>]');
const pem = process.env.OPUROM_CHANNEL_KEY;
if (!pem) die('OPUROM_CHANNEL_KEY with the publisher private key PEM is required');

const bundleBytes = readFileSync(bundle);
if (bundleBytes.length === 0) die('bundle is empty');
const sha256 = createHash('sha256').update(bundleBytes).digest('hex');
const version = tag.replace(/^v/, '');
const bundleName = path.basename(bundle);

const manifest = {
  channel: 'train',
  version: 1,
  latest: version,
  tag,
  bundle: bundleName,
  bundleSha256: sha256,
};

const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
let signature;
try {
  const key = createPrivateKey(pem);
  // signBytes keys the payload by `"<relativePath>\n" + bytes`, relativePath
  // being the manifest's own asset name — reproduce that exact contract so the
  // package CLI's verifyBytes accepts it.
  const payload = Buffer.concat([Buffer.from(`${ASSET}\n`, 'utf8'), manifestBytes]);
  signature = detachedSign(null, payload, key);
} catch (error) {
  die(`key or signing failed: ${error.message}`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, ASSET), manifestBytes);
writeFileSync(path.join(outDir, `${ASSET}.sig`), signature);
process.stdout.write(
  `channel manifest: ${ASSET} latest=${version} bundle=${bundleName} sha256=${sha256}\n`,
);
