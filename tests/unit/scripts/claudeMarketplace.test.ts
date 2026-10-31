// Claude の marketplace 一覧からの登録の判定（scripts/lib/claudeMarketplace.mjs）
import { describe, expect, it } from "vitest"
import { isMarketplaceListed } from "../../../scripts/lib/claudeMarketplace.mjs"

const listing = `Configured marketplaces:

  ❯ anthropic-plugin-directory
    Source: Built in (Anthropic Directory)

  ❯ nekono-dev
    Source: Folder (/home/ubuntu/.cache/skyshare/brw)
`

describe("isMarketplaceListed", () => {
    it("一覧にある名前は true", () => {
        expect(isMarketplaceListed(listing, "nekono-dev")).toBe(true)
    })

    it("名前の一部や別の名前は false（前方一致・部分一致をしない）", () => {
        expect(isMarketplaceListed(listing, "nekono")).toBe(false)
        expect(isMarketplaceListed(listing, "dev")).toBe(false)
        expect(
            isMarketplaceListed("Configured marketplaces:\n", "nekono-dev"),
        ).toBe(false)
    })
})
