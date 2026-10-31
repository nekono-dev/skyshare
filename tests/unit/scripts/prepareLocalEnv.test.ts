// ローカルのシークレットの補充（scripts/secrets/prepare-local-env.mjs の fillMissingSecrets）: 空の値だけを埋め、設定済みの値とコメントは変えない
import { describe, expect, it } from "vitest"
import { fillMissingSecrets } from "../../../scripts/secrets/prepare-local-env.mjs"

const generators = {
    SCHEDULE_ENC_KEY: async () => "NEW",
    SURVEY_HASH_KEY: async () => "HASH",
}

describe("fillMissingSecrets", () => {
    it("設定済みの値は変えず、無い名前は末尾に追記する", async () => {
        const result = await fillMissingSecrets(
            "SCHEDULE_ENC_KEY='keep'\nFOO=1\n",
            generators,
        )
        expect(result.content).toBe(
            "SCHEDULE_ENC_KEY='keep'\nFOO=1\nSURVEY_HASH_KEY='HASH'\n",
        )
        expect(result.filled).toEqual(["SURVEY_HASH_KEY"])
    })

    it("空の値は埋め、コメントアウトされた行は値として読まない", async () => {
        const result = await fillMissingSecrets(
            "#SCHEDULE_ENC_KEY=old\nSCHEDULE_ENC_KEY=''\n",
            generators,
        )
        expect(result.content).toBe(
            "#SCHEDULE_ENC_KEY=old\nSCHEDULE_ENC_KEY='NEW'\nSURVEY_HASH_KEY='HASH'\n",
        )
        expect(result.filled).toEqual(["SCHEDULE_ENC_KEY", "SURVEY_HASH_KEY"])
    })
})
