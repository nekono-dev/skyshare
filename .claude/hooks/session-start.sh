#!/bin/bash
# Claude Code クラウドセッション開始時に、CI（.github/workflows/deploy.yaml）と同じテストの前提を整える
set -euo pipefail

# ローカル環境では何もしない
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# lexicons/com/atproto/repo/strongRef.json が atproto サブモジュールへのシンボリックリンクのため必要
git submodule update --init --depth 1 atproto

# コンテナの状態がキャッシュされるため、npm ci ではなく npm install で差分のみ導入する
npm install --no-audit --no-fund

# src/client 配下の生成コード（atproto / openapi）を作る。型検査とテストの前提
npm run codegen

# ブランチ運用スキル（外部リポジトリ。.gitignore 対象）を導入し、最新にする。失敗しても開始は止めない
skill=".claude/skills/branch-release-workflow"
if [ -d "$skill/.git" ]; then
  git -C "$skill" pull --ff-only --quiet || echo "警告: branch-release-workflow を更新できませんでした" >&2
else
  git clone --quiet git@github.com.nekono:nekono-dev/branch-release-workflow.git "$skill" ||
    git clone --quiet https://github.com/nekono-dev/branch-release-workflow.git "$skill" ||
    echo "警告: branch-release-workflow を導入できませんでした（ブランチ運用のフックが無効になります）" >&2
fi
