#!/bin/bash
# branch-release-workflow プラグインをセッション開始時に導入し、作業ブランチでの作業に brw を使えるようにする。
# - /plugin install branch-release-workflow --marketplace nekono-dev/branch-release-workflow と同じ導入を CLI で行う
#   （導入済みなら何もしない。マーケットプレイス名とプラグイン名は .claude/settings.json の enabledPlugins と揃える）
# - brw（scripts/brw.mjs）を PATH 上のコマンドにし、tests/hack/renderDeployConfig.test.ts などが使う BRW_PLUGIN_DIR を渡す
set -euo pipefail

MARKETPLACE_REPO="nekono-dev/branch-release-workflow"
MARKETPLACE_NAME="nekono-dev"
PLUGIN="branch-release-workflow"

cd "$CLAUDE_PROJECT_DIR"

installed_path() {
  node -e '
    const fs = require("node:fs"), os = require("node:os"), path = require("node:path")
    const file = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "plugins", "installed_plugins.json")
    try {
      const entries = JSON.parse(fs.readFileSync(file, "utf8")).plugins?.[process.argv[1]] ?? []
      const found = entries.find((e) => e.installPath && fs.existsSync(path.join(e.installPath, "scripts", "brw.mjs")))
      if (found) process.stdout.write(found.installPath)
    } catch {}
  ' "$PLUGIN@$MARKETPLACE_NAME"
}

PLUGIN_DIR="$(installed_path)"
if [ -z "$PLUGIN_DIR" ]; then
  if ! claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE_NAME"; then
    claude plugin marketplace add "$MARKETPLACE_REPO" --scope project >&2
  fi
  if ! claude plugin install "$PLUGIN@$MARKETPLACE_NAME" --scope project >&2; then
    echo "$PLUGIN の導入に失敗しました。ネットワークと GitHub への到達性を確認してください" >&2
    exit 1
  fi
  PLUGIN_DIR="$(installed_path)"
fi
if [ -z "$PLUGIN_DIR" ]; then
  echo "$PLUGIN の導入先（scripts/brw.mjs）が見つかりません" >&2
  exit 1
fi

# brw コマンド。プラグインの更新で導入先が変わっても、毎回ここで張り替える
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
printf '#!/bin/sh\nexec node "%s/scripts/brw.mjs" "$@"\n' "$PLUGIN_DIR" > "$BIN_DIR/brw"
chmod +x "$BIN_DIR/brw"

# 以降のコマンドへ環境変数を渡す（クラウドセッションのみ CLAUDE_ENV_FILE が与えられる）
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export BRW_PLUGIN_DIR=\"$PLUGIN_DIR\""
    echo "export PATH=\"$BIN_DIR:\$PATH\""
  } >> "$CLAUDE_ENV_FILE"
fi
