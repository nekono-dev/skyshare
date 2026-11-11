/**
 * Reads current popup settings while safely ignoring obsolete stored keys.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { readAutoPopupTargetSetting } from "@/lib/settings/shareSettings"

const createFakeStorage = (initial: Record<string, string>) => {
    const data = new Map(Object.entries(initial))
    return {
        data,
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
            data.set(key, value)
        },
        removeItem: (key: string) => {
            data.delete(key)
        },
    }
}

const stubWindow = (storage: ReturnType<typeof createFakeStorage>) => {
    vi.stubGlobal("window", { localStorage: storage })
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("stored settings with legacy keys only", () => {
    it("uses defaults without migrating legacy keys", () => {
        const storage = createFakeStorage({ crosspostToTaittsuu: "true" })
        stubWindow(storage)
        expect(readAutoPopupTargetSetting("x")).toBe("x")
    })

    it("does not read legacy keys or create new keys", () => {
        const storage = createFakeStorage({ crosspostToTaittsuu: "true" })
        stubWindow(storage)
        readAutoPopupTargetSetting("x")
        expect(storage.data.get("crosspostToTaittsuu")).toBe("true")
        expect(storage.data.has("autoPopupTarget")).toBe(false)
    })
})

describe("stored settings with current keys", () => {
    it("uses current values without overwriting them from legacy keys", () => {
        const storage = createFakeStorage({
            autoPopupTarget: "mastodon",
            crosspostToTaittsuu: "true",
        })
        stubWindow(storage)
        expect(readAutoPopupTargetSetting("x")).toBe("mastodon")
        expect(storage.data.get("autoPopupTarget")).toBe("mastodon")
    })

    it("uses defaults when no setting is stored", () => {
        stubWindow(createFakeStorage({}))
        expect(readAutoPopupTargetSetting("ask")).toBe("ask")
    })
})
