import { describe, expect, it, vi } from "vitest"

import { resolveDisplayName } from "@/lib/atproto/profile"

describe("resolveDisplayName", () => {
    it("displayNameがあればそれを採用する", async () => {
        const agent = {
            getProfile: vi
                .fn()
                .mockResolvedValue({ data: { displayName: "Alice" } }),
        }
        expect(
            await resolveDisplayName(agent, "did:plc:abc", "alice.bsky.social"),
        ).toBe("Alice")
    })

    it("displayNameが空文字ならfallbackHandleを採用する", async () => {
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
