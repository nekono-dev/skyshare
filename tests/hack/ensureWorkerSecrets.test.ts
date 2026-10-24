/**
 * 配備先のシークレットの自動登録（`hack/ensure-worker-secrets.mjs`）の検証。
 *
 * 責務と処理概要:
 * - 未登録のものだけを登録し、登録済みの値は上書きしない計画になることを確かめる。
 * - 同じ値にそろえる配信先の片方にだけあるとき、作り直してよいものは両方へ、そうでないものは失敗にすることを確かめる。
 */
import { describe, expect, it } from "vitest"
import {
    planSecretWrites,
    readWorkerName,
} from "../../hack/ensure-worker-secrets.mjs"

const regen = new Set(["OAUTH_CLIENT_KEY"])
const NAMES = ["SCHEDULE_ENC_KEY", "OAUTH_CLIENT_KEY"]

describe("planSecretWrites", () => {
    it("すべての配信先に登録済みなら何もしない", () => {
        const all = new Set(NAMES)
        expect(planSecretWrites(NAMES, [all, all], regen)).toEqual({
            writes: [],
            errors: [],
        })
    })

    it("どの配信先にも無いものは、1つの値を全ての配信先へ登録する", () => {
        const enc = new Set(["SCHEDULE_ENC_KEY", "SCHEDULE_OAUTH_KEY"])
        expect(planSecretWrites(NAMES, [enc, enc], regen)).toEqual({
            writes: [{ name: "OAUTH_CLIENT_KEY", targets: [0, 1] }],
            errors: [],
        })
        expect(planSecretWrites(NAMES, [new Set()], regen).writes).toEqual([
            { name: "SCHEDULE_ENC_KEY", targets: [0] },
            { name: "OAUTH_CLIENT_KEY", targets: [0] },
        ])
    })

    it("片方にだけあるとき、作り直してよいものは両方へ登録し直し、そうでないものは失敗にする", () => {
        const one = new Set(NAMES)
        expect(planSecretWrites(NAMES, [one, new Set()], regen)).toEqual({
            writes: [{ name: "OAUTH_CLIENT_KEY", targets: [0, 1] }],
            errors: ["SCHEDULE_ENC_KEY"],
        })
    })
})

describe("readWorkerName", () => {
    it("最初の name を Worker 名として読む", () => {
        expect(
            readWorkerName(
                '{\n  // コメント\n  "name": "skyshare-develop",\n  "d1_databases": [{ "database_name": "x" }]\n}',
            ),
        ).toBe("skyshare-develop")
        expect(() => readWorkerName("{}")).toThrow()
    })
})
