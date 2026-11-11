/**
 * Tests reading a Worker name from Wrangler configuration and handling invalid configuration.
 */
import { describe, expect, it } from "vitest"
import { workerNameFrom } from "../../../scripts/lib/wrangler.mjs"
import {
    RenderError,
    readConfig,
} from "../../../scripts/config/render-wrangler.mjs"

describe("workerNameFrom", () => {
    it("returns the top-level name and ignores nested names", () => {
        const source = `{
      // コメントと末尾のカンマを許す
      "d1_databases": [{ "name": "not-the-worker" },],
      "name": "skyshare",
    }`
        expect(workerNameFrom(source)).toBe("skyshare")
    })

    it("throws when name is missing, empty, or not a string", () => {
        expect(() => workerNameFrom(`{ "d1_databases": [] }`)).toThrow()
        expect(() => workerNameFrom(`{ "name": "  " }`)).toThrow()
        expect(() => workerNameFrom(`{ "name": 1 }`)).toThrow()
    })
})

describe("readConfig", () => {
    it("throws RenderError instead of exiting when configuration is missing", () => {
        expect(() => readConfig("__no_such_config__")).toThrow(RenderError)
    })
})
