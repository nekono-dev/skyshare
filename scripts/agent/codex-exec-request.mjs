/**
 * codex_exec の依頼の検証と、codex exec の起動引数・失敗の文面を作る純粋な部品。
 * プロセスやファイルシステムには触れない。実在と symlink の解決は呼び出し側が注入する。
 */
import path from "node:path"

const SANDBOXES = ["read-only", "workspace-write"]
const DEFAULT_SANDBOX = "workspace-write"
const EFFORTS = ["medium", "high"]
const DEFAULT_EFFORT = "medium"

/**
 * 依頼の種類（sandbox）ごとのモデル。読み取りだけの依頼（レビュー・調査）は Sol、
 * 書き込みの依頼（実装・修正）は Luna を使う。推論の強さは、書き込みの依頼だけ依頼ごとに選べる。
 */
export const MODEL_BY_SANDBOX = {
  "read-only": "gpt-6.1-sol",
  "workspace-write": "gpt-6-luna",
}
const STDERR_TAIL_LIMIT = 4000

/** 依頼の入力を検証し、問題があれば理由付きの error を返す。 */
export const validateExecInput = (raw, env) => {
  const input = raw !== null && typeof raw === "object" ? raw : {}

  const sandbox = input.sandbox === undefined ? DEFAULT_SANDBOX : input.sandbox
  if (!SANDBOXES.includes(sandbox)) {
    return fail(
      "invalid_sandbox",
      `sandbox は ${SANDBOXES.join(" か ")} で指定してください`,
    )
  }

  const effort = input.effort === undefined ? DEFAULT_EFFORT : input.effort
  if (!EFFORTS.includes(effort)) {
    return fail(
      "invalid_effort",
      `effort は ${EFFORTS.join(" か ")} で指定してください`,
    )
  }
  if (input.effort !== undefined && sandbox === "read-only") {
    return fail(
      "effort_on_read_only",
      "effort は sandbox が workspace-write のときだけ指定できます（読み取りの依頼は medium 固定）",
    )
  }

  const prompt = input.prompt
  if (typeof prompt !== "string" || prompt.trim() === "") {
    return fail("empty_prompt", "依頼文（prompt）が空です")
  }

  const realRepoRoot = env.realpath(env.repoRoot)
  if (input.cwd === undefined) {
    return { ok: true, value: { prompt, sandbox, effort, cwd: realRepoRoot } }
  }

  const cwd = resolveCwd(input.cwd, env)
  if (cwd === null) {
    return fail("cwd_not_found", `cwd が存在しません: ${String(input.cwd)}`)
  }
  if (!isInside(realRepoRoot, cwd)) {
    return fail(
      "cwd_outside_repo",
      `cwd がリポジトリの外を指しています: ${cwd}`,
    )
  }
  return { ok: true, value: { prompt, sandbox, effort, cwd } }
}

/**
 * codex exec の引数を作る。承認の指定は exec より前に置き、標準入力は末尾の `-` で渡す。
 * 引数には依頼文（prompt）を入れない。依頼文は標準入力で渡すため、ここでは型として受け取るだけである。
 * モデルは sandbox で決め（`MODEL_BY_SANDBOX`）、推論の強さは `effort`（省略時は medium）で指定する。
 * @param {{ prompt: string, sandbox: string, effort?: string, cwd: string }} exec validateExecInput が返した検証済みの依頼
 * @param {string} outputFile 最後のメッセージの出力先のパス
 * @returns {string[]} codex exec の引数
 */
export const buildCodexArgs = ({ sandbox, effort, cwd }, outputFile) => [
  "--ask-for-approval",
  "never",
  "exec",
  "--model",
  MODEL_BY_SANDBOX[sandbox],
  "--config",
  `model_reasoning_effort="${effort ?? DEFAULT_EFFORT}"`,
  "--sandbox",
  sandbox,
  "--cd",
  cwd,
  "--output-last-message",
  outputFile,
  "-",
]

/** 失敗の文面を作る。標準エラーは末尾の一部だけを残す。 */
export const formatFailure = ({
  exitCode,
  signal,
  lastMessage,
  stderrTail,
}) => {
  const status = signal ? `シグナル ${signal}` : `終了コード ${exitCode}`
  const tail = String(stderrTail ?? "").slice(-STDERR_TAIL_LIMIT)
  return [
    `codex exec が失敗しました（${status}）。`,
    "最後のメッセージ:",
    String(lastMessage ?? ""),
    "標準エラーの末尾:",
    tail,
  ].join("\n")
}

const fail = (kind, message) => ({ ok: false, error: { kind, message } })

/** cwd の実体のパスを返す。存在しない・文字列でない場合は null。 */
const resolveCwd = (cwd, env) => {
  if (typeof cwd !== "string") return null
  try {
    return env.realpath(cwd)
  } catch {
    return null
  }
}

/** 実体のパス child が、実体のパス parent と同じか、その下にあるかを判定する。 */
const isInside = (parent, child) => {
  const rel = path.relative(parent, child)
  if (rel === "") return true
  if (path.isAbsolute(rel)) return false
  return rel !== ".." && !rel.startsWith(`..${path.sep}`)
}
