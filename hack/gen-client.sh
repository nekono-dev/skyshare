#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="${1:-./dev/client/lexicon}"

npx lex gen-api --yes "$OUTPUT_DIR" \
  ./lexicons/dev/nekono/skyshare/* \
  ./lexicons/com/atproto/repo/strongRef.json \
  ./lexicons/com/atproto/repo/defs.json \
  ./lexicons/com/atproto/repo/listRecords.json \
  ./lexicons/com/atproto/repo/getRecord.json \
  ./lexicons/com/atproto/repo/createRecord.json \
  ./lexicons/com/atproto/repo/putRecord.json \
  ./lexicons/com/atproto/repo/deleteRecord.json
