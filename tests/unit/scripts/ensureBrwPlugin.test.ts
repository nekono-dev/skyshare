/**
 * BRW の冪等な導入（ensure-brw-plugin.mjs）の単体テストと、偽の claude での一続きの確認。
 * 偽の claude は一時ディレクトリに作り、PATH の先頭に置く。実際の Claude の設定には触れない。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    clearRecord,
    decideInstall,
    ensureBrw,
    hasProjectPlugin,
    isMarketplaceListed,
    main,
    PLUGIN,
    RECORD,
    writeRecord,
} from "../../../scripts/agent/ensure-brw-plugin.mjs"

const scriptPath = path.resolve(
    __dirname,
    "../../../scripts/agent/ensure-brw-plugin.mjs",
)
const roots: string[] = []
const makeRoot = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ensure-brw-test-"))
    roots.push(root)
    return root
}

afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe("既存の状態の判定", () => {
    it("marketplace の一覧に名前があるかを判定する", () => {
        const listing = JSON.stringify([
            { name: "nekono-dev", repo: "nekono-dev/claude-plugins" },
        ])
        expect(isMarketplaceListed(listing, "nekono-dev")).toBe(true)
        expect(isMarketplaceListed(listing, "nekono")).toBe(false)
        expect(isMarketplaceListed("not json", "nekono-dev")).toBe(false)
        expect(isMarketplaceListed('{"name":"nekono-dev"}', "nekono-dev")).toBe(
            false,
        )
    })

    it("このプロジェクトの scope project の BRW だけを導入済みと判定する", () => {
        const root = makeRoot()
        const other = makeRoot()
        const entry = (projectPath: string, scope = "project") =>
            JSON.stringify([{ id: PLUGIN, scope, projectPath }])
        expect(hasProjectPlugin(entry(root), root)).toBe(true)
        expect(hasProjectPlugin(entry(other), root)).toBe(false)
        expect(hasProjectPlugin(entry(root, "user"), root)).toBe(false)
        expect(hasProjectPlugin("[]", root)).toBe(false)
        expect(hasProjectPlugin("not json", root)).toBe(false)
    })

    it("無いものだけを行う", () => {
        expect(
            decideInstall({ marketplaceListed: true, pluginInstalled: true }),
        ).toEqual({
            addMarketplace: false,
            installPlugin: false,
        })
        expect(
            decideInstall({ marketplaceListed: false, pluginInstalled: true }),
        ).toEqual({
            addMarketplace: true,
            installPlugin: false,
        })
        expect(
            decideInstall({ marketplaceListed: true, pluginInstalled: false }),
        ).toEqual({
            addMarketplace: false,
            installPlugin: true,
        })
    })
})

describe("導入の本体（偽の runner）", () => {
    const listing = JSON.stringify([{ name: "nekono-dev" }])
    const installedJson = (root: string) =>
        JSON.stringify([{ id: PLUGIN, scope: "project", projectPath: root }])

    it("claude が無ければ、飛ばす", () => {
        const root = makeRoot()
        const runner = () => ({
            error: { code: "ENOENT" },
            status: null,
            stdout: "",
        })
        expect(ensureBrw(root, runner as never)).toEqual({ skipped: true })
    })

    it("両方あれば、導入の操作は行わない", () => {
        const root = makeRoot()
        const calls: string[][] = []
        const runner = (args: string[]) => {
            calls.push(args)
            if (args[1] === "marketplace") return { status: 0, stdout: listing }
            return { status: 0, stdout: installedJson(root) }
        }
        expect(ensureBrw(root, runner as never)).toEqual({
            installed: false,
            present: true,
        })
        expect(
            calls.some(args => args[1] === "install" || args[2] === "add"),
        ).toBe(false)
        expect(calls).toEqual([
            ["plugin", "marketplace", "list", "--json"],
            ["plugin", "list", "--json"],
        ])
    })

    it("両方あれば一覧と更新だけを呼び、導入の案内を出さない", () => {
        const root = makeRoot()
        const calls: string[][] = []
        const errors: string[] = []
        const runner = (args: string[]) => {
            calls.push(args)
            if (args[1] === "marketplace") return { status: 0, stdout: listing }
            if (args[1] === "list")
                return { status: 0, stdout: installedJson(root) }
            return { status: 0, stdout: "" }
        }
        main(
            root,
            runner as never,
            () => 0,
            text => errors.push(text),
        )
        expect(calls).toEqual([
            ["plugin", "marketplace", "list", "--json"],
            ["plugin", "list", "--json"],
            ["plugin", "update", PLUGIN],
        ])
        expect(errors.join("\n")).not.toContain("BRW を導入しました")
    })

    it("無いものだけを導入し、導入を記録する", () => {
        const root = makeRoot()
        const calls: string[][] = []
        const runner = (args: string[]) => {
            calls.push(args)
            if (args[1] === "marketplace" && args[2] === "list")
                return { status: 0, stdout: "" }
            if (args[1] === "list") return { status: 0, stdout: "[]" }
            return { status: 0, stdout: "" }
        }
        expect(ensureBrw(root, runner as never)).toEqual({ installed: true })
        expect(
            calls.some(args => args[2] === "add" && args.includes("--scope")),
        ).toBe(true)
        expect(
            calls.some(args => args[1] === "install" && args.includes("--yes")),
        ).toBe(true)
        expect(
            calls.some(
                args => args.includes("uninstall") || args.includes("remove"),
            ),
        ).toBe(false)
    })

    it("導入が失敗したら、失敗を返す（記録は呼び出し側が書く）", () => {
        const root = makeRoot()
        const runner = (args: string[]) => {
            if (args[1] === "marketplace" && args[2] === "list")
                return { status: 0, stdout: listing }
            if (args[1] === "list") return { status: 0, stdout: "[]" }
            return { status: 1, stdout: "", stderr: "network" }
        }
        expect(ensureBrw(root, runner as never)).toEqual({
            failure: "プラグインの導入",
            output: "network",
        })
    })

    it("5 回の CLI に残り時間と上限の小さい方を渡し、合計予算を超えない", () => {
        const root = makeRoot()
        let time = 0
        const timeouts: number[] = []
        const runner = (args: string[], _cwd: string, timeout: number) => {
            timeouts.push(timeout)
            time += timeout
            if (args[1] === "list" && args[2] === "--json")
                return { status: 0, stdout: "[]" }
            if (args[1] === "marketplace" && args[2] === "list")
                return { status: 0, stdout: "" }
            return { status: 0, stdout: "" }
        }
        const result = ensureBrw(root, runner as never, () => time, 0, {
            cliTimeoutMs: 60,
            totalBudgetMs: 170,
        })
        expect(result).toEqual({ failure: "プラグインの導入", output: "" })
        expect(timeouts).toEqual([60, 60, 50])
        expect(time).toBeLessThanOrEqual(170)
    })

    it("予算切れ後は runner を呼ばず、導入中の記録を残す", () => {
        const root = makeRoot()
        let time = 0
        const calls: string[][] = []
        const runner = (args: string[]) => {
            calls.push(args)
            time += 10
            return args[1] === "list" && args[2] === "--json"
                ? { status: 0, stdout: "[]" }
                : { status: 0, stdout: "" }
        }
        expect(
            ensureBrw(root, runner as never, () => time, 0, {
                cliTimeoutMs: 60,
                totalBudgetMs: 10,
            }),
        ).toEqual({ failure: "marketplace の登録", output: "" })
        expect(calls).toHaveLength(1)
        expect(fs.readFileSync(path.join(root, RECORD), "utf8")).toContain(
            "導入中",
        )
    })

    it("5 回それぞれに CLI 上限と残り予算の小さい方を渡す", () => {
        const root = makeRoot()
        let time = 0
        const timeouts: number[] = []
        const errors: string[] = []
        const runner = (args: string[], _cwd: string, timeout: number) => {
            timeouts.push(timeout)
            // 偽の CLI は 40 かかる。渡された上限を超えては走らない（打ち切られる）
            time += Math.min(40, timeout)
            if (args[1] === "list" && args[2] === "--json")
                return { status: 0, stdout: "[]" }
            return { status: 0, stdout: "" }
        }
        main(
            root,
            runner as never,
            () => time,
            text => errors.push(text),
            { cliTimeoutMs: 60, totalBudgetMs: 170 },
        )
        expect(timeouts).toEqual([60, 60, 60, 50, 10])
        expect(time).toBeLessThanOrEqual(170)
    })

    it("毎回 timeout を使い切っても既定予算を超えず、導入失敗を記録する", () => {
        const root = makeRoot()
        let time = 0
        const timeouts: number[] = []
        const runner = (args: string[], _cwd: string, timeout: number) => {
            timeouts.push(timeout)
            time += timeout
            if (args[1] === "list" && args[2] === "--json")
                return { status: 0, stdout: "[]" }
            return { status: 0, stdout: "" }
        }
        const errors: string[] = []
        main(
            root,
            runner as never,
            () => time,
            text => errors.push(text),
            { cliTimeoutMs: 60000, totalBudgetMs: 170000 },
        )
        expect(
            timeouts.reduce((sum, value) => sum + value, 0),
        ).toBeLessThanOrEqual(170000)
        expect(time).toBeLessThanOrEqual(170000)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(true)
        expect(errors.some(text => text.includes("導入に失敗しました"))).toBe(
            true,
        )
    })

    it("導入済みで予算が尽きていれば update を呼ばず、記録せず標準エラーに出す", () => {
        const root = makeRoot()
        let time = 0
        const calls: string[][] = []
        const runner = (args: string[]) => {
            calls.push(args)
            time += 10
            return args[1] === "list" && args[2] === "--json"
                ? { status: 0, stdout: installedJson(root) }
                : { status: 0, stdout: listing }
        }
        const errors: string[] = []
        main(
            root,
            runner as never,
            () => time,
            text => errors.push(text),
            { cliTimeoutMs: 60, totalBudgetMs: 20 },
        )
        expect(calls.some(args => args[1] === "update")).toBe(false)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(false)
        expect(errors.join("\n")).toContain(
            "時間予算が残っていないため飛ばします",
        )
    })

    it("update の失敗は記録せず、内容を標準エラーに出す", () => {
        const root = makeRoot()
        const errors: string[] = []
        const runner = (args: string[]) =>
            args[1] === "marketplace"
                ? { status: 0, stdout: listing }
                : args[1] === "list"
                  ? { status: 0, stdout: installedJson(root) }
                  : { status: 1, stderr: "update failed" }
        main(
            root,
            runner as never,
            () => 0,
            text => errors.push(text),
            { totalBudgetMs: 170 },
        )
        expect(fs.existsSync(path.join(root, RECORD))).toBe(false)
        expect(errors.join("\n")).toContain("update failed")
    })
})

describe("失敗の記録", () => {
    it("書いて、消せる", () => {
        const root = makeRoot()
        writeRecord(root, "テスト")
        expect(fs.existsSync(path.join(root, RECORD))).toBe(true)
        clearRecord(root)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(false)
    })
})

describe("偽の claude での一続きの確認", () => {
    const fakeClaude = (dir: string, body: string): void => {
        fs.writeFileSync(path.join(dir, "claude"), `#!/bin/sh\n${body}\n`)
        fs.chmodSync(path.join(dir, "claude"), 0o755)
    }

    it("導入が失敗すると記録を残し、終了コードは 0（SessionStart は止めない）", () => {
        const root = makeRoot()
        const bin = makeRoot()
        fakeClaude(
            bin,
            [
                'case "$*" in',
                '  "plugin marketplace list --json") echo \'[{"name":"claude-plugins-official"}]\' ;;',
                '  "plugin list --json") echo "[]" ;;',
                '  "plugin marketplace add"*) exit 0 ;;',
                '  "plugin install"*) echo "install failed" >&2; exit 1 ;;',
                "  *) exit 0 ;;",
                "esac",
            ].join("\n"),
        )
        const result = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
            },
            encoding: "utf8",
        })
        expect(result.status).toBe(0)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(true)
        expect(result.stderr).toContain("BRW の導入に失敗しました")
    })

    it("CLI が上限時間を超えると打ち切り、失敗の記録を残す（予算の確認）", () => {
        const root = makeRoot()
        const bin = makeRoot()
        fakeClaude(
            bin,
            [
                'case "$*" in',
                '  "plugin marketplace list --json") echo \'[{"name":"claude-plugins-official"}]\' ;;',
                '  "plugin list --json") echo "[]" ;;',
                '  "plugin marketplace add"*) exec sleep 30 ;;',
                "  *) exit 0 ;;",
                "esac",
            ].join("\n"),
        )
        const started = Date.now()
        const result = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
                SKYSHARE_BRW_CLI_TIMEOUT_MS: "1000",
            },
            encoding: "utf8",
        })
        expect(result.status).toBe(0)
        // 偽の CLI は 30 秒眠る。上限 1 秒で打ち切られたことだけを、余裕のある閾値で確かめる
        expect(Date.now() - started).toBeLessThan(15000)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(true)
    })

    it("導入が成功すると記録を消す", () => {
        const root = makeRoot()
        const bin = makeRoot()
        writeRecord(root, "古い記録")
        fakeClaude(
            bin,
            [
                'case "$*" in',
                '  "plugin marketplace list --json") echo \'[{"name":"nekono-dev"}]\' ;;',
                `  "plugin list --json") echo '[{"id":"${PLUGIN}","scope":"project","projectPath":"${root}"}]'; sleep 0.3 ;;`,
                "  *) exit 0 ;;",
                "esac",
            ].join("\n"),
        )
        const result = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
            },
            encoding: "utf8",
        })
        expect(result.status).toBe(0)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(false)
    })

    it("更新だけが失敗した場合は記録を残さず、内容を標準エラーに出す", () => {
        const root = makeRoot()
        const bin = makeRoot()
        fakeClaude(
            bin,
            [
                'case "$*" in',
                '  "plugin marketplace list --json") echo \'[{"name":"nekono-dev"}]\' ;;',
                `  "plugin list --json") echo '[{"id":"${PLUGIN}","scope":"project","projectPath":"${root}"}]' ;;`,
                '  "plugin update"*) echo "update failed" >&2; exit 1 ;;',
                "  *) exit 0 ;;",
                "esac",
            ].join("\n"),
        )
        const result = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
            },
            encoding: "utf8",
        })
        expect(result.status).toBe(0)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(false)
        expect(result.stderr).toContain("update failed")
    })

    it("導入したときだけ、スキル利用とセッションの開き直しを案内する", () => {
        const root = makeRoot()
        const bin = makeRoot()
        fakeClaude(
            bin,
            [
                'case "$*" in',
                "  \"plugin marketplace list --json\") echo '[]' ;;",
                '  "plugin list --json") echo "[]" ;;',
                "  *) exit 0 ;;",
                "esac",
            ].join("\n"),
        )
        const installed = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
            },
            encoding: "utf8",
        })
        expect(installed.stderr).toContain("スキルが使えない場合")
        expect(installed.stderr).toContain("セッションを開き直してください")

        fakeClaude(
            bin,
            [
                'case "$*" in',
                '  "plugin marketplace list --json") echo \'[{"name":"nekono-dev"}]\' ;;',
                `  "plugin list --json") echo '[{"id":"${PLUGIN}","scope":"project","projectPath":"${root}"}]'; sleep 0.3 ;;`,
                "  *) exit 0 ;;",
                "esac",
            ].join("\n"),
        )
        const present = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
            },
            encoding: "utf8",
        })
        expect(present.stderr).not.toContain("セッションを開き直してください")
    })

    it("予算が尽きていれば更新を飛ばし、記録を書かない", () => {
        const root = makeRoot()
        const bin = makeRoot()
        fakeClaude(
            bin,
            [
                'case "$*" in',
                '  "plugin marketplace list --json") echo \'[{"name":"nekono-dev"}]\' ;;',
                `  "plugin list --json") echo '[{"id":"${PLUGIN}","scope":"project","projectPath":"${root}"}]'; sleep 0.3 ;;`,
                '  *) echo called >> "$CALL_LOG"; exit 0 ;;',
                "esac",
            ].join("\n"),
        )
        const callLog = path.join(root, "calls")
        const result = spawnSync("node", [scriptPath], {
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                CLAUDE_PROJECT_DIR: root,
                CALL_LOG: callLog,
                SKYSHARE_BRW_CLI_TIMEOUT_MS: "500",
                SKYSHARE_BRW_TOTAL_BUDGET_MS: "200",
            },
            encoding: "utf8",
        })
        expect(result.status).toBe(0)
        expect(fs.existsSync(callLog)).toBe(false)
        expect(fs.existsSync(path.join(root, RECORD))).toBe(false)
        expect(result.stderr).toContain("時間予算が残っていないため飛ばします")
    })
})
