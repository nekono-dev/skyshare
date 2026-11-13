/**
 * MCP サーバー（codex-mcp-server.mjs）の入口の試験。偽の codex と本物の git だけを PATH に置き、本物の Codex は呼ばない。
 * 応答の形（initialize・tools/list・エラーコード）と、codex の有無による一覧の違いを確かめる。
 * tools/call は偽の codex（実行可能なシェルスクリプト）で、検証・待ち列・実行・結果の形を確かめる。
 */
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it, vi } from "vitest"
import {
    codexExecTool,
    createCodexExecCaller,
    handleLine,
    handleMessage,
} from "../../../scripts/agent/codex-mcp-server.mjs"

const serverPath = path.resolve(
    __dirname,
    "../../../scripts/agent/codex-mcp-server.mjs",
)

const dirs: string[] = []
const makeDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mcp-server-test-"))
    dirs.push(dir)
    return dir
}

afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
})

/** PATH から本物の git の場所を探す。見つからなければ失敗させる。 */
const findRealGit = (): string => {
    const found = execFileSync("sh", ["-c", "command -v git"], {
        encoding: "utf8",
    }).trim()
    if (!found) throw new Error("テストには git が必要です")
    return fs.realpathSync(found)
}

/** 偽の codex（起動すると何もせず終了する）を置く。 */
const writeFakeCodex = (dir: string): void => {
    const fakeCodex = path.join(dir, "codex")
    fs.writeFileSync(fakeCodex, "#!/bin/sh\nexit 0\n")
    fs.chmodSync(fakeCodex, 0o755)
}

/** 本物の git だけをシンボリックリンクで置く。 */
const linkGit = (dir: string): void => {
    fs.symlinkSync(findRealGit(), path.join(dir, "git"))
}

/** 改行区切りの JSON-RPC を標準入力で渡し、標準出力の行を JSON として返す。 */
const runServer = (
    searchPath: string,
    messages: unknown[],
): {
    responses: Array<Record<string, unknown>>
    stderr: string
    status: number | null
} => {
    const result = spawnSync(process.execPath, [serverPath], {
        input: `${messages.map(message => JSON.stringify(message)).join("\n")}\n`,
        env: { PATH: searchPath },
        encoding: "utf8",
        timeout: 30_000,
    })
    const responses = result.stdout
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => JSON.parse(line) as Record<string, unknown>)
    return { responses, stderr: result.stderr, status: result.status }
}

const initializeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
}
const toolsListRequest = { jsonrpc: "2.0", id: 2, method: "tools/list" }

