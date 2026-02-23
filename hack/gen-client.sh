#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="${1:-./dev/client/lexicon}"

npx lex gen-api --yes \
  \
  "$OUTPUT_DIR" \
  ./lexicons/dev/nekono/skyshare/* \
  ./lexicons/app/bsky/feed/post.json \
  ./lexicons/app/bsky/feed/defs.json \
  ./lexicons/app/bsky/embed/* \
  ./lexicons/app/bsky/actor/defs.json \
  ./lexicons/app/bsky/actor/getProfile.json \
  ./lexicons/app/bsky/notification/defs.json \
  ./lexicons/app/bsky/feed/threadgate.json \
  ./lexicons/app/bsky/feed/postgate.json \
  ./lexicons/app/bsky/graph/defs.json \
  ./lexicons/app/bsky/labeler/defs.json \
  ./lexicons/com/atproto/moderation/defs.json \
  ./lexicons/app/bsky/richtext/facet.json \
  ./lexicons/com/atproto/repo/strongRef.json \
  ./lexicons/com/atproto/label/defs.json \
  ./lexicons/com/atproto/repo/createRecord.json \
  ./lexicons/com/atproto/repo/defs.json \
  ./lexicons/com/atproto/repo/putRecord.json \
  ./lexicons/com/atproto/repo/listRecords.json \
  ./lexicons/com/atproto/repo/deleteRecord.json \
  ./lexicons/com/atproto/repo/getRecord.json \
  ./lexicons/com/atproto/repo/uploadBlob.json \
  ./lexicons/com/atproto/server/createSession.json \
  ./lexicons/com/atproto/server/refreshSession.json
