// 文字だけの複数の区切りから組み立てた提出の内容を、分割の前の値で固定する（要件 1.3）。
// 画像・動画・OGP の読み込みと、外部の通信は対象外（読み込みを必要としない文字だけの区切りに限る）。
import { describe, expect, it } from "vitest"
import { buildThreadRequestBody } from "@/components/composer/ThreadComposer/rules/submitThread"
import {
    createEmptySegment,
    type SegmentState,
} from "@/components/composer/ThreadComposer/rules/segments"

const textSegment = (text: string, languageCode = "ja"): SegmentState => ({
    ...createEmptySegment(languageCode),
    text,
})

describe("buildThreadRequestBody（文字だけの区切り）", () => {
    it("区切りの順序どおりに posts を並べ、本文と言語を入れる", async () => {
        const built = await buildThreadRequestBody({
            segments: [textSegment("一つ目"), textSegment("two", "en")],
            manualImageAttach: false,
        })

        expect(built.ok).toBe(true)
        if (!built.ok) return
        expect(built.wantsSkyshareEntry).toBe(false)
        // 提出の本文は `posts` を持つが、API 型（CreateEntryBody）には現れないため、読み取りの型を明示する
        const { posts } = built.body as unknown as {
            posts: { text: string; langs: string[] }[]
        }
        expect(posts.map(p => p.text)).toEqual(["一つ目", "two"])
        expect(posts.map(p => p.langs)).toEqual([["ja"], ["en"]])
    })

    it("文字だけの区切りでは、Entry の指定（createEntry）を付けない", async () => {
        const built = await buildThreadRequestBody({
            segments: [textSegment("a")],
            manualImageAttach: false,
        })

        expect(built.ok).toBe(true)
        if (!built.ok) return
        expect("createEntry" in built.body).toBe(false)
    })
})
