/**
 * Tests filling missing local secrets while preserving configured values and comments.
 */
import { describe, expect, it } from "vitest"
import { fillMissingSecrets } from "../../../scripts/secrets/prepare-local-env.mjs"

const generators = {
    SCHEDULE_ENC_KEY: async () => "NEW",
    SURVEY_HASH_KEY: async () => "HASH",
}

describe("fillMissingSecrets", () => {
    it("preserves configured values and appends missing names", async () => {
        const result = await fillMissingSecrets(
            "SCHEDULE_ENC_KEY='keep'\nFOO=1\n",
            generators,
        )
        expect(result.content).toBe(
            "SCHEDULE_ENC_KEY='keep'\nFOO=1\nSURVEY_HASH_KEY='HASH'\n",
        )
        expect(result.filled).toEqual(["SURVEY_HASH_KEY"])
    })

    it("fills empty values and ignores commented-out lines", async () => {
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
