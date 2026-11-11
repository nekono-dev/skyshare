/**
 * Resolves Bluesky service endpoints from defaults and overrides.
 */
import { describe, expect, it } from "vitest"
import { resolveBlueskyEndpoints } from "@/lib/platform/blueskyEndpoints"

describe("resolveBlueskyEndpoints", () => {
    it("returns the production defaults when nothing is set", () => {
        expect(resolveBlueskyEndpoints({})).toEqual({
            authServer: "https://bsky.social",
            plcDirectory: "https://plc.directory",
            appView: "https://api.bsky.app",
            pdsOverride: undefined,
        })
    })

    it("uses each override when it is given", () => {
        expect(
            resolveBlueskyEndpoints({
                PUBLIC_BSKY_AUTH_SERVER_URL: "http://127.0.0.1:9001",
                PUBLIC_PLC_DIRECTORY_BASE_URL: "http://127.0.0.1:9002",
                PUBLIC_DEFAULT_ATP_SERVICE: "http://127.0.0.1:9003",
                BSKY_PDS_URL: "http://127.0.0.1:9004",
            }),
        ).toEqual({
            authServer: "http://127.0.0.1:9001",
            plcDirectory: "http://127.0.0.1:9002",
            appView: "http://127.0.0.1:9003",
            pdsOverride: "http://127.0.0.1:9004",
        })
    })

    it("treats an empty or blank value as unset", () => {
        expect(
            resolveBlueskyEndpoints({
                PUBLIC_BSKY_AUTH_SERVER_URL: "",
                PUBLIC_PLC_DIRECTORY_BASE_URL: "   ",
                BSKY_PDS_URL: "",
            }),
        ).toEqual({
            authServer: "https://bsky.social",
            plcDirectory: "https://plc.directory",
            appView: "https://api.bsky.app",
            pdsOverride: undefined,
        })
    })

    it("overrides only the given endpoint and keeps the others at their defaults", () => {
        const resolved = resolveBlueskyEndpoints({
            PUBLIC_BSKY_AUTH_SERVER_URL: "http://127.0.0.1:9001",
        })
        expect(resolved.authServer).toBe("http://127.0.0.1:9001")
        expect(resolved.plcDirectory).toBe("https://plc.directory")
        expect(resolved.appView).toBe("https://api.bsky.app")
    })
})
