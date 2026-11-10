/**
 * codex の子プロセスを 1 回実行し、依頼文を標準入力で渡して結果を返す副作用の部品。
 * 最後のメッセージは専用の一時ディレクトリのファイルで受け、実行の後にディレクトリごと消す。
 * 依頼文はファイルに書かない。
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/** 起動引数の中で、出力先のファイルを表す仮の値。`--output-last-message` の直後に置かれる。 */
const OUTPUT_PLACEHOLDER = "__OUTPUT_FILE__"
const OUTPUT_FLAG = "--output-last-message"
const STDERR_TAIL_LIMIT = 4000
const DEFAULT_TIMEOUT_MS = 600000
const DEFAULT_KILL_GRACE_MS = 5000

/**
 * codex を 1 回実行する。通常の失敗は例外にせず、RunResult の kind で返す。
 * args は呼び出し側が組み立てた引数である。`--output-last-message` の直後の `__OUTPUT_FILE__` だけを、
 * この部品が作る一時ファイルのパスに置き換える。それ以外の引数は変えない。
 * 結果を返す前に子プロセスは終了し、一時ディレクトリは削除されている。
 * options を省略すると `{}` として扱う（TypeError にはしない）。ただし cwd と prompt は呼び出し側が渡す前提である。
 */
export const runCodex = async (args, options = {}) => {
  const {
    command = "codex",
    cwd,
    prompt,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    killGraceMs = DEFAULT_KILL_GRACE_MS,
  } = options

  // 最後のメッセージだけを置く専用ディレクトリ（依頼文は置かない）
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-exec-"))
  const outputFile = path.join(outputDir, "last-message.txt")
  try {
    const argv = replaceOutputPlaceholder(args, outputFile)
    const outcome = await execute(command, argv, {
      cwd,
      prompt,
      timeoutMs,
      killGraceMs,
    })
    if (outcome.kind === "spawn_error") {
      return outcome
    }
    const lastMessage = readLastMessage(outputFile)
    return toRunResult(outcome, lastMessage)
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true })
  }
}

/** `--output-last-message` の直後の仮の値だけを、出力先のパスに置き換えた配列を返す。 */
const replaceOutputPlaceholder = (args, outputFile) =>
  args.map((arg, index) =>
    index > 0 && args[index - 1] === OUTPUT_FLAG && arg === OUTPUT_PLACEHOLDER
      ? outputFile
      : arg,
  )

/**
 * 子プロセスを独立したプロセスグループで起動し、終了を待つ。
 * 打ち切りの時間を超えたらグループ全体に SIGTERM を送り、猶予の後も終わらなければ SIGKILL を送る。
 * 孫プロセスが標準エラーのパイプを開けたままでも、'close' を待ち続けない。
 * 直接の子が自然に終了した場合は、'close' を猶予（killGraceMs）まで待ち、
 * その後はグループに SIGKILL を送って標準入出力を閉じ、終了コードの結果を返す。
 * 結果の確定は一度だけ行い、すべてのタイマーを解除する。
 */
const execute = (command, argv, { cwd, prompt, timeoutMs, killGraceMs }) =>
  new Promise(resolve => {
    let child
    try {
      // detached で、子が自分のプロセスグループの先頭になる（グループ単位で信号を送るため）
      child = spawn(command, argv, {
        cwd,
        detached: true,
        stdio: ["pipe", "ignore", "pipe"],
      })
    } catch (error) {
      resolve({ kind: "spawn_error", message: errorMessage(error) })
      return
    }

    let settled = false
    let timedOut = false
    let exited = null
    let stderrTail = ""
    let termTimer = null
    let killTimer = null
    let graceTimer = null

    // 標準エラーは末尾だけを残す（上限を超えたら先頭を捨てる）
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", chunk => {
      stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL_LIMIT)
    })

    // 子が先に終わって標準入力が閉じていても、書き込みの失敗で落ちないようにする
    child.stdin.on("error", () => {})
    child.stdin.end(prompt, "utf8")

    const clearTimers = () => {
      for (const timer of [termTimer, killTimer, graceTimer]) {
        if (timer !== null) clearTimeout(timer)
      }
    }

    // 結果は一度だけ確定する。確定したらタイマーを解除する
    const settle = outcome => {
      if (settled) return
      settled = true
      clearTimers()
      resolve(outcome)
    }

    const makeOutcome = () => ({
      kind: "exited",
      timedOut,
      exitCode: exited === null ? null : exited.exitCode,
      signal: exited === null ? "SIGKILL" : exited.signal,
      stderrTail,
    })

    // プロセスグループ全体に信号を送る。グループが既に無い場合（ESRCH など）は無視する
    const signalGroup = signal => {
      try {
        process.kill(-child.pid, signal)
      } catch {
        // 既に終わっている、または権限が無い場合は、結果の確定に任せる
      }
    }

    // SIGKILL の後は、'close' を猶予の時間だけ待つ。来なければ標準入出力を閉じて確定する
    const escalate = () => {
      signalGroup("SIGKILL")
      graceTimer = setTimeout(() => {
        child.stdin.destroy()
        child.stderr.destroy()
        settle(makeOutcome())
      }, killGraceMs)
    }

    termTimer = setTimeout(() => {
      timedOut = true
      signalGroup("SIGTERM")
      killTimer = setTimeout(escalate, killGraceMs)
    }, timeoutMs)

    child.on("error", error => {
      // 起動できなかった場合だけ、ここで結果を確定する。起動後のエラーは終了の通知を待つ
      if (child.pid === undefined) {
        settle({ kind: "spawn_error", message: errorMessage(error) })
      }
    })

    child.on("exit", (exitCode, signal) => {
      exited = { exitCode, signal }
      // 打ち切りの後は SIGTERM の猶予（killTimer）に任せる。そうでなければ、
      // 直接の子の終了後に残ったグループを猶予の後に片付ける
      if (!timedOut) {
        clearTimeout(termTimer)
        termTimer = null
        graceTimer = setTimeout(escalate, killGraceMs)
      }
    })

    child.on("close", (exitCode, signal) => {
      exited = { exitCode, signal }
      settle(makeOutcome())
    })
  })

/** 出力先のファイルから最後のメッセージを読む。ファイルが無ければ空文字。 */
const readLastMessage = outputFile => {
  try {
    return fs.readFileSync(outputFile, "utf8")
  } catch {
    return ""
  }
}

/** 終了の内容と最後のメッセージから、公開する RunResult を作る。 */
const toRunResult = (
  { timedOut, exitCode, signal, stderrTail },
  lastMessage,
) => {
  if (timedOut) {
    return { kind: "timeout", lastMessage, stderrTail }
  }
  if (exitCode === 0 && signal === null) {
    return { kind: "completed", lastMessage }
  }
  return { kind: "failed", exitCode, signal, lastMessage, stderrTail }
}

const errorMessage = error =>
  error instanceof Error ? error.message : String(error)
