import { describe, expect, it } from "vitest"

import { detectSuggestTrigger } from "@/util/textarea/suggestTrigger"

describe("detectSuggestTrigger", () => {
    it("文字列先頭の@メンションを検出する", () => {
        const text = "@alice"
        expect(detectSuggestTrigger(text, text.length)).toEqual({
            kind: "mention",
            startIndex: 0,
            query: "alice",
        })
    })

    it("空白直後の@メンションを検出する", () => {
        const text = "こんにちは @alice"
        expect(detectSuggestTrigger(text, text.length)).toEqual({
            kind: "mention",
            startIndex: 6,
            query: "alice",
        })
    })

    it("空白直後の日本語#ハッシュタグを検出する", () => {
        const text = "今日も #猫"
        expect(detectSuggestTrigger(text, text.length)).toEqual({
            kind: "hashtag",
            startIndex: 4,
            query: "猫",
        })
    })

    it("全角＃も検出する", () => {
        const text = "＃猫"
        expect(detectSuggestTrigger(text, text.length)).toEqual({
            kind: "hashtag",
            startIndex: 0,
            query: "猫",
        })
    })

    it("トリガー記号直後（クエリが空文字）でも検出する", () => {
        const text = "@"
        expect(detectSuggestTrigger(text, 1)).toEqual({
            kind: "mention",
            startIndex: 0,
            query: "",
        })
    })

    it("メールアドレスのように空白を挟まない@は検出しない", () => {
        const text = "foo@example.com"
        expect(detectSuggestTrigger(text, text.length)).toBeNull()
    })

    it("トリガー記号が含まれない文字列はnullを返す", () => {
        const text = "こんにちは"
        expect(detectSuggestTrigger(text, text.length)).toBeNull()
    })

    it("caretIndexが先頭(0)ならnullを返す", () => {
        expect(detectSuggestTrigger("@alice", 0)).toBeNull()
    })

    it("直前のトークンが@/#で始まっていなければ検出しない", () => {
        const text = "@alice bob"
        // カーソル直前のトークンは"bob"で、その直前の文字は空白（"@"でも"#"でもない）ため検出しない
        expect(detectSuggestTrigger(text, text.length)).toBeNull()
    })

    it("クエリが長すぎる場合はnullを返す", () => {
        const text = `@${"a".repeat(41)}`
        expect(detectSuggestTrigger(text, text.length)).toBeNull()
    })
})
