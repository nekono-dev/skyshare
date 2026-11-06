// core.hooksPath をリポジトリの .githooks に設定する（要件 8.1・8.2）。
// 責務: npm の prepare（npm install・npm ci の後）と、エージェントのセッション開始で実行する。
// git の作業ツリーでない環境（パッケージとしての利用など）では何もしない。何度実行しても結果は同じ。
import { spawnSync } from "node:child_process"

const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  encoding: "utf8",
})
if (inside.status !== 0 || inside.stdout.trim() !== "true") process.exit(0)

const set = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
})
process.exit(set.status ?? 1)
