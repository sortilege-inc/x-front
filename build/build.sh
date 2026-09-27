#!/usr/bin/env bash
# Regenerate data/ from the Marvel Multiverse DSL corpus and prove the round trip.
#
#   bash build/build.sh [<path to titterpig-dsl-marvelmultiverse/0.5>]
#
# build (every token of every file consumed, or the parser raises; every corpus file claimed
# by exactly one book, or the build raises) → verify both directions, by count → check the
# shapes the site reads → node --check every data file. Any failure exits non-zero.
set -euo pipefail
cd "$(dirname "$0")/.."
CORPUS="${1:-$HOME/Sortilege/Titterpig/DSL/titterpig-dsl-marvelmultiverse/0.5}"

echo "--- build ($CORPUS)"
python3 build/build_data.py "$CORPUS"
echo "--- verify (every string, both directions, by count)"
python3 build/verify_data.py "$CORPUS"
echo "--- shape (the fields the site reads, against the corpus's own counts)"
python3 build/check_shape.py "$CORPUS"
echo "--- the d616 (the rules replay Core Mechanics' worked examples)"
node build/check_dice.js
echo "--- syntax"
for f in data/*.js system/marvelmultiverse/*.js; do node --check "$f"; done
echo "build.sh: OK"
