import { describe, expect, it } from "vitest"
import { findUrlRanges } from "@/util/autoLink"

/** 検出した範囲の文字列とリンク先の組を返す（テスト用） */
const linksOf = (text: string) =>
    findUrlRanges(text).map(range => ({
        text: text.slice(range.start, range.end),
        href: range.href,
    }))

describe("findUrlRanges", () => {
    it("[post-rich-text/AC-8] スキームを省略したURLに https を補う", () => {
        expect(linksOf("見て example.com/a?b=1#c です")).toEqual([
            {
                text: "example.com/a?b=1#c",
                href: "https://example.com/a?b=1#c",
            },
        ])
    })

    it("[post-rich-text/AC-8] 日本語に空白なしで続くURLを検出する", () => {
        expect(linksOf("見てexample.comです")).toEqual([
            { text: "example.com", href: "https://example.com" },
        ])
        expect(linksOf("「https://example.com/x」")).toEqual([
            { text: "https://example.com/x", href: "https://example.com/x" },
        ])
    })

    it("[post-rich-text/AC-10] メールアドレス・メンション・版の表記はURLにしない", () => {
        expect(linksOf("mail@example.com")).toEqual([])
        expect(linksOf("@alice.bsky.social")).toEqual([])
        expect(linksOf("v1.0.0 と file.txt")).toEqual([])
    })

    it("スキームありのURLはそのままリンク先にする", () => {
        expect(linksOf("http://a.example/b と https://c.example")).toEqual([
            { text: "http://a.example/b", href: "http://a.example/b" },
            { text: "https://c.example", href: "https://c.example" },
        ])
    })

    it("末尾の文の区切りと対応の無い閉じ括弧を範囲から除く", () => {
        expect(linksOf("(example.com/a). 次")).toEqual([
            { text: "example.com/a", href: "https://example.com/a" },
        ])
        expect(linksOf("https://en.wikipedia.org/wiki/A_(b)")).toEqual([
            {
                text: "https://en.wikipedia.org/wiki/A_(b)",
                href: "https://en.wikipedia.org/wiki/A_(b)",
            },
        ])
    })

    it("スキームだけの文字列はURLにしない", () => {
        expect(linksOf("https:// のみ")).toEqual([])
    })
})
