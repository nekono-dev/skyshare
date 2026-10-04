#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="${1:-./dev/client/lexicon}"

# Skyshare 独自 lexicon のディレクトリは entry.json の位置から特定する（ドメインに依存しない）
ENTRY_JSONS=$(find ./lexicons -name entry.json)
if [ "$(printf '%s\n' "$ENTRY_JSONS" | grep -c .)" -ne 1 ]; then
  echo "lexicons 配下の entry.json は1つだけ必要です（検出: ${ENTRY_JSONS:-なし}）" >&2
  exit 1
fi
APP_LEXICON_DIR=$(dirname "$ENTRY_JSONS")

# 旧 NSID 由来の生成物を残さないため、出力先を空にしてから生成する
rm -rf "$OUTPUT_DIR"

npx lex gen-api --yes "$OUTPUT_DIR" \
  "$APP_LEXICON_DIR"/* \
  ./lexicons/com/atproto/repo/strongRef.json
