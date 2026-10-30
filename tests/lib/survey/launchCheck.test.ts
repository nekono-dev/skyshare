/** 起動時の判定（除外ページ・端末の記録・サーバー確認）の手順と通信の有無を確認する。 */
import { describe, expect, it, vi } from "vitest"
import { decideLaunch, isSurveyPageExcluded } from "@/lib/survey/launchCheck"
import type { SurveyApi } from "@/lib/survey/client"

const surveyId = "survey-2026"
const did = "did:plc:alice"
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

/**
 * 呼び出し回数を数えるAPIの代役を作る。
 * Input: 確認と登録の結果。Output: 代役と呼び出し用のspy。
 * 例: createApi("unanswered", "registered").checkAnswered("x")は"unanswered"を返す。
 */
const createApi = (
    check:
        | Awaited<ReturnType<SurveyApi["checkAnswered"]>>
        | "throw" = "unanswered",
    register:
        | Awaited<ReturnType<SurveyApi["registerAnswered"]>>
        | "throw" = "registered",
) => {
    const checkAnswered = vi.fn(async () => {
        if (check === "throw") throw new Error("network")
        return check
    })
    const registerAnswered = vi.fn(async () => {
        if (register === "throw") throw new Error("network")
        return register
    })
    return {
        checkAnswered,
        registerAnswered,
        api: { checkAnswered, registerAnswered },
    }
}

/** 記録を直接置く。Input: 記録の値。Output: なし。 */
const seed = (storage: Storage, record: unknown) => {
    storage.setItem(key, JSON.stringify(record))
}

const readRecord = (storage: Storage) =>
    JSON.parse(storage.getItem(key) ?? "null")

