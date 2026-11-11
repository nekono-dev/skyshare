/**
 * npm の prepare とエージェントのセッション開始時に、リポジトリの Git フック先を `.githooks` に設定する。
 * Git 作業ツリー外では何もせず、繰り返し実行しても設定結果は同じ。
 */
import { spawnSync } from "node:child_process"

const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
  encoding: "utf8",
})
if (inside.status !== 0 || inside.stdout.trim() !== "true") process.exit(0)

const set = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
})
process.exit(set.status ?? 1)
