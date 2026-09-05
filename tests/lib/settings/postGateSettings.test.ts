import { afterEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_POST_GATE_VALUE, type PostGateValue } from "@/lib/atproto/gate"
import {
    isDefaultPostGateValue,
    readPostGateDefaultSetting,
    readSyncGateDefaultAfterPostSetting,
    writePostGateDefaultSetting,
    writeSyncGateDefaultAfterPostSetting,
} from "@/lib/settings/postGateSettings"

/**
 * テスト用の最小限の localStorage 実装（メモリ上に値を保持するだけ）。
 */
const createMemoryLocalStorage = () => {
    const store = new Map<string, string>()
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value)
        },
        removeItem: (key: string) => {
            store.delete(key)
        },
    }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("readPostGateDefaultSetting", () => {
    it("未設定時はDEFAULT_POST_GATE_VALUEを返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readPostGateDefaultSetting()).toEqual(DEFAULT_POST_GATE_VALUE)
    })

    it("破損したJSONの場合はDEFAULT_POST_GATE_VALUEへフォールバックする", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem("postGateDefault", "not json")
        vi.stubGlobal("window", { localStorage })
        expect(readPostGateDefaultSetting()).toEqual(DEFAULT_POST_GATE_VALUE)
    })

    it("形状が不正な場合はDEFAULT_POST_GATE_VALUEへフォールバックする", () => {
        const localStorage = createMemoryLocalStorage()
        localStorage.setItem(
            "postGateDefault",
            JSON.stringify({ replyAudience: "invalid" }),
        )
        vi.stubGlobal("window", { localStorage })
        expect(readPostGateDefaultSetting()).toEqual(DEFAULT_POST_GATE_VALUE)
    })

    it("書き込み→読み込みのラウンドトリップが成立する", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })

        const value: PostGateValue = {
            replyAudience: "custom",
            allowMentioned: true,
            allowFollower: false,
            allowFollowing: true,
            listUris: ["at://did:plc:abc/app.bsky.graph.list/1"],
            allowQuote: false,
        }
        writePostGateDefaultSetting(value)

        expect(readPostGateDefaultSetting()).toEqual(value)
    })
})

describe("isDefaultPostGateValue", () => {
    it("既定のデフォルト値と一致する場合はtrue", () => {
        expect(isDefaultPostGateValue(DEFAULT_POST_GATE_VALUE)).toBe(true)
    })

    it("replyAudienceが異なる場合はfalse", () => {
        expect(
            isDefaultPostGateValue({
                ...DEFAULT_POST_GATE_VALUE,
                replyAudience: "nobody",
            }),
        ).toBe(false)
    })

    it("allowQuoteが異なる場合はfalse", () => {
        expect(
            isDefaultPostGateValue({
                ...DEFAULT_POST_GATE_VALUE,
                allowQuote: false,
            }),
        ).toBe(false)
    })
})

describe("readSyncGateDefaultAfterPostSetting / writeSyncGateDefaultAfterPostSetting", () => {
    it("未設定時はdefaultValueを返す", () => {
        vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() })
        expect(readSyncGateDefaultAfterPostSetting(false)).toBe(false)
    })

    it("書き込み→読み込みのラウンドトリップが成立する", () => {
        const localStorage = createMemoryLocalStorage()
        vi.stubGlobal("window", { localStorage })

        writeSyncGateDefaultAfterPostSetting(true)

        expect(readSyncGateDefaultAfterPostSetting(false)).toBe(true)
    })
})
