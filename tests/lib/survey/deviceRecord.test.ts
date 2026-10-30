/** 端末の回答済み記録とタブ内辞退の保存・破損・例外時の契約を確認する。 */
import { afterEach, describe, expect, it, vi } from "vitest"
import {
    isDeclinedInTab,
    markDeclinedInTab,
    readDeviceRecord,
    rememberAnswered,
} from "@/lib/survey/deviceRecord"

const surveyId = "survey-2026"
const key = `skyshare.survey.${surveyId}`

/**
 * テストごとに独立したStorageを作る。
 * Input: なし。Output: Storage。例: setItem("a", "b")後のgetItem("a")は"b"。
 */
const createStorage = (): Storage => {
    const values = new Map<string, string>()
    return {
        get length() {
            return values.size
        },
        clear: () => values.clear(),
        getItem: name => values.get(name) ?? null,
        key: index => [...values.keys()][index] ?? null,
        removeItem: name => {
            values.delete(name)
        },
        setItem: (name, value) => {
            values.set(name, value)
        },
    }
}

afterEach(() => vi.unstubAllGlobals())

describe("SurveyDeviceRecord", () => {
    it("[2.8] 未保存は記録なし、戻り値の変更は別の読み出しへ影響しない", () => {
        const storage = createStorage()
        readDeviceRecord(surveyId, storage).dids.push("did:plc:a")
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: false,
            dids: [],
        })
    })

    it.each([
        "{",
        "null",
        "[]",
        '"text"',
        "{}",
        '{"answered":1,"dids":[]}',
        '{"answered":true,"dids":"did:plc:a"}',
        '{"answered":true,"dids":[1]}',
        '{"dids":[]}',
    ])("[2.8] 不正JSON/形 %s は記録なし", raw => {
        const storage = createStorage()
        storage.setItem(key, raw)
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: false,
            dids: [],
        })
    })

    it("[2.1, 2.10, 4.3] 回答済みとdidだけを保存し重複追加しない", () => {
        const storage = createStorage()
        rememberAnswered(surveyId, "did:plc:a", storage)
        rememberAnswered(surveyId, "did:plc:b", storage)
        rememberAnswered(surveyId, "did:plc:a", storage)
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: true,
            dids: ["did:plc:a", "did:plc:b"],
        })
        expect(JSON.parse(storage.getItem(key)!)).toEqual({
            answered: true,
            dids: ["did:plc:a", "did:plc:b"],
        })
        expect(storage.length).toBe(1)
        expect(readDeviceRecord("another-survey", storage)).toEqual({
            answered: false,
            dids: [],
        })
    })

    it("[2.8, 4.3] 壊れた記録も回答済みに更新でき、既存の重複didも除去する", () => {
        const storage = createStorage()
        storage.setItem(key, "{")
        rememberAnswered(surveyId, "did:plc:a", storage)
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: true,
            dids: ["did:plc:a"],
        })
        storage.setItem(
            key,
            JSON.stringify({
                answered: false,
                dids: ["did:plc:a", "did:plc:a"],
            }),
        )
        rememberAnswered(surveyId, "did:plc:b", storage)
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: true,
            dids: ["did:plc:a", "did:plc:b"],
        })
    })

    it("[2.8] 正しいfalseの記録も読める", () => {
        const storage = createStorage()
        storage.setItem(
            key,
            JSON.stringify({ answered: false, dids: ["did:plc:a"] }),
        )
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: false,
            dids: ["did:plc:a"],
        })
    })

    it("[5.5, 5.6] 辞退は同じタブ・同じsurveyだけで固定印を保存する", () => {
        const storage = createStorage()
        expect(isDeclinedInTab(surveyId, storage)).toBe(false)
        markDeclinedInTab(surveyId, storage)
        expect(isDeclinedInTab(surveyId, storage)).toBe(true)
        expect(storage.getItem(`${key}.declined`)).toBe("1")
        expect(storage.getItem(key)).toBeNull()
        expect(isDeclinedInTab("another-survey", storage)).toBe(false)
        expect(isDeclinedInTab(surveyId, createStorage())).toBe(false)
        storage.setItem(`${key}.declined`, "false")
        expect(isDeclinedInTab(surveyId, storage)).toBe(false)
    })

    it("[2.8, 2.9, 5.5] Storageの読書き例外は外へ出さない", () => {
        const storage = createStorage()
        storage.getItem = () => {
            throw new Error("read blocked")
        }
        storage.setItem = () => {
            throw new Error("write blocked")
        }
        expect(readDeviceRecord(surveyId, storage)).toEqual({
            answered: false,
            dids: [],
        })
        expect(isDeclinedInTab(surveyId, storage)).toBe(false)
        expect(() =>
            rememberAnswered(surveyId, "did:plc:a", storage),
        ).not.toThrow()
        expect(() => markDeclinedInTab(surveyId, storage)).not.toThrow()
    })

    it("[2.9] 読み出し成功後の書き込み例外も外へ出さない", () => {
        const storage = createStorage()
        storage.setItem = () => {
            throw new Error("quota exceeded")
        }
        expect(() =>
            rememberAnswered(surveyId, "did:plc:a", storage),
        ).not.toThrow()
        expect(() => markDeclinedInTab(surveyId, storage)).not.toThrow()
    })

    it("[2.8, 2.9] SSRではStorageなしとして動作する", () => {
        vi.stubGlobal("window", undefined)
        expect(readDeviceRecord(surveyId)).toEqual({
            answered: false,
            dids: [],
        })
        expect(isDeclinedInTab(surveyId)).toBe(false)
        expect(() => rememberAnswered(surveyId, "did:plc:a")).not.toThrow()
        expect(() => markDeclinedInTab(surveyId)).not.toThrow()
    })

    it("[2.8, 2.9] windowのStorage取得getterが投げても外へ出さない", () => {
        vi.stubGlobal(
            "window",
            Object.defineProperties(
                {},
                {
                    localStorage: {
                        get: () => {
                            throw new Error("blocked")
                        },
                    },
                    sessionStorage: {
                        get: () => {
                            throw new Error("blocked")
                        },
                    },
                },
            ),
        )
        expect(readDeviceRecord(surveyId)).toEqual({
            answered: false,
            dids: [],
        })
        expect(isDeclinedInTab(surveyId)).toBe(false)
        expect(() => rememberAnswered(surveyId, "did:plc:a")).not.toThrow()
        expect(() => markDeclinedInTab(surveyId)).not.toThrow()
    })

    it("[2.10, 5.5, 5.6] 既定Storageは呼び出し時に取得し回答と辞退を分離する", () => {
        const localStorage = createStorage()
        const sessionStorage = createStorage()
        vi.stubGlobal("window", { localStorage, sessionStorage })
        rememberAnswered(surveyId, "did:plc:a")
        markDeclinedInTab(surveyId)
        expect(readDeviceRecord(surveyId).answered).toBe(true)
        expect(isDeclinedInTab(surveyId)).toBe(true)
        expect(localStorage.length).toBe(1)
        expect(sessionStorage.length).toBe(1)
        expect(localStorage.getItem(`${key}.declined`)).toBeNull()
        expect(sessionStorage.getItem(key)).toBeNull()
        vi.stubGlobal("window", {
            localStorage: createStorage(),
            sessionStorage: createStorage(),
        })
        expect(readDeviceRecord(surveyId)).toEqual({
            answered: false,
            dids: [],
        })
        expect(isDeclinedInTab(surveyId)).toBe(false)
    })
})
