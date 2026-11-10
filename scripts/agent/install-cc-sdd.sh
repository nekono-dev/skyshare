#!/usr/bin/env bash
# cc-sdd を固定版で Claude 向けに導入する。SessionStart（.claude/settings.json）がこのスクリプトを呼ぶ。
#
# 使い方: scripts/agent/install-cc-sdd.sh --claude
#
# 導入するのはスキルと設定の雛形だけ（.claude/skills/kiro-*・.kiro/settings/）。
# いずれも cc-sdd（MIT）の成果物で本リポジトリとはライセンスが異なるため、.gitignore の対象でコミットしない。
# CLAUDE.md は導入の対象から外す（プロジェクトの文書で、導入のたびに書き換えない）。
# 版はこのファイルの CC_SDD_VERSION だけに書く。上げるときは版を変え、導入物を入れ直して動作を確かめる。
#
# 失敗の記録: 導入に失敗したら .cache/cc-sdd-install.failed を書く（SessionStart は止められないため、
# 次の UserPromptSubmit のフック（install-gate.mjs）が、プロンプトを止める）。成功したら記録を消す。
set -euo pipefail

# 導入の版（3.1.0 に固定。@latest にすると導入のたびに導入物が変わる）
CC_SDD_VERSION="3.1.0"

if [ "${1:-}" != "--claude" ] || [ "$#" -ne 1 ]; then
  echo "使い方: scripts/agent/install-cc-sdd.sh --claude" >&2
  exit 2
fi

# 呼び出し元のカレントに依らず、リポジトリのルートで導入する
cd "$(dirname "$0")/../.."

failure_record=".cache/cc-sdd-install.failed"

# 導入の対象の一覧。cc-sdd の既定の一覧（manifests/*.json）から、文書（doc_main）だけを外したもの。
# 文書は CLAUDE.md の書き換えになるため含めない
manifest="$(mktemp)"
trap 'rm -f "$manifest"' EXIT
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

# 導入の前に記録を書く。完了したら消す。途中で中断（時間切れなど）されても、記録が残って次の入力で止まる
mkdir -p .cache
printf '%s\n' "cc-sdd の導入が完了していません（導入中、または中断）。" > "$failure_record"
# 導入物は固定版で入れ直す（既存のファイルも上書きする。CLAUDE.md は一覧に無いので触らない）
if npx --yes "cc-sdd@${CC_SDD_VERSION}" --yes --overwrite force --manifest "$manifest" --claude-skills --lang ja; then
  rm -f "$failure_record"
  # SessionStart の標準出力はセッションのコンテキストに入る。導入直後のセッションでは、新しいスキルがスキル一覧に
  # 現れないことがある（一覧は起動時に読まれるため）。その場合に SKILL.md を直接読めるよう案内する
  echo "cc-sdd の導入物を更新しました（.claude/skills/kiro-*・.kiro/settings/）。CLAUDE.md は変更していません。"
  echo "スキル一覧に載らないスキル（disable-model-invocation: true の kiro-discovery・kiro-impl など）や、一覧に無いスキルは、依頼に対応する .claude/skills/<名前>/SKILL.md を Read して、その手順を最後まで実行してください。"
else
  status=$?
  mkdir -p .cache
  printf '%s\n' "cc-sdd の導入に失敗しました（終了コード ${status}）。再試行: scripts/agent/install-cc-sdd.sh --claude" > "$failure_record"
  echo "cc-sdd の導入に失敗しました（終了コード ${status}）。次の入力からプロンプトが止まります。再試行: scripts/agent/install-cc-sdd.sh --claude" >&2
  exit "$status"
fi
