#!/usr/bin/env bash
# 開発ブランチ dev/XXXX を命名規則に従って作成するスクリプト。
#
# 責務:
# - 引数の名前（XXXX または dev/XXXX）が命名規則に合うか検証する
# - 規則に合う場合のみ、dev/XXXX ブランチと作業用 worktree を作成する
#
# 命名規則（XXXX）: 小文字英数字とハイフンのみ・先頭末尾のハイフン不可・連続ハイフン不可・50文字以内
#
# 使い方:
#   create-dev-branch.sh <XXXX|dev/XXXX> [--base <ブランチ>] [--branch-only]
#   - 既定では、ブランチと worktree（<リポジトリ>/.claude/worktrees/XXXX）を作る
#   - --branch-only: worktree を作らず、ブランチだけ作る（現在のブランチは切り替えない）
#   - --base: 分岐元（既定: develop。origin/<base> があればそちらの最新を使う）
#
# 終了コード: 0 成功 / 1 規則違反・既存ブランチなどの失敗 / 2 引数不正
set -euo pipefail

usage() {
  echo "使い方: $0 <XXXX|dev/XXXX> [--base <ブランチ>] [--branch-only]" >&2
  exit 2
}

name=""
base="develop"
branch_only=false
while [ $# -gt 0 ]; do
  case "$1" in
    --base)
      [ $# -ge 2 ] || usage
      base="$2"
      shift 2
      ;;
    --branch-only)
      branch_only=true
      shift
      ;;
    -h | --help) usage ;;
    -*) usage ;;
    *)
      [ -z "$name" ] || usage
      name="$1"
      shift
      ;;
  esac
done
[ -n "$name" ] || usage

# dev/ 接頭辞は付いていてもいなくてもよい
suffix="${name#dev/}"

# 命名規則の検証（preview.yaml / skyshare-preview-domain-proxy と同じ規則）
if ! printf '%s' "$suffix" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' || [ "${#suffix}" -gt 50 ]; then
  echo "エラー: '$suffix' は命名規則に合いません。" >&2
  echo "  dev/XXXX の XXXX には小文字英数字とハイフンのみを使い、先頭末尾・連続のハイフンは不可、50文字以内にしてください。" >&2
  echo "  例: dev/thread-post" >&2
  exit 1
fi

branch="dev/$suffix"
repo_root="$(git rev-parse --show-toplevel)"

if git show-ref --verify --quiet "refs/heads/$branch" || git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  echo "エラー: ブランチ $branch は既に存在します。" >&2
  exit 1
fi

# 分岐元は、リモートの最新があればそれを優先する
git fetch origin "$base" --quiet 2>/dev/null || echo "警告: origin/$base を取得できませんでした。ローカルの $base を使います。" >&2
if git show-ref --verify --quiet "refs/remotes/origin/$base"; then
  start_point="origin/$base"
elif git show-ref --verify --quiet "refs/heads/$base"; then
  start_point="$base"
else
  echo "エラー: 分岐元ブランチ $base が見つかりません。" >&2
  exit 1
fi

if [ "$branch_only" = true ]; then
  git branch --no-track "$branch" "$start_point"
  echo "ブランチを作成しました: $branch（分岐元: $start_point）"
else
  worktree_path="$repo_root/.claude/worktrees/$suffix"
  git worktree add --no-track -b "$branch" "$worktree_path" "$start_point"
  echo "ブランチと worktree を作成しました: $branch"
  echo "  worktree: $worktree_path"
  echo "  次の準備が必要です: (cd '$worktree_path' && git submodule update --init && npm ci)"
fi

# 案内用プレビューURL（push 後に有効になる）
echo "プレビューURL（push 後）: https://dev-$suffix.skyshare.nekono.dev"
