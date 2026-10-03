/**
 * DeletePostListDialogの描画内容（件数文言・本文省略時の表示・サムネイル・ボタン状態）の単体テスト。
 * node環境のため`renderToStaticMarkup`でHTML文字列を検証する。
 */
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import DeletePostListDialog from "@/components/entry/DeletePostListDialog"
import type { TimelinePost } from "@/lib/entry/posts"

const makePost = (
    id: string,
    overrides: Partial<TimelinePost> = {},
): TimelinePost => ({
    uri: `at://did:plc:a/app.bsky.feed.post/${id}`,
    cid: `cid-${id}`,
    url: `https://bsky.app/profile/a.test/post/${id}`,
    indexedAt: "2026-01-01T00:00:00.000Z",
    author: { did: "did:plc:a", handle: "a.test" },
    text: `本文${id}`,
    images: [],
    ...overrides,
})

const images = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
        url: `https://cdn.test/${i}.jpg`,
        alt: `alt${i}`,
        cid: `img${i}`,
    }))

const render = (
    props: Partial<React.ComponentProps<typeof DeletePostListDialog>>,
) =>
    renderToStaticMarkup(
        React.createElement(DeletePostListDialog, {
            open: true,
            posts: [makePost("1")],
            onConfirm: vi.fn(),
            onCancel: vi.fn(),
            ...props,
        }),
    )

describe("DeletePostListDialog", () => {
    it("1件なら単発の文言と本文を表示する", () => {
        const html = render({})
        expect(html).toContain("Blueskyの投稿1件を削除します。")
        expect(html).toContain("本文1")
        expect(html).not.toContain("<img")
    })

    it("複数件なら件数入りの文言で、古い順に並ぶ", () => {
        const html = render({ posts: [makePost("1"), makePost("2")] })
        expect(html).toContain("Blueskyのスレッド（2件の投稿）を削除します。")
        expect(html.indexOf("本文1")).toBeLessThan(html.indexOf("本文2"))
    })

    it("本文が空なら「（本文なし）」を表示する", () => {
        expect(render({ posts: [makePost("1", { text: "" })] })).toContain(
            "（本文なし）",
        )
    })

    it("画像は最大4枚で、超過分は「+N」を表示する", () => {
        const html = render({ posts: [makePost("1", { images: images(6) })] })
        expect(html.match(/<img/g)).toHaveLength(4)
        expect(html).toContain("+2")
    })

    it("スレッド（2件以上）のみ一覧が固定高さのスクロール領域になる", () => {
        const single = render({})
        const thread = render({ posts: [makePost("1"), makePost("2")] })
        expect(single).not.toContain("post-list-fixed")
        expect(thread).toContain("post-list-fixed")
    })

    it("削除中は両ボタンが無効になる", () => {
        const html = render({ isDeleting: true })
        expect(html.match(/<button[^>]*disabled/g)).toHaveLength(2)
    })

    it("open=falseなら何も描画しない", () => {
        expect(render({ open: false })).toBe("")
    })
})
