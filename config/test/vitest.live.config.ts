/**
 * live 層（実 Bluesky との契約）の vitest 設定。
 *
 * 責務と処理概要:
 * - `tests/live` 配下の `*.test.ts` だけを Node 環境で実行する。`npm run test:live` が使う。
 * - 開発者がローカルで任意に実行する。`test:all`・pre-push・CI には含めない（`.kiro/steering/testing.md`）。
 * - 設定（config/live.json・.dev.vars）が無いときは、テストが自分でスキップする。
 */
import path from "node:path"
import { defineConfig } from "vitest/config"

// この設定は config/test/ にあるため、include の基準はプロジェクトの根にする
export default defineConfig({
    root: path.resolve(import.meta.dirname, "../.."),
    test: {
        environment: "node",
        include: ["tests/live/**/*.test.ts"],
        // 実 PDS への通信を待つ時間
        testTimeout: 30_000,
        coverage: { enabled: false },
    },
})
