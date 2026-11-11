/**
 * Verifies build metadata and production entry URLs.
 */
import { describe, expect, it } from "vitest"
import { buildInfo } from "@/lib/site/buildInfo"
import { serviceVersion } from "@/vars"
import { skyshareEntryUrlgen } from "@/lib/entry/url"
import { GUEST_SAMPLE_ENTRY_PATH } from "@/lib/timeline/guest"

describe("version values", () => {
    it("uses unknown for an unset version and null for commit and repository", () => {
        expect(buildInfo.version).toBe("unknown")
        expect(buildInfo.commit).toBeNull()
        expect(buildInfo.repository).toBeNull()
    })

    it("returns the embedded service version as a string", () => {
        expect(serviceVersion).toBe(`${import.meta.env.PUBLIC_VERSION}`)
    })
})

describe("URLs use the production domain", () => {
    it("builds entry URLs from the production domain and handle@rkey", () => {
        expect(skyshareEntryUrlgen("alice.test", "3lxyz")).toBe(
            "https://skyshare.nekono.dev/entries/alice.test@3lxyz/",
        )
    })

    it("prefixes the guest sample post path with the production domain", () => {
        expect(GUEST_SAMPLE_ENTRY_PATH).toBe(
            "https://skyshare.nekono.dev/entries/sample/",
        )
    })
})
