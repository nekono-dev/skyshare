import { describe, expect, it } from "vitest"
import { AtpAgent } from "@atproto/api"

/**
 * `patches/@atproto+api+*.patch` の回帰テスト。
 *
 * 素の `@atproto/api` は `AtpAgent` を生成するたびに全lexicon（約390件）を
 * `new Lexicons(schemas)` で登録し直す。この登録が1回あたり約3.5msのCPU時間を使い、
 * Cloudflare Workers（無料枠はCPU 10ms）のリクエスト毎のAgent生成で上限に達する原因になる。
 * パッチは全Agentで単一の `Lexicons` インスタンスを共有させる。パッチが当たっていないと、
 * Agentごとに別インスタンスとなりこのテストが失敗する。
 */
describe("AtpAgent のlexicon共有（patch-package）", () => {
    it("複数のAgent間で同一の Lexicons インスタンスを共有する", () => {
        const a = new AtpAgent({ service: "https://bsky.social" })
        const b = new AtpAgent({ service: "https://example.social" })
        expect(a.lex).toBe(b.lex)
    })

    it("Agent生成は1回あたり十分に軽い", () => {
        new AtpAgent({ service: "https://bsky.social" }) // 初回の評価コストを除外
        const start = performance.now()
        for (let i = 0; i < 50; i++) {
            new AtpAgent({ service: "https://bsky.social" })
        }
        const average = (performance.now() - start) / 50
        // パッチ無しでは3ms超。余裕を持たせた閾値で劣化だけを検知する。
        expect(average).toBeLessThan(1.5)
    })
})
