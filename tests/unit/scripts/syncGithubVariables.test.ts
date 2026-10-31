// GitHub の Variables への登録（scripts/secrets/sync-github-variables.mjs）と、リポジトリの判定（scripts/lib/github.mjs）の純粋な部分
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
    it("公開するドメインを SITE_HOST にし、空の値は登録しない", () => {
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
    it("構文を壊す文字と、例示ドメインの SITE_HOST を拒否する", () => {
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

    it("例示ドメインでも SITE_HOST 以外の値は拒否しない（連絡先の例は使える）", () => {
        expect(
            invalidVariables({
                SITE_HOST: "skyshare.jp",
                PUBLIC_OPERATOR_EMAIL: "privacy@example.com",
            }),
        ).toEqual([])
    })
})

describe("planVariables", () => {
    it("違う値・新しい変数は登録し、同じ値は触らず、config に無い変数は警告だけにする", () => {
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
    ])("%s を %s と判定する", (url, expected) => {
        expect(repositoryFromRemote(url)).toBe(expected)
    })
})

describe("parseDotenv", () => {
    it("有効な KEY=value だけを読み、コメントアウトされた行と引用符を扱う", () => {
        expect(
            parseDotenv("# 説明\n#OLD=x\nA='one'\nB=\"two\"\nC=\nD=a=b\n"),
        ).toEqual({ A: "one", B: "two", C: "", D: "a=b" })
    })
})

describe("pickSecrets", () => {
    it("値のある名前だけを取り出す", () => {
        expect(pickSecrets({ A: "x", B: "", C: "z" }, ["A", "B", "D"])).toEqual(
            { A: "x" },
        )
    })
})

describe("workerSecretTargets", () => {
    it("本番・develop・プレビューの3つの登録先を作る", () => {
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
    it("admin の権限だけを書き込み可能と判定する", () => {
        expect(isAdminOutput("true\n")).toBe(true)
        expect(isAdminOutput("false\n")).toBe(false)
        expect(isAdminOutput("")).toBe(false)
    })
})
