// live テストの設定の読み取り（scripts/lib/live-config.mjs）: 無い・空はスキップ、不正は例外（秘密を含めない）、応答の一致の判定
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
    it("設定ファイルが無いときはスキップの理由を返す", () => {
        expect(
            readLiveConfig({
                configPath: configPath(),
                devVarsPath: devVarsPath(),
            }),
        ).toEqual({
            skip: expect.stringContaining("config/live.json"),
        })
    })

    it("パスワードが空のときはスキップの理由を返す", () => {
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

    it("identifier が無いときは項目名を示して例外にする", () => {
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

    it("JSON として読めないときは、秘密の値を例外に含めない", () => {
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

    it("揃っているときは service の既定値と末尾の / を整えて返す", () => {
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
    it("DID とハンドルが設定と一致するなら空", () => {
        expect(
            sessionMismatches(
                { did: "did:plc:abc", handle: "test.example" },
                "test.example",
            ),
        ).toEqual([])
    })

    it("ハンドルの食い違い・DID の欠落を項目名で返す", () => {
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
