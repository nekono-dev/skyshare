/**
 * 配備に使う設定値の登録（`hack/sync-deploy-env.mjs`）の検証。
 *
 * 責務と処理概要:
 * - deploy.env の区分ごとの読み取り、形式の誤りの検出、空の値を登録しないこと、
 *   Worker のシークレットの登録先の展開、値をコマンドの引数に載せないことを確かめる。
 * - 雛形（deploy.env.template）がそのまま読め、認証情報の値が空であることを確かめる。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
    SECTIONS,
    parseDeployEnv,
    planRegistrations,
    repositoryFromRemote,
} from "../../hack/sync-deploy-env.mjs"

const ROOT = path.resolve(__dirname, "../..")
const opts = {
    repo: "owner/repo",
    worker: "skyshare",
    readFile: (p: string) => `file:${p}`,
}

describe("parseDeployEnv", () => {
    it("区分ごとに値を分け、コメントと引用符を除く", () => {
        expect(
            parseDeployEnv(
                "# c\n[github.variables]\nA=1\n\n[github.secrets]\nB='x y'\nC=\"z\"\n",
            ),
        ).toEqual({
            "github.variables": { A: "1" },
            "github.secrets": { B: "x y", C: "z" },
        })
    })

    it("区分の外の値・未知の区分・形式の違う行は例外にする", () => {
        expect(() => parseDeployEnv("A=1\n")).toThrow("区分")
        expect(() => parseDeployEnv("[unknown]\n")).toThrow("未知の区分")
        expect(() => parseDeployEnv("[github.secrets]\nnot a pair\n")).toThrow(
            "KEY=value",
        )
    })

    it("雛形がそのまま読め、すべての区分を持ち、認証情報の値が空である", () => {
        const sections = parseDeployEnv(
            readFileSync(path.join(ROOT, "deploy.env.template"), "utf8"),
        )
        expect(Object.keys(sections).sort()).toEqual([...SECTIONS].sort())
        for (const section of SECTIONS.filter(s => s !== "github.variables")) {
            for (const value of Object.values(sections[section])) {
                expect(value).toBe("")
            }
        }
    })
})

describe("repositoryFromRemote", () => {
    it("HTTPS と SSH の別名の remote から owner/repo を取り出す", () => {
        expect(
            repositoryFromRemote("git@github.com.nekono:nekono-dev/skyshare.git"),
        ).toBe("nekono-dev/skyshare")
        expect(repositoryFromRemote("https://github.com/o/r\n")).toBe("o/r")
        expect(repositoryFromRemote("https://gitlab.com/o/r")).toBeNull()
    })
})

describe("planRegistrations", () => {
    it("空の値は登録せず、Worker のシークレットを区分に応じた登録先へ展開する", () => {
        const plans = planRegistrations(
            {
                "github.variables": { SITE_HOST: "s.example.com", EMPTY: "" },
                "github.secrets": { E2E_ENV: "@.env.e2e" },
                "worker.secrets": { FEEDBACK_GITHUB_TOKEN: "pat" },
                "worker.secrets.production": { SCHEDULE_ENC_KEY: "" },
                "worker.secrets.develop": { SCHEDULE_ENC_KEY: "dev-key" },
            },
            opts,
        )
        expect(
            plans.map(p => [p.command, ...p.args].join(" ")),
        ).toEqual([
            "gh variable set SITE_HOST -R owner/repo",
            "gh secret set E2E_ENV -R owner/repo",
            "npx wrangler secret put FEEDBACK_GITHUB_TOKEN --name skyshare",
            "npx wrangler secret put FEEDBACK_GITHUB_TOKEN --name skyshare-develop",
            "npx wrangler preview base-config secret put FEEDBACK_GITHUB_TOKEN --worker-name skyshare-develop",
            "npx wrangler secret put SCHEDULE_ENC_KEY --name skyshare-develop",
            "npx wrangler preview base-config secret put SCHEDULE_ENC_KEY --worker-name skyshare-develop",
        ])
        // @<パス> はファイルの中身に置き換わる
        expect(plans[1].value).toBe("file:.env.e2e")
    })

    it("値をコマンドの引数に載せない（標準入力で渡す）", () => {
        const plans = planRegistrations(
            {
                "github.secrets": { CLOUDFLARE_API_TOKEN: "secret-value" },
                "worker.secrets": { FEEDBACK_GITHUB_TOKEN: "pat-value" },
            },
            opts,
        )
        for (const plan of plans) {
            expect(plan.args.join(" ")).not.toMatch(/secret-value|pat-value/)
        }
        expect(plans.map(p => p.value)).toContain("pat-value")
    })
})
