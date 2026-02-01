#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="${1:-./dev/client/lexicon}"

npx lex gen-api --yes \
  "$OUTPUT_DIR" \
  ./lexicons/* \
  ./lexicons/app/bsky/feed/post.json \
  ./lexicons/app/bsky/feed/defs.json \
  ./lexicons/app/bsky/embed/* \
  ./lexicons/app/bsky/actor/defs.json \
  ./lexicons/app/bsky/graph/defs.json \
  ./lexicons/app/bsky/labeler/defs.json \
  ./lexicons/app/bsky/richtext/facet.json \
  ./lexicons/com/atproto/repo/strongRef.json \
  ./lexicons/com/atproto/label/defs.json
