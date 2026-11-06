#!/usr/bin/env bash
# cc-sdd を固定版で導入する。Claude Code（.claude/settings.json）と Codex（.codex/hooks.json）の SessionStart は、どちらもこのスクリプトを呼ぶ。
#
# 使い方: scripts/agent/install-cc-sdd.sh --claude | --codex
# 版はこのファイルの CC_SDD_VERSION だけに書く。上げるときは版を変え、導入の結果（.kiro/settings/・CLAUDE.md）をコミットに含める。
set -euo pipefail

# 導入の版（3.1.0 に固定。@latest にすると導入のたびに追跡ファイルが書き換わる）
CC_SDD_VERSION="3.1.0"

case "${1:-}" in
  --claude) target="--claude-skills" ;;
  --codex) target="--codex-skills" ;;
  *)
    echo "使い方: scripts/agent/install-cc-sdd.sh --claude | --codex" >&2
    exit 2
    ;;
esac

# 呼び出し元のカレントに依らず、リポジトリのルートで導入する
cd "$(dirname "$0")/../.."

npx --yes "cc-sdd@${CC_SDD_VERSION}" --yes "$target" --lang ja
