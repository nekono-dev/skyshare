#!/usr/bin/env bash
# cc-sdd を固定版で導入する。Claude Code（.claude/settings.json）と Codex（.codex/hooks.json）の SessionStart は、どちらもこのスクリプトを呼ぶ。
#
# 使い方: scripts/agent/install-cc-sdd.sh --claude | --codex
#
# 導入するのはスキルと設定の雛形だけ（.claude/skills/kiro-*・.agents/skills/kiro-*・.kiro/settings/）。
# いずれも cc-sdd（MIT）の成果物で本リポジトリとはライセンスが異なるため、.gitignore の対象でコミットしない。
# CLAUDE.md と AGENTS.md は導入の対象から外す（プロジェクトの文書で、導入のたびに書き換えない）。
# 版はこのファイルの CC_SDD_VERSION だけに書く。上げるときは版を変え、導入物を入れ直して動作を確かめる。
set -euo pipefail

# 導入の版（3.1.0 に固定。@latest にすると導入のたびに導入物が変わる）
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

# 導入の対象の一覧。cc-sdd の既定の一覧（manifests/*.json）から、文書（doc_main）だけを外したもの。
# 文書は CLAUDE.md・AGENTS.md の書き換えになるため含めない
manifest="$(mktemp)"
trap 'rm -f "$manifest"' EXIT
case "${1}" in
  --claude)
    cat > "$manifest" << 'JSON'
{
  "version": 1,
  "artifacts": [
    {
      "id": "skills",
      "source": { "type": "templateDir", "fromDir": "templates/agents/{{AGENT}}/skills", "toDir": "{{AGENT_COMMANDS_DIR}}" }
    },
    {
      "id": "settings_templates",
      "source": { "type": "templateDir", "fromDir": "templates/shared/settings/templates", "toDir": "{{KIRO_DIR}}/settings/templates" }
    }
  ]
}
JSON
    ;;
  --codex)
    cat > "$manifest" << 'JSON'
{
  "version": 1,
  "artifacts": [
    {
      "id": "skills",
      "source": { "type": "templateDir", "fromDir": "templates/agents/{{AGENT}}/skills", "toDir": "{{AGENT_COMMANDS_DIR}}" }
    },
    {
      "id": "codex_agents",
      "source": { "type": "templateDir", "fromDir": "templates/agents/{{AGENT}}/codex-agents", "toDir": ".codex/agents" }
    },
    {
      "id": "settings_templates",
      "source": { "type": "templateDir", "fromDir": "templates/shared/settings/templates", "toDir": "{{KIRO_DIR}}/settings/templates" }
    }
  ]
}
JSON
    ;;
esac

# 導入物は固定版で入れ直す（既存のファイルも上書きする。CLAUDE.md・AGENTS.md は一覧に無いので触らない）
npx --yes "cc-sdd@${CC_SDD_VERSION}" --yes --overwrite force --manifest "$manifest" "$target" --lang ja

# SessionStart の標準出力はセッションのコンテキストに入る。導入直後のセッションでは、新しいスキルがスキル一覧に
# 現れないことがある（一覧は起動時に読まれるため）。その場合に SKILL.md を直接読めるよう案内する
case "${1}" in
  --claude)
    echo "cc-sdd の導入物を更新しました（.claude/skills/kiro-*・.kiro/settings/）。CLAUDE.md は変更していません。"
    echo "このセッションのスキル一覧に kiro-* が無い場合は、依頼に対応する .claude/skills/<名前>/SKILL.md を Read して、その手順に従ってください。"
    ;;
  --codex)
    echo "cc-sdd の導入物を更新しました（.agents/skills/kiro-*・.codex/agents/・.kiro/settings/）。AGENTS.md は変更していません。"
    ;;
esac
