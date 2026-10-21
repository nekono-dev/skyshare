/**
 * Entry詳細ページの本文表示（`EntryDetailView`）の描画テスト。
 *
 * 責務と処理概要:
 * - 実PDSのレコードに依存するSSR取得（`entries/[slug].astro`）を介さずに、
 *   ヘッダーカード・派生元が削除済みの案内・エラー表示を、props から直接描画して確認する。
 */
import { describe, expect, it } from "vitest"

import EntryDetailView from "@/components/entry/EntryDetailView/index.astro"
import { renderAstro, textOf } from "./support/renderAstro"

const baseProps = {
    statusCode: 200,
    heading: "見出しの文言",
    caption: "説明文の文言",
    createdAt: "2026-09-06T10:00:00.000Z",
    sourcePostAvailable: true,
    sourceUrl: "https://bsky.app/profile/a.test/post/3x",
    visualUrl: "",
    posts: [],
}

describe("EntryDetailView", () => {
    it("[entry-detail/AC-2] ヘッダーカードに説明文と作成日時が表示され、見出しの本文は表示されない", async () => {
        const text = textOf(await renderAstro(EntryDetailView, baseProps))
        expect(text).toContain("説明文の文言")
        expect(text).toContain("投稿日時")
        expect(text).toMatch(/2026/)
        expect(text).not.toContain("見出しの文言")
    })

    it("[entry-detail/AC-8] 派生元が削除済みの場合は案内文が表示され、リアクション数は表示されない", async () => {
        const html = await renderAstro(EntryDetailView, {
            ...baseProps,
            sourcePostAvailable: false,
            posts: [],
        })
        expect(textOf(html)).toContain("元の投稿は削除")
        expect(html).not.toContain('data-testid="entry-source-link"')
        expect(html).not.toContain("Blueskyでのリアクション数")
    })

    it("[entry-detail/AC-9] 存在しないentryの場合は、404のエラー表示になる", async () => {
        const html = await renderAstro(EntryDetailView, {
            ...baseProps,
            statusCode: 404,
        })
        const text = textOf(html)
        expect(text).toContain("Entry Not Found")
        expect(text).toContain("Entry is not found")
        expect(text).not.toContain("説明文の文言")
    })
})
