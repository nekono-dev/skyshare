/**
 * Tests planning GitHub variable and secret updates from configuration.
 */
import { describe, expect, it } from "vitest"
import {
    invalidVariables,
    isAdminOutput,
    pickSecrets,
    planVariables,
    variablesFromConfig,
    workerSecretTargets,
} from "../../../scripts/secrets/sync-github-variables.mjs"
import { repositoryFromRemote } from "../../../scripts/lib/github.mjs"
import { parseDotenv } from "../../../scripts/lib/dotenv.mjs"

describe("variablesFromConfig", () => {
    it("uses the public domain for SITE_HOST and omits empty values", () => {
        const desired = variablesFromConfig({
            siteHost: "skyshare.example.jp",
            vars: {
                PUBLIC_NODE_ENV: "production",
                PUBLIC_GA_MEASUREMENT_ID: "",
                PUBLIC_OPERATOR_BLUESKY_HANDLE: "   ",
            },
        })
        expect(desired).toEqual({
            SITE_HOST: "skyshare.example.jp",
            PUBLIC_NODE_ENV: "production",
        })
    })
})

describe("invalidVariables", () => {
    it("rejects syntax-breaking characters and example SITE_HOST domains", () => {
        expect(
            invalidVariables({
                SITE_HOST: "skyshare.example.com",
                PUBLIC_OPERATOR_NAME: 'a"b',
                PUBLIC_OPERATOR_EMAIL: "x\ny",
                PUBLIC_NODE_ENV: "back\\slash",
            }),
        ).toEqual([
            "SITE_HOST",
            "PUBLIC_OPERATOR_NAME",
            "PUBLIC_OPERATOR_EMAIL",
            "PUBLIC_NODE_ENV",
        ])
    })

    it("allows example domains for variables other than SITE_HOST", () => {
        expect(
            invalidVariables({
                SITE_HOST: "skyshare.jp",
                PUBLIC_OPERATOR_EMAIL: "privacy@example.com",
            }),
        ).toEqual([])
    })
})

describe("planVariables", () => {
    it("updates changed and new variables, skips matching values, and warns about unknown variables", () => {
        const plan = planVariables(
            {
                SITE_HOST: "skyshare.jp",
                PUBLIC_NODE_ENV: "production",
                NEW_ONE: "1",
            },
            {
                SITE_HOST: "skyshare.jp",
                PUBLIC_NODE_ENV: "develop",
                OLD_ONE: "2",
                SURVEY_CONFIG: "{}",
            },
        )
        expect(plan).toEqual({
            update: ["PUBLIC_NODE_ENV", "NEW_ONE"],
            unchanged: ["SITE_HOST"],
            unmanaged: ["OLD_ONE"],
        })
    })
})

describe("repositoryFromRemote", () => {
    it.each([
        [
            "git@github.com.nekono:nekono-dev/skyshare.git",
            "nekono-dev/skyshare",
        ],
        ["https://github.com/nekono-dev/skyshare", "nekono-dev/skyshare"],
        ["https://github.com/nekono-dev/skyshare.git\n", "nekono-dev/skyshare"],
        ["https://example.com/nekono-dev/skyshare.git", null],
    ])("classifies %s as %s", (url, expected) => {
        expect(repositoryFromRemote(url)).toBe(expected)
    })
})

describe("parseDotenv", () => {
    it("reads valid KEY=value entries and handles comments and quotes", () => {
        expect(
            parseDotenv("# 説明\n#OLD=x\nA='one'\nB=\"two\"\nC=\nD=a=b\n"),
        ).toEqual({ A: "one", B: "two", C: "", D: "a=b" })
    })
})

describe("pickSecrets", () => {
    it("selects names that have values", () => {
        expect(pickSecrets({ A: "x", B: "", C: "z" }, ["A", "B", "D"])).toEqual(
            { A: "x" },
        )
    })
})

describe("workerSecretTargets", () => {
    it("creates production, development, and preview targets", () => {
        const targets = workerSecretTargets("FEEDBACK_GITHUB_TOKEN", "skyshare")
        expect(targets.map(t => t.args)).toEqual([
            [
                "wrangler",
                "secret",
                "put",
                "FEEDBACK_GITHUB_TOKEN",
                "--name",
                "skyshare",
            ],
            [
                "wrangler",
                "secret",
                "put",
                "FEEDBACK_GITHUB_TOKEN",
                "--name",
                "skyshare-develop",
            ],
            [
                "wrangler",
                "preview",
                "base-config",
                "secret",
                "put",
                "FEEDBACK_GITHUB_TOKEN",
                "--worker-name",
                "skyshare-develop",
            ],
        ])
    })
})

describe("isAdminOutput", () => {
    it("allows writes only for admin permissions", () => {
        expect(isAdminOutput("true\n")).toBe(true)
        expect(isAdminOutput("false\n")).toBe(false)
        expect(isAdminOutput("")).toBe(false)
    })
})
