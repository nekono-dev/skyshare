/**
 * Tests live-test configuration parsing and session identity comparisons.
 *
 * - Error messages must not expose secret values.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
    readLiveConfig,
    sessionMismatches,
} from "../../../scripts/lib/live-config.mjs"

let dir: string
const configPath = () => path.join(dir, "live.json")
const devVarsPath = () => path.join(dir, ".dev.vars")

beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "live-config-"))
})
afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
})

describe("readLiveConfig", () => {
    it("returns a skip reason when configuration is missing", () => {
        expect(
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            }),
        ).toEqual({
            skip: expect.stringContaining("config/live.json"),
        })
    })

    it("returns a skip reason when the password is empty", () => {
        writeFileSync(
            configPath(),
            JSON.stringify({ identifier: "test.example" }),
        )
        writeFileSync(devVarsPath(), "SKYSHARE_E2E_APP_PASSWORD=\n")
        expect(
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            }),
        ).toEqual({
            skip: expect.stringContaining("SKYSHARE_E2E_APP_PASSWORD"),
        })
    })

    it("throws an error naming a missing identifier", () => {
        writeFileSync(
            configPath(),
            JSON.stringify({ service: "https://example.test" }),
        )
        writeFileSync(devVarsPath(), "SKYSHARE_E2E_APP_PASSWORD=pw\n")
        expect(() =>
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            }),
        ).toThrow("identifier")
    })

    it("does not expose secrets when JSON parsing fails", () => {
        writeFileSync(configPath(), '{ "identifier": "SECRET-VALUE",,')
        writeFileSync(devVarsPath(), "SKYSHARE_E2E_APP_PASSWORD=SECRET-VALUE\n")
        let message = ""
        try {
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            })
        } catch (error) {
            message = (error as Error).message
        }
        expect(message).toContain("config/live.json")
        expect(message).not.toContain("SECRET-VALUE")
    })

    it("applies the default service and removes its trailing slash", () => {
        writeFileSync(
            configPath(),
            JSON.stringify({ identifier: " test.example " }),
        )
        writeFileSync(
            devVarsPath(),
            "# コメント\nSKYSHARE_E2E_APP_PASSWORD='pw-value'\n",
        )
        expect(
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            }),
        ).toEqual({
            identifier: "test.example",
            service: "https://bsky.social",
            appPassword: "pw-value",
        })
        writeFileSync(
            configPath(),
            JSON.stringify({
                identifier: "a.b",
                service: "https://pds.example/",
            }),
        )
        expect(
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            }),
        ).toMatchObject({
            service: "https://pds.example",
        })
    })
})

describe("sessionMismatches", () => {
    it("returns no mismatches when DID and handle match configuration", () => {
        expect(
            sessionMismatches(
                { did: "did:plc:abc", handle: "test.example" },
                "test.example",
            ),
        ).toEqual([])
    })

    it("returns field names for a handle mismatch and missing DID", () => {
        expect(
            sessionMismatches(
                { did: "did:plc:abc", handle: "other.example" },
                "test.example",
            ),
        ).toEqual(["handle"])
        expect(
            sessionMismatches({ handle: "test.example" }, "test.example"),
        ).toEqual(["did"])
    })
})
