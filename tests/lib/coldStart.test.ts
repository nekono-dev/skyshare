import { resolve } from "node:path"
import { build } from "esbuild"
import { describe, expect, it } from "vitest"

/**
 * Worker の起動（cold start）コストの回帰テスト。
 *
 * `src/middleware.ts` は全リクエストで読み込まれる。ここから `@atproto/*`（約1.3MB、評価に約70ms）
 * を静的にimportしてしまうと、atprotoを使わないリクエスト（entry詳細のキャッシュHITや
 * 静的アセットの404など）でも、isolate の起動のたびにその評価コストがかかる。
 * Workers 無料枠のCPU上限（10ms）を超える原因になるため、atprotoは認証処理を始める時点で
 * 動的importすること（`lib/session/bskySessionRefresh.ts` を参照）。
 */
describe("cold start: ミドルウェアの静的importにatprotoを含めない", () => {
    it("src/middleware.ts から静的に辿れる範囲に @atproto/* が無い", async () => {
        const entry = resolve(__dirname, "../../src/middleware.ts")
        const result = await build({
            entryPoints: [entry],
            bundle: true,
            splitting: true,
            format: "esm",
            write: false,
            outdir: "out",
            metafile: true,
            logLevel: "silent",
            platform: "neutral",
            alias: { "@": resolve(__dirname, "../../src") },
            // ランタイム側で解決されるものはバンドルしない（atproto は import 先として記録される）
            external: ["astro:*", "astro", "@atproto/*"],
        })

        const outputs = result.metafile.outputs
        const entryOutput = Object.keys(outputs).find(
            key => outputs[key].entryPoint !== undefined,
        )
        expect(entryOutput).toBeDefined()

        // エントリから `import-statement`（静的import）だけを辿り、到達した外部モジュールを集める
        const staticExternals = new Set<string>()
        const visited = new Set<string>()
        const stack = [entryOutput as string]
        while (stack.length > 0) {
            const current = stack.pop() as string
            if (visited.has(current)) continue
            visited.add(current)
            for (const imp of outputs[current].imports) {
                if (imp.kind !== "import-statement") continue
                if (imp.external) staticExternals.add(imp.path)
                else stack.push(imp.path)
            }
        }

        const atproto = [...staticExternals].filter(path =>
            path.startsWith("@atproto/"),
        )
        expect(atproto).toEqual([])
    })
})
