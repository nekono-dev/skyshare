// wrangler 設定からの Worker 名の読み取り（scripts/lib/wrangler.mjs）と、設定の不足を例外にすること（scripts/config/render-wrangler.mjs の readConfig）
import { describe, expect, it } from "vitest"
import { workerNameFrom } from "../../../scripts/lib/wrangler.mjs"
import {
    RenderError,
    readConfig,
} from "../../../scripts/config/render-wrangler.mjs"

describe("workerNameFrom", () => {
    it("トップレベルの name を返し、入れ子の name は取らない", () => {
        const source = `{
      // コメントと末尾のカンマを許す
      "d1_databases": [{ "name": "not-the-worker" },],
      "name": "skyshare",
    }`
        expect(workerNameFrom(source)).toBe("skyshare")
    })

    it("name が無い・空・文字列でないときは例外にする", () => {
        expect(() => workerNameFrom(`{ "d1_databases": [] }`)).toThrow()
        expect(() => workerNameFrom(`{ "name": "  " }`)).toThrow()
        expect(() => workerNameFrom(`{ "name": 1 }`)).toThrow()
    })
})

describe("readConfig", () => {
    it("設定ファイルが無いときは process.exit せず RenderError を投げる", () => {
        expect(() => readConfig("__no_such_config__")).toThrow(RenderError)
    })
})
