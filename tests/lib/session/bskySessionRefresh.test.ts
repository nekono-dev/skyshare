import { describe, expect, it } from "vitest"

import { isManagedByThisMiddleware } from "@/lib/session/bskySessionRefresh"

describe("isManagedByThisMiddleware", () => {
    it("/v2/ 配下は対象", () => {
        expect(isManagedByThisMiddleware("/v2/entry")).toBe(true)
        expect(isManagedByThisMiddleware("/v2/entries")).toBe(true)
    })

    it("/v2/ 配下以外は対象外", () => {
        expect(isManagedByThisMiddleware("/v1/page")).toBe(false)
        expect(isManagedByThisMiddleware("/")).toBe(false)
    })

    it("/v2/bsky/session そのものは対象外", () => {
        expect(isManagedByThisMiddleware("/v2/bsky/session")).toBe(false)
    })

    it("/v2/bsky/session/{did} も対象外", () => {
        expect(isManagedByThisMiddleware("/v2/bsky/session/did:plc:abc")).toBe(
            false,
        )
    })

    it("/v2/bsky/session を含むが別リソースは対象", () => {
        expect(isManagedByThisMiddleware("/v2/bsky/sessions")).toBe(true)
    })
})
