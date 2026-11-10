#!/usr/bin/env node
/**
 * Codex を MCP サーバー `codex` として提供する入口（改行区切りの JSON-RPC over stdio）。
 * codex と git が揃わないときは、ツールを 1 つも出さない（Claude だけで進む）。
 * 使い方: 手動で起動するときは node scripts/agent/codex-mcp-server.mjs。通常は .mcp.json が起動する。
 */
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import { probeEnvironment } from "./codex-env.mjs"
import {
  buildCodexArgs,
  formatFailure,
  validateExecInput,
} from "./codex-exec-request.mjs"
import { WaitLimitError, createExecQueue } from "./codex-exec-queue.mjs"
import { runCodex } from "./codex-exec-runner.mjs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_PROTOCOL_VERSION = "2025-06-18"
const SERVER_INFO = { name: "codex", version: "1.0.0" }

// 実行の上限。待ち時間は列に入ってから実行を許されるまで、打ち切りは実行中の時間に対して数える
const WAIT_LIMIT_MS = 120_000
const TIMEOUT_MS = 600_000
const KILL_GRACE_MS = 5_000
const MAX_CONCURRENT = { read: 5, write: 1 }
// runCodex が `--output-last-message` の直後の値をこの仮の値から一時ファイルのパスに置き換える
const OUTPUT_PLACEHOLDER = "__OUTPUT_FILE__"

/** 利用者（Claude）に示す `codex_exec` の定義。 */
export const codexExecTool = {
  name: "codex_exec",
  description:
    "Run a task with Codex CLI in this repository. Codex can read files and, by default, edit files within the selected sandbox.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        minLength: 1,
        description: "The task for Codex. Passed to codex exec on stdin.",
      },
      sandbox: {
        type: "string",
        enum: ["read-only", "workspace-write"],
        default: "workspace-write",
        description:
          "Sandbox for the run. Omitted means workspace-write, the default.",
      },
      cwd: {
        type: "string",
        description:
          "Absolute path inside the repository to run in. Omitted means the repository root.",
      },
    },
    required: ["prompt"],
  },
}

/** JSON-RPC のエラーの応答を作る。`id` が判らないときは null を渡す。 */
const errorResponse = (id, code, message) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
})

/** ツールの結果（isError の真偽と本文）を作る。失敗は JSON-RPC のエラーにせず、この形で返す。 */
const toolResult = (text, isError) => ({
  content: [{ type: "text", text }],
  isError,
})

/** 標準エラーへ 1 行のログを書く。標準出力は JSON-RPC の応答に使うため、ここには書かない。 */
const writeStderrLog = message => {
  process.stderr.write(`[codex-mcp-server] ${message}\n`)
}

/** 実時間の時計。待ち列の注入点に渡す。 */
const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: handle => clearTimeout(handle),
}

/** ミリ秒の上限を、利用者に読める文面にする（分で割り切れるときは分）。 */
const formatLimit = ms =>
  ms % 60_000 === 0 ? `${ms / 60_000} 分` : `${ms} ミリ秒`

/** ログに出す実行の結果の要約。終了コードと種類だけで、本文は含めない。 */
const describeOutcome = result => {
  switch (result.kind) {
    case "completed":
      return "exit=0"
    case "failed": {
      const exit = `exit=${result.exitCode ?? "none"}`
      return result.signal ? `${exit} signal=${result.signal}` : exit
    }
    default:
      return result.kind
  }
}

/**
 * runCodex の結果を、MCP の tools/call の結果に変換する。
 * 成功は最後のメッセージを本文にする。失敗・打ち切りは isError にし、残った情報を本文に含める。
 * @param {object} result runCodex の RunResult
 * @param {{ timeoutMs: number }} limits 打ち切りの文面に使う上限
 */
const toToolResult = (result, { timeoutMs }) => {
  switch (result.kind) {
    case "completed":
      return toolResult(result.lastMessage, false)
    case "failed":
      return toolResult(formatFailure(result), true)
    case "timeout":
      return toolResult(
        [
          `codex exec が時間の上限（${formatLimit(timeoutMs)}）に達したため、打ち切りました。`,
          "途中までの最後のメッセージ:",
          result.lastMessage,
          "標準エラーの末尾:",
          result.stderrTail,
        ].join("\n"),
        true,
      )
    default:
      return toolResult(
        `codex exec を起動できませんでした: ${result.message}`,
        true,
      )
  }
}

