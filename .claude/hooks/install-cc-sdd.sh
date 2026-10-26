#!/bin/bash
# cc-sdd（仕様駆動開発フレームワーク）の skill をセッション開始時に導入する。
# - skill（.claude/skills/kiro-*）は gitignore 対象で、固定バージョンから毎回同じ内容を導入する
# - CLAUDE.md と .kiro/settings（テンプレート）は cc-sdd の標準を追跡し、このフックは上書きしない
#   （テンプレートは調整して使う前提のため。無いときだけ補う）
# バージョンを上げるときは CC_SDD_VERSION を変え、CLAUDE.md と .kiro/settings の差分は手で取り込む。
set -euo pipefail

CC_SDD_VERSION="3.1.0"
CC_SDD_LANG="ja"

cd "$CLAUDE_PROJECT_DIR"

MARKER=".claude/skills/.cc-sdd-version"
if [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$CC_SDD_VERSION" ] && [ -d .claude/skills/kiro-spec-init ]; then
  exit 0
fi

# インストーラーは CLAUDE.md などを書き換えるため、一時ディレクトリへ導入して skill だけを持ってくる
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if ! (cd "$WORK" && npx --yes "cc-sdd@${CC_SDD_VERSION}" --claude-skills --lang "$CC_SDD_LANG" --overwrite force --yes >&2); then
  echo "cc-sdd ${CC_SDD_VERSION} の導入に失敗しました。ネットワークと npm レジストリへの到達性を確認してください" >&2
  exit 1
fi

# 旧バージョンの残骸（廃止された skill）を残さないため、kiro-* を消してから置き換える
mkdir -p .claude/skills
rm -rf .claude/skills/kiro-*
cp -r "$WORK"/.claude/skills/kiro-* .claude/skills/

# テンプレートは追跡対象。無いときだけ補う
if [ ! -d .kiro/settings ]; then
  mkdir -p .kiro
  cp -r "$WORK/.kiro/settings" .kiro/settings
fi

echo "$CC_SDD_VERSION" > "$MARKER"
