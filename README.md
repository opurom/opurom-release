# Opurom release train

One version number for the whole Opurom framework. Every train produces
`vX.Y.Z-dev.N` as a single snapshot across all framework repositories, so
`opurom/opurom-release` is the only place a framework version exists.

## Why a train

The framework ships as one product. Individual repositories keep their own
git history and CI, but they do not publish releases: the train collects a
verified batch of work from every repository and stamps it with one version.
Users install, compare and roll back by that single version.

## How a train departs

The release workflow runs hourly and evaluates pure rules, no model calls:

1. **Version change**: if the `VERSION` file differs from the one at the
   previous train tag, the previous series is finalized immediately: the
   train tags its bare version (`VERSION=0.1.0` in development ships
   `v0.1.0`), and later trains continue on the new series
   (`v0.1.1-dev.1`, ...). Bumping `VERSION` is the only promotion act.
2. **Batch**: 50 or more eligible commits (`feat`, `fix`, `refactor`,
   `perf`, `revert`) accumulated across the product repositories since the
   previous train.
3. **Time**: 24 hours since the previous train with at least one `feat`
   commit in the window. No `feat`, no departure, even with idle commits.
4. **Manual**: a `workflow_dispatch` departs immediately.

Every departure also requires green CI on the head commit of every
framework repository. A red repository holds the train.

## What a departure does

1. Computes the next version from this repository's `VERSION` file.
2. Tags every product repository at its verified head with the same tag.
   `opurom-examples`, `opurom-ui` and `opurom-icons` stay outside: they are
   optional content packages, not part of the installable framework.
3. Publishes one release here, summarizing the batch across repositories.

Tagging a repository without new commits re-tags the same commit: a train
is a snapshot, and a snapshot covers every tagged repository, changed or
not. Every snapshot repository must be green on CI at departure; the three
content repositories are not tagged or counted.

## Version source

The `VERSION` file in this repository is the single source of truth for the
framework version. It holds a bare MAJOR.MINOR.PATCH naming the series in
development: while it reads `0.1.0`, trains tag `v0.1.0-dev.1`, `dev.2`,
... Bumping the file is the only promotion act: the next hourly check
finalizes the previous series (tags `v0.1.0`, bare), resets the counters,
and continues on the new series (`v0.1.1-dev.1`, ...). The train never
promotes on its own; beta/rc stages stay reserved.
