#!/usr/bin/env bash
# 開発ブランチに対応する「案内用プレビューURL」を表示するスクリプト。
#
# 責務:
# - ブランチ名 dev/XXXX から、skyshare-preview-domain-proxy 経由の案内用URL
#   https://dev-XXXX.skyshare.nekono.dev を組み立てて表示する
# - 命名規則に合わないブランチ（プレビューが発行されないもの）は異常終了する
#
# 使い方: preview-url.sh [ブランチ名]   （省略時は現在のブランチ）
set -euo pipefail

branch="${1:-$(git branch --show-current)}"

# 命名規則: dev/XXXX（XXXX は小文字英数字とハイフンのみ・先頭末尾/連続ハイフン不可・50文字以内）
if ! printf '%s' "$branch" | grep -Eq '^dev/[a-z0-9]+(-[a-z0-9]+)*$' || [ "${#branch}" -gt 54 ]; then
  echo "エラー: ブランチ '$branch' は dev/XXXX の命名規則に合わないため、プレビューURLは発行されません。" >&2
  exit 1
fi

echo "https://dev-${branch#dev/}.skyshare.nekono.dev"
