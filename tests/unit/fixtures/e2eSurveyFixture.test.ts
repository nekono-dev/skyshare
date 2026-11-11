/**
 * Checks that the survey fixture used by the E2E launcher passes current config rules.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseSurveyConfig } from "@/lib/survey/definition"

describe("E2E survey config fixture", () => {
    it("is a valid survey config under the current rules", () => {
        const raw = readFileSync(
            path.join(process.cwd(), "tests/fixtures/survey/e2e-open.json"),
            "utf8",
        )
        expect(parseSurveyConfig(JSON.parse(raw)).ok).toBe(true)
    })
})
