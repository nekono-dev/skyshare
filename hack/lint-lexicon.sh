#!/usr/bin/env bash
# Skyshare 独自 lexicon を goat（ATProto 公式の lexicon 検証ツール）で lint する。
#
# 責務: entry.json の位置から独自 lexicon のディレクトリを特定し、`goat lex lint` を実行する。
#       com/atproto 配下は atproto サブモジュールへの symlink（公式定義）のため対象外とする。
# 使い方: npm run lint:lexicon
# 失敗時: goat 未導入、または lint で指摘があれば異常終了する。
set -euo pipefail

if ! command -v goat > /dev/null 2>&1; then
  echo "goat が見つかりません。lexicons/README.md の「GoAT」の手順で導入してください" >&2
  exit 1
fi

ENTRY_JSONS=$(find ./lexicons -name entry.json)
if [ "$(printf '%s\n' "$ENTRY_JSONS" | grep -c .)" -ne 1 ]; then
  echo "lexicons 配下の entry.json は1つだけ必要です（検出: ${ENTRY_JSONS:-なし}）" >&2
  exit 1
fi
APP_LEXICON_DIR=$(dirname "$ENTRY_JSONS")

goat lex lint "$APP_LEXICON_DIR"/*
