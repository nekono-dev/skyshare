#!/bin/bash
# cc-sdd（仕様駆動開発フレームワーク）の skill とテンプレートをセッション開始時に導入する。
# 生成物（.claude/skills/kiro-*・.kiro/settings/）は gitignore 対象で、リポジトリには含めない。
# 固定バージョンが導入済みなら何もしない。バージョンを上げるときは CC_SDD_VERSION だけを変える。
set -euo pipefail

CC_SDD_VERSION="3.1.0"
CC_SDD_LANG="ja"

cd "$CLAUDE_PROJECT_DIR"

MARKER=".kiro/settings/.cc-sdd-version"
if [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$CC_SDD_VERSION" ] && [ -d .claude/skills/kiro-spec-init ]; then
  exit 0
fi

# 旧バージョンの残骸（廃止された skill 等）を残さないため、生成物を消してから入れ直す。
# 追跡対象の .kiro/specs・.kiro/steering には触れない
rm -rf .claude/skills/kiro-* .kiro/settings

# cc-sdd は追跡対象の CLAUDE.md（プロジェクト規約）を雛形で上書きする。--overwrite skip は新規ファイルまで
# 全て飛ばす（50件中0件書き込み）ため使えない。退避して導入後に復元する
CLAUDE_MD_BACKUP="$(mktemp)"
cp CLAUDE.md "$CLAUDE_MD_BACKUP"
restore_claude_md() { cp "$CLAUDE_MD_BACKUP" CLAUDE.md; rm -f "$CLAUDE_MD_BACKUP"; }
trap restore_claude_md EXIT

if ! npx --yes "cc-sdd@${CC_SDD_VERSION}" --claude-skills --lang "$CC_SDD_LANG" --overwrite force --yes >&2; then
  echo "cc-sdd ${CC_SDD_VERSION} の導入に失敗しました。ネットワークと npm レジストリへの到達性を確認してください" >&2
  exit 1
fi

echo "$CC_SDD_VERSION" > "$MARKER"
