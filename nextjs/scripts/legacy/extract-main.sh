#!/usr/bin/env bash
# Extracts the legacy app (origin/main) to $LEGACY_DIR (default /tmp/nordsweet-legacy) for reading,
# golden recordings and crawling. Never edit it: it is the reference, not code to keep.
set -euo pipefail
dir="${LEGACY_DIR:-/tmp/nordsweet-legacy}"
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin main
rm -rf "$dir" && mkdir -p "$dir"
git archive origin/main nextjs/public nextjs/src | tar -x -C "$dir"
echo "legacy main $(git rev-parse --short origin/main) -> $dir/nextjs"
echo "runtime: $dir/nextjs/src/runtime/index.js ($(wc -l <"$dir/nextjs/src/runtime/index.js") lines)"