describe("handleMessage", () => {
    it("answers initialize with the requested protocol version and tools capability", () => {
        const response = handleMessage(initializeRequest, {
            tools: [],
        }) as Record<string, any>
        expect(response.id).toBe(1)
        expect(response.result.protocolVersion).toBe("2025-06-18")
        expect(response.result.capabilities).toEqual({ tools: {} })
        expect(response.result.serverInfo).toEqual({
            name: "codex",
            version: "1.0.0",
        })
    })

    it("falls back to a default protocol version when the client sends none", () => {
        const response = handleMessage(
            { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
            { tools: [] },
        ) as Record<string, any>
        expect(typeof response.result.protocolVersion).toBe("string")
        expect(response.result.protocolVersion.length).toBeGreaterThan(0)
    })

    it("returns no response for notifications/initialized", () => {
        expect(
            handleMessage(
                { jsonrpc: "2.0", method: "notifications/initialized" },
                { tools: [] },
            ),
        ).toBeNull()
    })

    it("returns no response for any message without an id", () => {
        expect(
            handleMessage(
                { jsonrpc: "2.0", method: "notifications/unknown" },
                { tools: [] },
            ),
        ).toBeNull()
    })

    it("lists codex_exec when the environment is available", () => {
        const response = handleMessage(toolsListRequest, {
            tools: [codexExecTool],
        }) as Record<string, any>
        expect(response.id).toBe(2)
        expect(response.result.tools).toHaveLength(1)
        expect(response.result.tools[0].name).toBe("codex_exec")
    })

    it("lists no tools when the environment is unavailable", () => {
        const response = handleMessage(toolsListRequest, {
            tools: [],
        }) as Record<string, any>
        expect(response.result).toEqual({ tools: [] })
    })

    it("returns -32601 for an unknown method that has an id", () => {
        const response = handleMessage(
            { jsonrpc: "2.0", id: 7, method: "resources/list" },
            { tools: [codexExecTool] },
        ) as Record<string, any>
        expect(response.id).toBe(7)
        expect(response.error.code).toBe(-32601)
    })

    it("returns isError for codex_exec without calling the runner when the tool is not exposed", async () => {
        const callCodexExec = vi.fn()
        const response = (await handleMessage(
            {
                jsonrpc: "2.0",
                id: 8,
                method: "tools/call",
                params: { name: "codex_exec", arguments: { prompt: "hello" } },
            },
            { tools: [], callCodexExec },
        )) as Record<string, any>
        expect(response.id).toBe(8)
        expect(response.error).toBeUndefined()
        expect(response.result.isError).toBe(true)
        expect(callCodexExec).not.toHaveBeenCalled()
    })

    it("returns isError for an unknown tool name even when codex_exec is exposed", async () => {
        const callCodexExec = vi.fn()
        const response = (await handleMessage(
            {
                jsonrpc: "2.0",
                id: 9,
                method: "tools/call",
                params: { name: "other", arguments: {} },
            },
            { tools: [codexExecTool], callCodexExec },
        )) as Record<string, any>
        expect(response.result.isError).toBe(true)
        expect(callCodexExec).not.toHaveBeenCalled()
    })

    it("passes the tools/call arguments to callCodexExec and returns its result", async () => {
        const callCodexExec = vi.fn(async () => ({
            content: [{ type: "text", text: "ok" }],
            isError: false,
        }))
        const args = { prompt: "hello", sandbox: "read-only" }
        const response = (await handleMessage(
            {
                jsonrpc: "2.0",
                id: 10,
                method: "tools/call",
                params: { name: "codex_exec", arguments: args },
            },
            { tools: [codexExecTool], callCodexExec },
        )) as Record<string, any>
        expect(callCodexExec).toHaveBeenCalledWith(args)
        expect(response).toEqual({
            jsonrpc: "2.0",
            id: 10,
            result: { content: [{ type: "text", text: "ok" }], isError: false },
        })
    })
})

describe("handleLine", () => {
    it("returns a -32700 parse error with a null id for malformed JSON", () => {
        const line = handleLine("{not json", { tools: [] })
        expect(line).not.toBeNull()
        const response = JSON.parse(line as string) as Record<string, any>
        expect(response.id).toBeNull()
        expect(response.error.code).toBe(-32700)
    })

    it("returns null for a notification line", () => {
        expect(
            handleLine(
                JSON.stringify({
                    jsonrpc: "2.0",
                    method: "notifications/initialized",
                }),
                { tools: [] },
            ),
        ).toBeNull()
    })

    it("returns one JSON line per request", () => {
        const line = handleLine(JSON.stringify(toolsListRequest), {
            tools: [codexExecTool],
        })
        expect(line).not.toBeNull()
        expect(line as string).not.toContain("\n")
        expect(JSON.parse(line as string).result.tools[0].name).toBe(
            "codex_exec",
        )
    })
})

describe("codex_exec tool definition", () => {
    const schema = codexExecTool.inputSchema as Record<string, any>

    it("requires a non-empty prompt string", () => {
        expect(schema.type).toBe("object")
        expect(schema.required).toContain("prompt")
        expect(schema.properties.prompt.type).toBe("string")
        expect(schema.properties.prompt.minLength).toBe(1)
    })

    it("limits sandbox to two values and documents workspace-write as the default", () => {
        expect(schema.properties.sandbox.enum).toEqual([
            "read-only",
            "workspace-write",
        ])
        expect(schema.properties.sandbox.default).toBe("workspace-write")
        expect(schema.properties.sandbox.description).toContain(
            "workspace-write",
        )
        expect(schema.required).not.toContain("sandbox")
    })

    it("makes cwd an optional string", () => {
        expect(schema.properties.cwd.type).toBe("string")
        expect(schema.required).not.toContain("cwd")
    })

    it("documents optional network, scratch, read path, and deny glob inputs", () => {
        expect(schema.properties.network).toMatchObject({
            type: "boolean",
            default: false,
        })
        expect(schema.properties.network.description).toContain(
            "Disabled by default",
        )
        expect(schema.properties.scratch.description).toContain("read-only")
        expect(schema.properties.read_paths.type).toBe("array")
        expect(schema.properties.read_paths.description).toContain(
            "Only available for read-only runs",
        )
        expect(schema.properties.deny_read.type).toBe("array")
        for (const key of ["network", "scratch", "read_paths", "deny_read"])
            expect(schema.required).not.toContain(key)
    })
})

/** 偽の codex を使う tools/call の試験の道具一式を作る。body は偽の codex の末尾に続く処理。 */
type Harness = {
    repoRoot: string
    dir: string
    logs: string[]
    caller: (raw: unknown) => Promise<{
        content: Array<{ type: string; text: string }>
        isError: boolean
    }>
    runCount: () => number
}

const createHarness = (
    body: string,
    options: {
        command?: string
        waitLimitMs?: number
        timeoutMs?: number
        killGraceMs?: number
    } = {},
): Harness => {
    const dir = makeDir()
    const repoRoot = makeDir()
    const logs: string[] = []
    const runsLog = path.join(dir, "runs.log")
    // 偽の codex: 起動の記録、引数の記録、標準入力の記録、最後のメッセージの出力先の取り出し、の後に body を実行する
    const script = `#!/bin/sh
DIR='${dir}'
echo run >> "$DIR/runs.log"
printf '%s\\n' "$@" > "$DIR/argv.txt"
cat > "$DIR/stdin.txt"
OUT=""
PREV=""
for ARG in "$@"; do
  if [ "$PREV" = "--output-last-message" ]; then OUT="$ARG"; fi
  PREV="$ARG"
done
${body}
`
    const fakeCodex = path.join(dir, "codex")
    fs.writeFileSync(fakeCodex, script)
    fs.chmodSync(fakeCodex, 0o755)

    const caller = createCodexExecCaller({
        repoRoot,
        command: options.command ?? fakeCodex,
        waitLimitMs: options.waitLimitMs ?? 120_000,
        timeoutMs: options.timeoutMs ?? 600_000,
        killGraceMs: options.killGraceMs ?? 5_000,
        log: message => logs.push(message),
    })
    const runCount = (): number =>
        fs.existsSync(runsLog)
            ? fs
                  .readFileSync(runsLog, "utf8")
                  .split("\n")
                  .filter(line => line === "run").length
            : 0
    return { repoRoot, dir, logs, caller, runCount }
}

/** 条件が成り立つまで待つ。時間内に成り立たなければ失敗させる。 */
const waitFor = async (
    predicate: () => boolean,
    timeoutMs = 5_000,
): Promise<void> => {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs)
            throw new Error("条件が時間内に成り立ちませんでした")
        await new Promise(resolve => setTimeout(resolve, 20))
    }
}

