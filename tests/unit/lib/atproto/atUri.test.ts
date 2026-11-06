/**
 * AT URI の解析の特性化テスト（src-cycles 1.3・要件 3.2）。 移動後（3.6）は atproto/atUri.ts を対象にする。
 *
 * 責務と処理概要:
 * - AT URI の解析（所有者と収集の一致の判定を含む）の代表的な入力と出力を固定する。
 * - 移動の前後で、同じ結果になることを確かめる。
 */
import { describe, expect, it } from "vitest"
import { parseAtUri, parseOwnedAtUri } from "@/lib/atproto/atUri"

const uri = "at://did:plc:abc/app.bsky.feed.post/3lxyz"

describe("AT URI の解析（特性化）", () => {
    it("AT URI を repo・collection・rkey に分ける", () => {
        expect(parseAtUri(uri)).toEqual({
            repo: "did:plc:abc",
            collection: "app.bsky.feed.post",
            rkey: "3lxyz",
        })
    })

    it("AT URI でない文字列は undefined になる", () => {
        expect(parseAtUri("https://example.com")).toBeUndefined()
    })

    it("所有者と収集が一致すれば分解結果を返す", () => {
        expect(
            parseOwnedAtUri(uri, "app.bsky.feed.post", "did:plc:abc"),
        ).toEqual({
            repo: "did:plc:abc",
            collection: "app.bsky.feed.post",
            rkey: "3lxyz",
        })
    })

    it("所有者が一致しなければ undefined になる", () => {
        expect(
            parseOwnedAtUri(uri, "app.bsky.feed.post", "did:plc:other"),
        ).toBeUndefined()
    })
})
