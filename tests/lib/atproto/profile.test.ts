import { describe, expect, it, vi } from "vitest"

import { resolveDisplayName } from "@/lib/atproto/profile"

describe("resolveDisplayName", () => {
    it("[atproto-access/AC-5] displayNameがあればそれを採用する", async () => {
        const agent = {
            getProfile: vi
                .fn()
                .mockResolvedValue({ data: { displayName: "Alice" } }),
        }
        expect(
            await resolveDisplayName(agent, "did:plc:abc", "alice.bsky.social"),
        ).toBe("Alice")
    })

    it("[atproto-access/AC-4] displayNameが空文字ならfallbackHandleを採用する", async () => {
        const agent = {
            getProfile: vi
                .fn()
                .mockResolvedValue({ data: { displayName: "" } }),
        }
        expect(
            await resolveDisplayName(agent, "did:plc:abc", "alice.bsky.social"),
        ).toBe("alice.bsky.social")
    })

    it("displayNameがundefinedならfallbackHandleを採用する", async () => {
        const agent = { getProfile: vi.fn().mockResolvedValue({ data: {} }) }
        expect(
            await resolveDisplayName(agent, "did:plc:abc", "alice.bsky.social"),
        ).toBe("alice.bsky.social")
    })
})
