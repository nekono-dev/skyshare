/**
 * 「自動ポップアップするSNS」の読み取りの特性化テスト（src-duplicates 1.3・要件 4.2・4.3）。
 * 旧キーのみの保存値は、移行を削除した後は既定値を示す（意図した変化）。新しいキーの値は変わらない。
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

describe("旧キーのみを持つ保存値（旧共有設定の移行は削除済み）", () => {
    it("移行を行わず、既定値を示す（意図した変化）", () => {
        const storage = createFakeStorage({ crosspostToTaittsuu: "true" })
        stubWindow(storage)
        expect(readAutoPopupTargetSetting("x")).toBe("x")
    })

    it("旧キーに触れず、新しいキーも作らない", () => {
        const storage = createFakeStorage({ crosspostToTaittsuu: "true" })
        stubWindow(storage)
        readAutoPopupTargetSetting("x")
        expect(storage.data.get("crosspostToTaittsuu")).toBe("true")
        expect(storage.data.has("autoPopupTarget")).toBe(false)
    })
})

describe("移行の済みの設定（新しいキーを持つ）", () => {
    it("新しいキーの値を示し、旧キーがあっても上書きしない", () => {
        const storage = createFakeStorage({
            autoPopupTarget: "mastodon",
            crosspostToTaittsuu: "true",
        })
        stubWindow(storage)
        expect(readAutoPopupTargetSetting("x")).toBe("mastodon")
        expect(storage.data.get("autoPopupTarget")).toBe("mastodon")
    })

    it("保存値が無いときは既定値を示す", () => {
        stubWindow(createFakeStorage({}))
        expect(readAutoPopupTargetSetting("ask")).toBe("ask")
    })
})
