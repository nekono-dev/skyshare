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

# 仕様書チェック（npm run lint:spec / test:spec）の図の構文検証に必要な依存。スキル配下に閉じている
npm ci --ignore-scripts --no-audit --no-fund --prefix .claude/skills/spec-driven-development/scripts
