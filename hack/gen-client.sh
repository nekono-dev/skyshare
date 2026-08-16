#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="${1:-./dev/client/lexicon}"

npx lex gen-api --yes "$OUTPUT_DIR" \
  ./lexicons/dev/nekono/skyshare/* \
  ./lexicons/com/atproto/repo/strongRef.json
