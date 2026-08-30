import { describe, expect, it } from "vitest"

import { computeHighlightSegments } from "@/util/textarea/facetHighlightSegments"

describe("computeHighlightSegments", () => {
    it("空文字列は空配列を返す", () => {
        expect(computeHighlightSegments("")).toEqual([])
    })

    it("ハッシュタグ/メンション/URLを含まない本文は非ハイライトの1セグメント", () => {
        expect(computeHighlightSegments("こんにちは")).toEqual([
            { text: "こんにちは", highlighted: false },
        ])
    })

    it("#の直後に1文字入力しただけで即座にハイライトされる", () => {
        expect(computeHighlightSegments("#n")).toEqual([
            { text: "#n", highlighted: true },
        ])
    })

    it("＃（全角）の直後でも即座にハイライトされる", () => {
        expect(computeHighlightSegments("＃猫")).toEqual([
            { text: "＃猫", highlighted: true },
        ])
    })

    it("@の直後に1文字入力しただけで即座にハイライトされる（ドメイン形式でなくてよい）", () => {
        expect(computeHighlightSegments("@alice")).toEqual([
            { text: "@alice", highlighted: true },
        ])
    })

    it("httpsのURLはプロトコル直後に1文字続いた時点で即座にハイライトされる", () => {
        expect(computeHighlightSegments("https://a")).toEqual([
            { text: "https://a", highlighted: true },
        ])
    })

    it("httpのURLもハイライトされる", () => {
        expect(computeHighlightSegments("http://example.com/path")).toEqual([
            { text: "http://example.com/path", highlighted: true },
        ])
    })

    it("メールアドレスの@は誤ってハイライトしない（空白/行頭直後のみが対象）", () => {
        expect(computeHighlightSegments("mail@example.com 宛に")).toEqual([
            { text: "mail@example.com 宛に", highlighted: false },
        ])
    })

    it("C#のような単語中の#は誤ってハイライトしない", () => {
        expect(computeHighlightSegments("C#言語の話")).toEqual([
            { text: "C#言語の話", highlighted: false },
        ])
    })

    it("前後にプレーンテキストを含むタグをセグメント分割する", () => {
        expect(computeHighlightSegments("今日も #猫 がかわいい")).toEqual([
            { text: "今日も ", highlighted: false },
            { text: "#猫", highlighted: true },
            { text: " がかわいい", highlighted: false },
        ])
    })

    it("複数のタグ/メンション/URLが混在する本文を分割する", () => {
        expect(
            computeHighlightSegments(
                "@alice と #猫 と https://example.com を見て #犬",
            ),
        ).toEqual([
            { text: "@alice", highlighted: true },
            { text: " と ", highlighted: false },
            { text: "#猫", highlighted: true },
            { text: " と ", highlighted: false },
            { text: "https://example.com", highlighted: true },
            { text: " を見て ", highlighted: false },
            { text: "#犬", highlighted: true },
        ])
    })

    it("句読点の直前まででハイライトが止まる", () => {
        expect(computeHighlightSegments("#neko、こんにちは")).toEqual([
            { text: "#neko", highlighted: true },
            { text: "、こんにちは", highlighted: false },
        ])
    })

    it("URL内のパス部分の#はハッシュタグとして二重にマッチしない", () => {
        const segments = computeHighlightSegments(
            "見て https://example.com/#frag すごい",
        )
        expect(segments).toEqual([
            { text: "見て ", highlighted: false },
            { text: "https://example.com/#frag", highlighted: true },
            { text: " すごい", highlighted: false },
        ])
    })

    it("セグメントを連結すると元のテキストに一致する", () => {
        const text =
            "今日も #猫 と @alice がかわいい、本当に https://example.com へ"
        const segments = computeHighlightSegments(text)
        expect(segments.map(s => s.text).join("")).toBe(text)
    })
})
