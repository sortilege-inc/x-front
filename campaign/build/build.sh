#!/usr/bin/env bash
# X-FRONT's own build: the heroes (sheets → DSL layer → data, gated at each step), the public pages'
# prose, and the Narrator's seed. The books (data/) are upstream's, built by build/build.sh; run that
# first after pulling a corpus change.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 campaign/source/extract_sheets.py
python3 campaign/source/check_sheets.py
python3 campaign/source/convert_heroes.py
bash build/build_layer.sh campaign/dsl campaign "X-FRONT" campaign/data
python3 campaign/source/check_heroes.py
python3 campaign/build/build_docs.py
python3 campaign/build/build_seed.py
node --check campaign/data/docs.js
node --check campaign/site/site.js
node -e "JSON.parse(require('fs').readFileSync('campaign/pack/seed.json','utf8'))"
echo "campaign/build/build.sh: OK"
