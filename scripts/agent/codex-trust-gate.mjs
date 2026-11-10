#!/usr/bin/env node
/**
 * Codex が信頼していないリポジトリで、利用者の入力を止める（UserPromptSubmit のフック）。
 * 読み取りだけを行い、Codex の設定には書き込まない。判定できないときは通す。
 *
 * 使い方: node scripts/agent/codex-trust-gate.mjs user-prompt-submit
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "../..")

/** 判定の結果。止めないときは null。 */
/** @typedef {{ hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true }, decision: "block", reason: string } | null} TrustDecision */

/** 実体のパスを返す。取れないときは元のパスのまま。 */
const realpathOrSelf = p => {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}

/**
 * 信頼を照合する候補パスを作る（重複を除く）。
 * 作業ツリーの根と、commonDir の親（メインの作業ツリー）、それぞれの実体パス。
 * commonDir が null のときは作業ツリーの根だけを基にする。
 */
export const resolveTrustCandidates = ({
  worktreeRoot,
  commonDir,
  realpath,
}) => {
  const base = [worktreeRoot]
  if (commonDir !== null) base.push(path.dirname(commonDir))
  const all = [...base, ...base.map(p => realpath(p))]
  return [...new Set(all)]
}

/** テーブルの見出し全体（[a.b] / [[a.b]] / 引用符つきのキー）。 */
const keyPart = String.raw`(?:[A-Za-z0-9_-]+|"[^"]*")`
const tableHeaderPattern = new RegExp(
  String.raw`^\[\[?\s*${keyPart}(?:\s*\.\s*${keyPart})*\s*\]\]?$`,
)
/** 見出しの中の 1 つのキー。 */
const keyTokenPattern = new RegExp(keyPart, "g")

/**
 * Codex の設定（TOML の一部）で、候補のどれかの `[projects."..."]` に trust_level = "trusted" があるかを返す。
 * 不正なテーブルの見出しや、key = value の形でない行があれば例外にする。
 */
