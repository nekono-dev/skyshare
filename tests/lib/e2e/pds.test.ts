/**
 * ライブテストのPDSヘルパーのうち、PDSに依存しない部分（識別子の判定・削除計画）の単体テスト。
 */
import { describe, expect, it } from "vitest"
import {
    e2eTagTimeMs,
    isE2eText,
    makeRunTag,
    planDeletion,
    type RepoRecord,
} from "../../e2e/live/pds"

const post = (id: string, text: string): RepoRecord => ({
    uri: `at://did:plc:a/app.bsky.feed.post/${id}`,
    value: { text },
})
const entry = (id: string, sourceId: string): RepoRecord => ({
    uri: `at://did:plc:a/dev.nekono.skyshare.entry/${id}`,
    value: { source: { uri: `at://did:plc:a/app.bsky.feed.post/${sourceId}` } },
})

describe("識別子", () => {
    it("makeRunTagで作った識別子は対象形式で、時刻を取り出せる", () => {
        const tag = makeRunTag(1_700_000_000_000)
        expect(isE2eText(`${tag} 本文`)).toBe(true)
        expect(e2eTagTimeMs(`${tag} 本文`)).toBe(1_700_000_000_000)
    })

    it.each([
        ["[e2e] thread 1/2"],
        ["[E2E abc] x"],
        ["元からある投稿 [e2e abc] x"],
        ["[e2e abc]x"],
        [""],
        [undefined],
    ])("e2elive/AC-5: 形式に合わない本文は対象外（%s）", text => {
        expect(isE2eText(text)).toBe(false)
        expect(e2eTagTimeMs(text)).toBeNull()
    })
})

describe("planDeletion", () => {
    const posts = [
        post("1", "[e2e aaa] one"),
        post("2", "[e2e aaa] two"),
        post("3", "[e2e bbb] other run"),
        post("4", "元からある投稿"),
    ]
    const entries = [entry("e1", "1"), entry("e3", "3"), entry("e4", "4")]

    it("e2elive/AC-6: matchに一致する識別子付き投稿と、そのentryだけを選ぶ", () => {
        const plan = planDeletion({
            posts,
            entries,
            match: t => t.startsWith("[e2e aaa] "),
        })
        expect(plan.postUris.map(u => u.split("/").pop())).toEqual(["1", "2"])
        expect(plan.entryUris.map(u => u.split("/").pop())).toEqual(["e1"])
    })

    it("e2elive/AC-6: matchが常にtrueでも、形式に合わない投稿・そのentryは選ばない", () => {
        const plan = planDeletion({ posts, entries, match: () => true })
        expect(plan.postUris).toHaveLength(3)
        expect(plan.entryUris.map(u => u.split("/").pop())).toEqual([
            "e1",
            "e3",
        ])
    })

    it("includePosts=falseならentryだけを選ぶ", () => {
        const plan = planDeletion({
            posts,
            entries,
            match: t => t.startsWith("[e2e aaa] "),
            includePosts: false,
        })
        expect(plan.postUris).toEqual([])
        expect(plan.entryUris).toHaveLength(1)
    })

    it("e2elive/AC-7: 上限を超える場合は何も返さず例外にする", () => {
        expect(() =>
            planDeletion({ posts, entries, match: () => true, limit: 4 }),
        ).toThrow(/上限/)
    })
})
