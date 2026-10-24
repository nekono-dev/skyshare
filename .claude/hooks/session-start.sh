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

# 仕様書チェック（npm run test:spec）の検査コマンド。GitHub Packages の認証（環境の Secret NODE_AUTH_TOKEN）が
# 無い場合は導入を省く（仕様書を扱うときに spec-lint が導入手順を表示する）
if [ -n "${NODE_AUTH_TOKEN:-}" ]; then
  npm install -g @nekono-dev/spec-lint@1 --no-audit --no-fund \
    --@nekono-dev:registry=https://npm.pkg.github.com \
    --//npm.pkg.github.com/:_authToken="$NODE_AUTH_TOKEN"
fi
[ -f .dev.vars ] || cp .dev.vars.template .dev.vars
