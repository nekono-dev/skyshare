#!/bin/bash
# Claude Code クラウドセッション開始時に、CI（.github/workflows/deploy.yaml）と同じテストの前提を整える
set -euo pipefail

# push 前の全層の検査（.githooks/pre-push）を効かせるため、ローカルでもクラウドでも hooksPath を設定する（要件 8.2）
node "${CLAUDE_PROJECT_DIR:-.}/scripts/git/setup-git-hooks.mjs"

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

[ -f .dev.vars ] || cp config/.dev.vars.template .dev.vars