/**
 * `codex_exec` の呼び出しを、検証 → 待ち列 → 実行 の順に行い、必ず 1 つの結果を返す関数を作る。
 * 検証の失敗と待ち時間の上限では、プロセスを起動しない。
 * 外部に依存する部品（時計・実行・ログ・実在の確認）はすべて注入できる。省略時は本番の値を使う。
 * @param {{ repoRoot: string, command?: string, realpath?: (p: string) => string, waitLimitMs?: number, timeoutMs?: number, killGraceMs?: number, clock?: typeof realClock, runner?: typeof runCodex, log?: (message: string) => void }} options
 * @returns {(rawArgs: unknown) => Promise<object>}
 */
export const createCodexExecCaller = ({
  repoRoot,
  command = "codex",
  realpath = fs.realpathSync,
  waitLimitMs = WAIT_LIMIT_MS,
  timeoutMs = TIMEOUT_MS,
  killGraceMs = KILL_GRACE_MS,
  clock = realClock,
  runner = runCodex,
  log = writeStderrLog,
}) => {
  // 呼び出しの列は、この関数の呼び出しの全体で 1 つ共有する
  const queue = createExecQueue({
    maxConcurrent: MAX_CONCURRENT,
    waitLimitMs,
    clock,
  })

  return async rawArgs => {
    try {
      const validation = validateExecInput(rawArgs, { repoRoot, realpath })
      if (!validation.ok) {
        log(
          `${new Date(clock.now()).toISOString()} rejected=${validation.error.kind}`,
        )
        return toolResult(validation.error.message, true)
      }
      const { value } = validation
      // 読み取りだけの依頼は読み取りの列、それ以外（workspace-write）は書き込みの列に入れる
      const kind = value.sandbox === "read-only" ? "read" : "write"

      const waitStart = clock.now()
      let admission
      try {
        admission = await queue.acquire(kind)
      } catch (error) {
        // 待ち時間の上限に達した。実行していない
        const message = error instanceof Error ? error.message : String(error)
        const reason =
          error instanceof WaitLimitError ? "wait_limit" : "queue_error"
        log(
          `${new Date(clock.now()).toISOString()} kind=${kind} wait_ms=${clock.now() - waitStart} rejected=${reason}`,
        )
        return toolResult(message, true)
      }

      const waitMs = clock.now() - waitStart
      let result
      try {
        result = await runner(buildCodexArgs(value, OUTPUT_PLACEHOLDER), {
          command,
          cwd: value.cwd,
          prompt: value.prompt,
          timeoutMs,
          killGraceMs,
        })
      } finally {
        // 実行の成否によらず、必ず許可を解放する
        admission.release()
      }
      log(
        `${new Date(clock.now()).toISOString()} kind=${kind} wait_ms=${waitMs} ${describeOutcome(result)}`,
      )
      return toToolResult(result, { timeoutMs })
    } catch (error) {
      // 想定外の例外も結果の形で返す（JSON-RPC のエラーにはしない）
      return toolResult(
        `codex_exec の実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        true,
      )
    }
  }
}

/**
 * tools/call の本体。公開されていないツール（名前違い・codex が無い）は、未知のツールとして isError を返す。
 * JSON-RPC のエラーにはせず、プロセスも起動しない。
 * @param {unknown} params tools/call の params
 * @param {{ tools: Array<typeof codexExecTool>, callCodexExec?: (rawArgs: unknown) => Promise<object> }} context
 * @returns {Promise<object>}
 */
const callTool = async (params, { tools, callCodexExec }) => {
  const name = params?.name
  const exposed = tools.some(tool => tool.name === name)
  if (!exposed || typeof callCodexExec !== "function") {
    return toolResult(`未知のツールです: ${String(name)}`, true)
  }
  return callCodexExec(params?.arguments)
}

/**
 * 1 件のメッセージに対する応答を返す。応答しないもの（`id` が無い通知）は null。
 * tools/call だけは非同期なので Promise を返す。それ以外は同期に返す。
 * @param {unknown} message 解析済みの JSON-RPC のメッセージ
 * @param {{ tools: Array<typeof codexExecTool>, callCodexExec?: (rawArgs: unknown) => Promise<object> }} context
 *   公開するツールの一覧と、`codex_exec` の呼び出し（省略時は未知のツール扱い）
 * @returns {object | null | Promise<object>}
 */
export const handleMessage = (message, context) => {
  if (
    typeof message !== "object" ||
    message === null ||
    Array.isArray(message)
  ) {
    return errorResponse(null, -32600, "Invalid Request")
  }
  // `id` が無いメッセージは通知として扱い、応答しない
  if (!("id" in message)) return null

  const { id, method, params } = message
  switch (method) {
    case "initialize": {
      // クライアントが要求した版を返す。文字列で無ければ既定の版を返す
      const requested = params?.protocolVersion
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion:
            typeof requested === "string"
              ? requested
              : DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      }
    }
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: context.tools } }
    case "tools/call":
      return callTool(params, context).then(result => ({
        jsonrpc: "2.0",
        id,
        result,
      }))
    default:
      return errorResponse(id, -32601, `Method not found: ${String(method)}`)
  }
}

/**
 * 1 行の入力から、出力する 1 行の JSON を作る。応答しないときは null。
 * JSON として解析できない行は、`id` が null の -32700 を返す。tools/call のときは Promise を返す。
 * @param {string} line
 * @param {{ tools: Array<typeof codexExecTool>, callCodexExec?: (rawArgs: unknown) => Promise<object> }} context
 * @returns {string | null | Promise<string | null>}
 */
export const handleLine = (line, context) => {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return JSON.stringify(errorResponse(null, -32700, "Parse error"))
  }
  const response = handleMessage(message, context)
  if (response instanceof Promise) {
    return response.then(resolved =>
      resolved === null ? null : JSON.stringify(resolved),
    )
  }
  return response === null ? null : JSON.stringify(response)
}

/**
 * 標準入力の各行を処理し、応答を 1 行ずつ標準出力へ書く。
 * tools/call は完了した順に応答する（応答は id で対応づける）。
 * @param {{ input: NodeJS.ReadableStream, output: { write(chunk: string): unknown }, tools: Array<typeof codexExecTool>, callCodexExec?: (rawArgs: unknown) => Promise<object> }} options
 */
export const serve = ({ input, output, tools, callCodexExec }) => {
  const rl = readline.createInterface({ input, crlfDelay: Infinity })
  rl.on("line", line => {
    // 空行は無視する（区切りの改行だけの行）
    if (line.trim() === "") return
    const response = handleLine(line, { tools, callCodexExec })
    if (response instanceof Promise) {
      response.then(text => {
        if (text !== null) output.write(`${text}\n`)
      })
      return
    }
    if (response !== null) output.write(`${response}\n`)
  })
}

/**
 * 起動時に環境を確かめ、利用できるときだけ `codex_exec` を公開する。
 * 確かめに失敗したときは利用できない扱いにし、サーバーは起動を続ける。
 * 利用できたときは、リポジトリの根も返す（`codex_exec` の検証の基準に使う）。
 * @param {{ searchPath: string | undefined, startDir: string, probe?: typeof probeEnvironment, log?: (message: string) => void }} options
 * @returns {Promise<{ tools: Array<typeof codexExecTool>, repoRoot: string | null }>}
 */
export const resolveTools = async ({
  searchPath,
  startDir,
  probe = probeEnvironment,
  log = () => {},
}) => {
  let result
  try {
    result = await probe({ searchPath: searchPath ?? "", startDir })
  } catch (error) {
    log(
      `環境の確認に失敗したため、ツールを公開しません: ${error instanceof Error ? error.message : String(error)}`,
    )
    return { tools: [], repoRoot: null }
  }
  if (!result.available) {
    log(
      `codex または git が見つからないため、ツールを公開しません（不足: ${result.missing.join(", ")}）`,
    )
    return { tools: [], repoRoot: null }
  }
  return { tools: [codexExecTool], repoRoot: result.repoRoot }
}

/**
 * 実際の標準入出力とプロセスの環境に接続して起動する。
 * 環境の確認を終えてから読み始めるため、確認の前に届いた入力は標準入力のバッファに残る。
 */
const main = async () => {
  const { tools, repoRoot } = await resolveTools({
    searchPath: process.env.PATH,
    startDir: scriptDir,
    log: writeStderrLog,
  })
  const callCodexExec =
    repoRoot === null
      ? undefined
      : createCodexExecCaller({ repoRoot, log: writeStderrLog })
  serve({ input: process.stdin, output: process.stdout, tools, callCodexExec })
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