describe("SurveyLaunchCheck: decideLaunch", () => {
    it("[2.1] 記録にdidがあれば通信せず none、記録は変えない", async () => {
        const storage = createStorage()
        seed(storage, { answered: true, dids: [did] })
        const { api, checkAnswered, registerAnswered } = createApi()

        const outcome = await decideLaunch({ surveyId, did, api, storage })

        expect(outcome).toBe("none")
        expect(checkAnswered).not.toHaveBeenCalled()
        expect(registerAnswered).not.toHaveBeenCalled()
        expect(readRecord(storage)).toEqual({ answered: true, dids: [did] })
    })

    it("[2.1] 記録にdidがあれば、答えが未回答の記録でも通信しない", async () => {
        const storage = createStorage()
        seed(storage, { answered: false, dids: [did] })
        const { api, checkAnswered, registerAnswered } = createApi()

        expect(await decideLaunch({ surveyId, did, api, storage })).toBe("none")
        expect(checkAnswered).not.toHaveBeenCalled()
        expect(registerAnswered).not.toHaveBeenCalled()
    })

    it("[2.2] 端末が回答済みで登録が成功なら did を記録に加え、none", async () => {
        const storage = createStorage()
        seed(storage, { answered: true, dids: ["did:plc:bob"] })
        const { api, checkAnswered, registerAnswered } = createApi(
            "unanswered",
            "registered",
        )

        const outcome = await decideLaunch({ surveyId, did, api, storage })

        expect(outcome).toBe("none")
        expect(registerAnswered).toHaveBeenCalledWith(surveyId)
        expect(checkAnswered).not.toHaveBeenCalled()
        expect(readRecord(storage)).toEqual({
            answered: true,
            dids: ["did:plc:bob", did],
        })
    })

    it.each(["gone"] as const)(
        "[2.2][2.6][2.7] 端末が回答済みで登録が %s なら none、記録は変えない",
        async result => {
            const storage = createStorage()
            seed(storage, { answered: true, dids: ["did:plc:bob"] })
            const { api, checkAnswered } = createApi("unanswered", result)

            expect(await decideLaunch({ surveyId, did, api, storage })).toBe(
                "none",
            )
            expect(checkAnswered).not.toHaveBeenCalled()
            expect(readRecord(storage)).toEqual({
                answered: true,
                dids: ["did:plc:bob"],
            })
        },
    )

    it("[2.2][2.7] 端末が回答済みで登録が例外を投げても none、記録は変えない", async () => {
        const storage = createStorage()
        seed(storage, { answered: true, dids: [] })
        const { api } = createApi("unanswered", "throw")

        expect(await decideLaunch({ surveyId, did, api, storage })).toBe("none")
        expect(readRecord(storage)).toEqual({ answered: true, dids: [] })
    })

    it("[2.3][2.5] 未記録で確認が未回答なら ask、記録は変えない", async () => {
        const storage = createStorage()
        const { api, checkAnswered, registerAnswered } = createApi("unanswered")

        const outcome = await decideLaunch({ surveyId, did, api, storage })

        expect(outcome).toBe("ask")
        expect(checkAnswered).toHaveBeenCalledWith(surveyId)
        expect(registerAnswered).not.toHaveBeenCalled()
        expect(storage.getItem(key)).toBeNull()
    })

    it("[2.3][2.4] 未記録で確認が回答済みなら記録して none", async () => {
        const storage = createStorage()
        const { api, checkAnswered } = createApi("answered")

        const outcome = await decideLaunch({ surveyId, did, api, storage })

        expect(outcome).toBe("none")
        expect(checkAnswered).toHaveBeenCalledWith(surveyId)
        expect(readRecord(storage)).toEqual({ answered: true, dids: [did] })
    })

    it.each(["gone"] as const)(
        "[2.6][2.7] 未記録で確認が %s なら none、記録は変えない",
        async result => {
            const storage = createStorage()
            const { api } = createApi(result)

            expect(await decideLaunch({ surveyId, did, api, storage })).toBe(
                "none",
            )
            expect(storage.getItem(key)).toBeNull()
        },
    )

    it("未記録で確認に失敗したら入口を残し、回答済みとは記録しない", async () => {
        const storage = createStorage()
        const { api } = createApi("failed")
        expect(await decideLaunch({ surveyId, did, api, storage })).toBe("ask")
        expect(storage.getItem(key)).toBeNull()
    })

    it("[2.7] 未記録で確認が例外を投げても ask、記録は変えない", async () => {
        const storage = createStorage()
        const { api } = createApi("throw")

        expect(await decideLaunch({ surveyId, did, api, storage })).toBe("ask")
        expect(storage.getItem(key)).toBeNull()
    })

    it("[2.8] 壊れた記録は未記録として扱い、確認の結果に従う", async () => {
        const storage = createStorage()
        storage.setItem(key, "{")
        const { api, checkAnswered } = createApi("unanswered")

        expect(await decideLaunch({ surveyId, did, api, storage })).toBe("ask")
        expect(checkAnswered).toHaveBeenCalledTimes(1)
    })

    it("[2.9] 記録の書き込みができなくても例外を投げず、判定を返す", async () => {
        const storage = createStorage()
        storage.setItem = () => {
            throw new Error("QuotaExceeded")
        }
        const { api } = createApi("answered")

        await expect(
            decideLaunch({ surveyId, did, api, storage }),
        ).resolves.toBe("none")
    })
})

describe("SurveyLaunchCheck: isSurveyPageExcluded", () => {
    it.each(["/privacy", "/privacy/"])(
        "[1.4] プライバシーポリシーのページ %s は除外する",
        pathname => {
            expect(isSurveyPageExcluded(pathname, "")).toBe(true)
        },
    )

    it("[1.3] ゲスト表示の印があるページは除外する", () => {
        expect(isSurveyPageExcluded("/entries/", "?guest=1")).toBe(true)
        expect(isSurveyPageExcluded("/", "guest")).toBe(true)
    })

    it.each([
        ["/", ""],
        ["/entries/", "?foo=1"],
        ["/privacy-policy/", ""],
        ["/settings/", "?guestbook=1"],
    ])("[1.1] 対象のページ %s %s は除外しない", (pathname, search) => {
        expect(isSurveyPageExcluded(pathname, search)).toBe(false)
    })
})