describe("tools/call with a fake codex", () => {
    it("rejects an invalid sandbox without starting codex", async () => {
        const harness = createHarness("exit 0")
        const result = await harness.caller({
            prompt: "hello",
            sandbox: "danger-full-access",
        })
        expect(result.isError).toBe(true)
        expect(harness.runCount()).toBe(0)
    })

    it("rejects an empty prompt without starting codex", async () => {
        const harness = createHarness("exit 0")
        const result = await harness.caller({ prompt: "" })
        expect(result.isError).toBe(true)
        expect(harness.runCount()).toBe(0)
    })

    it("rejects invalid permission inputs without starting codex", async () => {
        const harness = createHarness("exit 0")
        const result = await harness.caller({ prompt: "hello", network: "yes" })
        expect(result.isError).toBe(true)
        expect(harness.runCount()).toBe(0)
    })

    it("builds a scoped read-only profile with scratch and requested network access", async () => {
        const harness = createHarness(`printf 'ok' > "$OUT"\nexit 0`)
        const result = await harness.caller({
            prompt: "test",
            sandbox: "read-only",
            network: true,
            scratch: true,
            read_paths: ["."],
            deny_read: ["private/**"],
        })
        expect(result.isError).toBe(false)
        const argv = fs
            .readFileSync(path.join(harness.dir, "argv.txt"), "utf8")
            .split("\n")
            .filter(Boolean)
        const filesystem =
            argv.find(arg =>
                arg.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        expect(filesystem).toContain('"."="read"')
        expect(filesystem).toContain('"private/**"="none"')
        expect(filesystem).toContain('"node_modules/.vite-temp"="write"')
        expect(filesystem).toContain("codex-scratch-")
        expect(argv).toContain("permissions.claude.network.enabled=true")
    })

    it("keeps workspace-write in the write queue and grants repository writes", async () => {
        const harness = createHarness(`printf 'ok' > "$OUT"\nexit 0`)
        const result = await harness.caller({
            prompt: "write",
            sandbox: "workspace-write",
        })
        expect(result.isError).toBe(false)
        const argv = fs
            .readFileSync(path.join(harness.dir, "argv.txt"), "utf8")
            .split("\n")
            .filter(Boolean)
        const filesystem =
            argv.find(arg =>
                arg.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        expect(filesystem).toContain('"."="write"')
    })

    it("rejects a whitespace-only prompt without starting codex", async () => {
        const harness = createHarness("exit 0")
        const result = await harness.caller({ prompt: "   \n\t " })
        expect(result.isError).toBe(true)
        expect(harness.runCount()).toBe(0)
    })

    it("rejects a cwd outside the repository without starting codex", async () => {
        const harness = createHarness("exit 0")
        const outside = makeDir()
        const result = await harness.caller({ prompt: "hello", cwd: outside })
        expect(result.isError).toBe(true)
        expect(harness.runCount()).toBe(0)
    })

    it("returns the last message as a successful result and runs codex with the expected argv", async () => {
        const harness = createHarness(
            `printf 'fake last message' > "$OUT"\nexit 0`,
        )
        const result = await harness.caller({
            prompt: "do the task",
            sandbox: "read-only",
        })

        expect(result.isError).toBe(false)
        expect(result.content).toEqual([
            { type: "text", text: "fake last message" },
        ])

        const argv = fs
            .readFileSync(path.join(harness.dir, "argv.txt"), "utf8")
            .split("\n")
            .filter(line => line !== "")
        expect(argv.slice(0, 9)).toEqual([
            "--ask-for-approval",
            "never",
            "exec",
            "--model",
            "gpt-6.1-sol",
            "-c",
            'model_reasoning_effort="medium"',
            "-c",
            'default_permissions="claude"',
        ])
        expect(argv[9]).toBe("-c")
        expect(argv[10]).toContain('"**/.dev.vars"="none"')
        expect(argv[10]).toContain('"**/.env.*"="none"')
        expect(argv[11]).toBe("-c")
        expect(argv[12]).toBe("permissions.claude.network.enabled=false")
        expect(argv[13]).toBe("--cd")
        expect(argv[14]).toBe(fs.realpathSync(harness.repoRoot))
        expect(argv[15]).toBe("--output-last-message")
        expect(argv[16]).toMatch(/last-message\.txt$/)
        expect(argv[17]).toBe("-")
        expect(argv).toHaveLength(18)
        expect(argv).not.toContain("--sandbox")

        // 依頼文は標準入力で渡り、ログには依頼文も結果の本文も出ない
        expect(
            fs.readFileSync(path.join(harness.dir, "stdin.txt"), "utf8"),
        ).toBe("do the task")
        expect(harness.logs.join("\n")).not.toContain("do the task")
        expect(harness.logs.join("\n")).not.toContain("fake last message")
    })

    it("reports a non-zero exit as isError with the exit code and the stderr tail", async () => {
        const harness = createHarness(
            `printf 'partial answer' > "$OUT"\necho 'boom detail' >&2\nexit 3`,
        )
        const result = await harness.caller({ prompt: "hello" })

        expect(result.isError).toBe(true)
        const text = result.content[0]?.text ?? ""
        expect(text).toContain("終了コード 3")
        expect(text).toContain("boom detail")
        expect(text).toContain("partial answer")
    })

    it("stops a run at the time limit and reports it as isError", async () => {
        const harness = createHarness(`printf 'partial' > "$OUT"\nsleep 5`, {
            timeoutMs: 300,
            killGraceMs: 200,
        })
        const result = await harness.caller({ prompt: "hello" })

        expect(result.isError).toBe(true)
        const text = result.content[0]?.text ?? ""
        expect(text).toContain("時間の上限")
        expect(text).toContain("打ち切り")
        expect(text).toContain("partial")
    })

    it("reports a spawn failure as isError", async () => {
        const harness = createHarness("exit 0", {
            command: "/nonexistent/codex-for-test",
        })
        const result = await harness.caller({ prompt: "hello" })
        expect(result.isError).toBe(true)
        expect(result.content[0]?.text).toContain("起動できませんでした")
    })

    it("returns isError without running when the wait limit is reached", async () => {
        // 1 件目の書き込みは block の印があるあいだ走り続ける
        const harness = createHarness(
            `while [ -f "$DIR/block" ]; do sleep 0.05; done\nprintf 'first done' > "$OUT"\nexit 0`,
            { waitLimitMs: 200 },
        )
        fs.writeFileSync(path.join(harness.dir, "block"), "")

        const first = harness.caller({
            prompt: "first",
            sandbox: "workspace-write",
        })
        await waitFor(() => harness.runCount() === 1)

        const second = await harness.caller({
            prompt: "second",
            sandbox: "workspace-write",
        })
        expect(second.isError).toBe(true)
        expect(second.content[0]?.text).toContain("上限")
        // 2 件目は実行されていない（起動の記録は 1 件のまま）
        expect(harness.runCount()).toBe(1)

        fs.rmSync(path.join(harness.dir, "block"))
        const firstResult = await first
        expect(firstResult.isError).toBe(false)
        expect(harness.runCount()).toBe(1)
    })

    it("admits a read-only call while a write call is still running", async () => {
        const harness = createHarness(
            `while [ -f "$DIR/block" ]; do sleep 0.05; done\nprintf 'done' > "$OUT"\nexit 0`,
        )
        fs.writeFileSync(path.join(harness.dir, "block"), "")

        const write = harness.caller({
            prompt: "write",
            sandbox: "workspace-write",
        })
        await waitFor(() => harness.runCount() === 1)

        // 書き込みが走っていても、読み取りは別に数えられて直ちに起動する
        const read = harness.caller({ prompt: "read", sandbox: "read-only" })
        await waitFor(() => harness.runCount() === 2)

        fs.rmSync(path.join(harness.dir, "block"))
        const [writeResult, readResult] = await Promise.all([write, read])
        expect(writeResult.isError).toBe(false)
        expect(readResult.isError).toBe(false)
    })
})

describe("codex-mcp-server process", () => {
    it("lists exactly one codex_exec tool when codex and git are on PATH", () => {
        const binDir = makeDir()
        writeFakeCodex(binDir)
        linkGit(binDir)

        const { responses, status } = runServer(binDir, [
            initializeRequest,
            toolsListRequest,
        ])

        expect(status).toBe(0)
        expect(responses).toHaveLength(2)
        expect(responses[0]?.id).toBe(1)
        const tools = (
            responses[1]?.result as { tools: Array<{ name: string }> }
        ).tools
        expect(tools.map(tool => tool.name)).toEqual(["codex_exec"])
    })

    it("lists no tools but still answers initialize when codex is missing", () => {
        const gitOnlyDir = makeDir()
        linkGit(gitOnlyDir)

        const { responses, status } = runServer(gitOnlyDir, [
            initializeRequest,
            toolsListRequest,
        ])

        expect(status).toBe(0)
        expect(responses).toHaveLength(2)
        expect(
            (responses[0]?.result as { serverInfo: unknown }).serverInfo,
        ).toEqual({
            name: "codex",
            version: "1.0.0",
        })
        expect(responses[1]?.result).toEqual({ tools: [] })
    })

    it("writes nothing to stdout for a notification and logs only to stderr", () => {
        const binDir = makeDir()
        writeFakeCodex(binDir)
        linkGit(binDir)

        const { responses, stderr } = runServer(binDir, [
            { jsonrpc: "2.0", method: "notifications/initialized" },
        ])

        expect(responses).toHaveLength(0)
        expect(stderr).not.toContain("hello")
    })
})