export const isRepoTrusted = (configText, candidates) => {
  const trustedPaths = new Set()
  let currentProject = null
  for (const rawLine of configText.split("\n")) {
    const line = rawLine.trim()
    if (line === "" || line.startsWith("#")) continue
    if (line.startsWith("[")) {
      // 見出しは「キー（裸または引用符）のドット区切り」。例: [hooks.state."/path"]
      if (!tableHeaderPattern.test(line)) {
        throw new Error(
          `Codex の設定のテーブルの見出しを解析できません: ${line}`,
        )
      }
      const keys =
        line
          .replace(/^\[\[?/, "")
          .replace(/\]\]?$/, "")
          .match(keyTokenPattern) ?? []
      // [projects."<パス>"] だけを信頼の対象にする（配列の表 [[...]] は対象外）
      const isProjectTable =
        !line.startsWith("[[") &&
        keys.length === 2 &&
        keys[0] === "projects" &&
        keys[1].startsWith('"')
      currentProject = isProjectTable ? keys[1].slice(1, -1) : null
      continue
    }
    const keyValue = line.match(/^([A-Za-z0-9_."-]+)\s*=\s*(.*)$/)
    if (!keyValue) throw new Error(`Codex の設定の行を解析できません: ${line}`)
    if (currentProject !== null && keyValue[1] === "trust_level") {
      const value = keyValue[2].match(/^"([^"]*)"/)
      if (value && value[1] === "trusted") trustedPaths.add(currentProject)
    }
  }
  return candidates.some(candidate => trustedPaths.has(candidate))
}

/** PATH の中に、実行できる codex があるかを返す（codex は起動しない）。 */
export const codexAvailable = searchPath =>
  (searchPath ?? "").split(path.delimiter).some(dir => {
    // 空の要素は無視する
    if (dir === "") return false
    const file = path.join(dir, "codex")
    try {
      if (!fs.statSync(file).isFile()) return false
      // 実行できないときは例外になる
      fs.accessSync(file, fs.constants.X_OK)
      return true
    } catch {
      return false
    }
  })

/** 利用者に示す理由（信頼の手順と、確認後に入力し直すこと）。 */
const trustBlockReason = examplePath =>
  [
    "このリポジトリは Codex で信頼されていないため、利用者の入力を止めています。",
    "信頼させる方法は次のどちらかです。",
    "1. Codex でこのリポジトリを開き、信頼する。",
    "2. Codex の設定（CODEX_HOME の下の config.toml。未設定なら ~/.codex/config.toml）に次のテーブルを書く。",
    `   [projects."${examplePath}"]`,
    '   trust_level = "trusted"',
    `   書くパスは実体のパスです（この例のパス: ${examplePath}）。`,
    "信頼したら、この入力をもう一度入力してください。判定は毎回行われます。",
  ].join("\n")

/**
 * UserPromptSubmit の判定。
 * codex が無ければ null。設定が無い・信頼されていなければ block。読めない・解析できないときは標準エラーに理由を出して null。
 */
export const decideUserPromptSubmit = ({
  candidates,
  env,
  homeDir,
  searchPath,
  readFile,
}) => {
  if (!codexAvailable(searchPath)) return null

  const codexHome = env.CODEX_HOME
  const configPath =
    codexHome !== undefined && codexHome !== ""
      ? `${codexHome}/config.toml`
      : `${homeDir}/.codex/config.toml`

  try {
    const configText = readFile(configPath)
    // ファイルが無いときは、Codex の既定どおり信頼されていない扱いにする
    const trusted = configText !== null && isRepoTrusted(configText, candidates)
    if (trusted) return null
    // 例の表示パスは、先頭の候補の実体のパス（書く先のパスとして示す）
    const examplePath = realpathOrSelf(candidates[0])
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        // 表示からプロンプトの本文を外す（会話の記録からは外れない）
        suppressOriginalPrompt: true,
      },
      decision: "block",
      reason: trustBlockReason(examplePath),
    }
  } catch (error) {
    // 判定できないときは通す（作業を止めない）
    process.stderr.write(
      `codex-trust-gate: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    return null
  }
}

/** git の出力を 1 行で得る。失敗時は例外。 */
const gitOutput = (args, cwd) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()

/** 読めないファイルは null、それ以外はファイルの本文を返す。 */
const readFileOrNull = p => {
  try {
    return fs.readFileSync(p, "utf8")
  } catch (error) {
    if (error && error.code === "ENOENT") return null
    throw error
  }
}

/** 作業ツリーの根と共通の .git から候補を作る。git が使えないときは、このファイルの位置から求めた根だけ。 */
const buildCandidates = () => {
  try {
    const worktreeRoot = gitOutput(
      ["rev-parse", "--show-toplevel"],
      process.cwd(),
    )
    const commonDir = gitOutput(
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      process.cwd(),
    )
    return resolveTrustCandidates({
      worktreeRoot,
      commonDir,
      realpath: realpathOrSelf,
    })
  } catch {
    return resolveTrustCandidates({
      worktreeRoot: repoRoot,
      commonDir: null,
      realpath: realpathOrSelf,
    })
  }
}

const main = () => {
  const event = process.argv[2]
  if (event !== "user-prompt-submit")
    throw new Error(`未知のイベント: ${event}`)
  // フックの入力（JSON）を読む。内容は判定に使わないが、形式の誤りは失敗として扱う
  JSON.parse(fs.readFileSync(0, "utf8"))
  const output = decideUserPromptSubmit({
    candidates: buildCandidates(),
    env: process.env,
    homeDir: os.homedir(),
    searchPath: process.env.PATH,
    readFile: readFileOrNull,
  })
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`)
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  try {
    main()
  } catch (error) {
    // 判定できないときは通す（作業を止めない）
    process.stderr.write(
      `codex-trust-gate: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(0)
  }
}
