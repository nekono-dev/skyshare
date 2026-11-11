#!/usr/bin/env node
/**
 * Claude Code のフックで、専用手順書の読了と作業完了条件を判定する。
 *
 * - 起動: `node scripts/agent/kiro-gate.mjs <session-start|user-prompt-submit|pre-tool-use|post-tool-use|stop>`。
 * - 入出力はフック仕様の JSON。失敗時は標準エラーに出して通し、通常作業を止めない。
 * - セッション状態は OS の一時ディレクトリに保存し、リポジトリに残さない。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(scriptDir, "../..")

const STATE_DIR = path.join(os.tmpdir(), "skyshare-kiro-gate")
const SPEC_SECTION_HEADING = /^#{2,3} Specs \(dependency order\)/
const ANY_HEADING = /^#{1,6} /
const SPEC_ITEM = /^- \[[ x]\] ([a-z0-9][a-z0-9-]*) --/

/**
 * プロンプト文字列から先頭の専用コマンド名を取り出す。
 * @param {string} text
 * @returns {string | null}
 */
export const parseKiroCommand = text => {
  const match = /^\s*\/(kiro-[a-z0-9-]+)/.exec(text)
  return match ? match[1] : null
}

/**
 * プロンプト欄が無い入力に備えた、入力全体からの検出（フォールバック）。
 * @param {string} raw
 * @returns {string | null}
 */
export const findKiroCommandInRaw = raw => {
  const match = /\/(kiro-[a-z0-9-]+)/.exec(raw)
  return match ? match[1] : null
}

/** @param {string} root @param {string} name */
export const skillPathFor = (root, name) =>
  path.join(root, ".claude", "skills", name, "SKILL.md")

/**
 * 専用コマンドのセッション状態。
 * @param {{ command: string, skillPath: string, now: number, inputKeys?: string[] }} args
 */
export const startState = ({ command, skillPath, now, inputKeys }) => ({
  active: true,
  command,
  required: [path.resolve(skillPath)],
  read: [],
  startedAt: now,
  inputKeys: inputKeys ?? [],
})

/** @param {{ required: string[], read: string[] } | null | undefined} state */
export const unreadRequired = state =>
  (state?.required ?? []).filter(p => !(state?.read ?? []).includes(p))

/**
 * 手順書が未読の間の、ツール呼び出しの判定。
 * @returns {string | null} deny の理由。許可なら null
 */
export const decidePreToolUse = (state, toolName, toolInput, cwd) => {
  if (!state?.active) return null
  const pending = unreadRequired(state)
  if (pending.length === 0) return null
  if (toolName === "ToolSearch") return null
  if (toolName === "Read") {
    const target = path.resolve(cwd, String(toolInput?.file_path ?? ""))
    if (pending.includes(target)) return null
  }
  return `kiro コマンド /${state.command} の手順書を先に Read してください: ${pending[0]}。それまでほかのツールは使えません。`
}

/**
 * 成功した Read を記録する。手順書以外の Read は状態を変えない。
 * @returns {object} 新しい状態（変化が無ければ元の状態）
 */
export const markRead = (state, toolName, toolInput, cwd) => {
  if (!state?.active || toolName !== "Read") return state
  const target = path.resolve(cwd, String(toolInput?.file_path ?? ""))
  if (!state.required.includes(target) || state.read.includes(target))
    return state
  return { ...state, read: [...state.read, target] }
}

/**
 * roadmap.md の最後の「Specs (dependency order)」節にある新規 spec の名前。
 * roadmap は追補のフェーズを末尾に足すため、最後の節が最新の分割になる。
 * @param {string} roadmapText
 * @returns {string[]}
 */
export const newestSpecNames = roadmapText => {
  const lines = roadmapText.split(/\r?\n/)
  let start = -1
  lines.forEach((line, i) => {
    if (SPEC_SECTION_HEADING.test(line)) start = i
  })
  if (start < 0) return []
  const names = []
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_HEADING.test(lines[i])) break
    const match = SPEC_ITEM.exec(lines[i])
    if (match) names.push(match[1])
  }
  return names
}

/**
 * brief.md が無い新規 spec の名前。
 * @param {string} root
 * @param {string[]} names
 */
export const missingBriefs = (root, names) =>
  names.filter(
    name => !fs.existsSync(path.join(root, ".kiro", "specs", name, "brief.md")),
  )

/**
 * 終了の判定。手順書が未読、または roadmap が今回のセッションで更新され brief.md が揃っていないとき、
 * 一度だけ止める（stop_hook_active が真なら通す）。
 * @param {object} args
 * @param {object | null | undefined} args.state
 * @param {boolean} args.stopHookActive
 * @param {string} args.root
 * @param {number | null} args.roadmapMtimeMs roadmap.md の更新時刻（無ければ null）
 * @param {string} args.roadmapText
 * @returns {string | null} block の理由。通すなら null
 */
export const decideStop = ({
  state,
  stopHookActive,
  root,
  roadmapMtimeMs,
  roadmapText,
}) => {
  if (!state?.active || stopHookActive) return null
  const pending = unreadRequired(state)
  if (pending.length > 0) {
    return `kiro コマンド /${state.command} の手順書 ${pending[0]} を Read していません。読んで手順を実行してください。`
  }
  if (roadmapMtimeMs !== null && roadmapMtimeMs >= state.startedAt) {
    const missing = missingBriefs(root, newestSpecNames(roadmapText))
    if (missing.length > 0) {
      return `roadmap.md の新規 spec に brief.md がありません: ${missing.join(", ")}。Path C/D/E の成果物（brief.md）を作成してから終えてください。`
    }
  }
  return null
}

/**
 * 作業計画の状態の要約（session-start の文脈）。
 * @param {string} root
 * @returns {string[]}
 */
export const summarizeSpecs = root => {
  const dir = path.join(root, ".kiro", "specs")
  if (!fs.existsSync(dir)) return ["（.kiro/specs が無い）"]
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .flatMap(d => {
      const file = path.join(dir, d.name, "spec.json")
      if (!fs.existsSync(file)) return []
      try {
        const spec = JSON.parse(fs.readFileSync(file, "utf8"))
        const a = spec.approvals ?? {}
        const ok = k => (a[k]?.approved ? "済" : "未")
        return [
          `- ${d.name}: ${spec.phase}（要件 ${ok("requirements")}・設計 ${ok("design")}・タスク ${ok("tasks")}）`,
        ]
      } catch {
        return [`- ${d.name}: spec.json を読めない`]
      }
    })
}

const stateFile = sessionId =>
  path.join(
    STATE_DIR,
    `${String(sessionId ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_")}.json`,
  )

const readState = sessionId => {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId), "utf8"))
  } catch {
    return null
  }
}

const writeState = (sessionId, state) => {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(stateFile(sessionId), JSON.stringify(state))
}

const emit = obj => {
  process.stdout.write(JSON.stringify(obj))
}

const handlers = {
  "session-start": () => {
    const lines = [
      "kiro ワークフロー（cc-sdd）の状態:",
      ...summarizeSpecs(repoRoot),
      fs.existsSync(path.join(repoRoot, ".kiro", "steering", "roadmap.md"))
        ? "roadmap.md: あり（再入場。既存の内容は上書きせず追補する）"
        : "roadmap.md: なし",
    ]
    emit({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: lines.join("\n"),
      },
    })
  },

  "user-prompt-submit": (input, raw) => {
    const sessionId = input.session_id
    const text = typeof input.prompt === "string" ? input.prompt : null
    const command =
      text !== null ? parseKiroCommand(text) : findKiroCommandInRaw(raw)
    if (!command) {
      const prev = readState(sessionId)
      if (prev?.active) writeState(sessionId, { ...prev, active: false })
      return
    }
    const skillPath = skillPathFor(repoRoot, command)
    if (!fs.existsSync(skillPath)) {
      writeState(sessionId, {
        active: false,
        command,
        required: [],
        read: [],
        startedAt: Date.now(),
        inputKeys: Object.keys(input),
      })
      // 専用コマンドの手順書が無い場合は作業を止め、導入スクリプトの実行を案内する。
      emit({
        decision: "block",
        reason: `/${command} は使えません。cc-sdd が導入されていません（${skillPath} が無い）。scripts/agent/install-cc-sdd.sh --claude を実行して cc-sdd を導入してから、もう一度入力してください。`,
      })
      return
    }
    writeState(
      sessionId,
      startState({
        command,
        skillPath,
        now: Date.now(),
        inputKeys: Object.keys(input),
      }),
    )
    emit({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `このターンの作業の前に ${skillPath} を Read し、その手順を最後まで実行してください。Read するまで、ほかのツールは使えません（PreToolUse で強制されます）。`,
      },
    })
  },

  "pre-tool-use": input => {
    const reason = decidePreToolUse(
      readState(input.session_id),
      input.tool_name,
      input.tool_input ?? {},
      input.cwd ?? repoRoot,
    )
    if (reason) {
      emit({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      })
    }
  },

  "post-tool-use": input => {
    const state = readState(input.session_id)
    const next = markRead(
      state,
      input.tool_name,
      input.tool_input ?? {},
      input.cwd ?? repoRoot,
    )
    if (next !== state) writeState(input.session_id, next)
  },

  stop: input => {
    const state = readState(input.session_id)
    const roadmap = path.join(repoRoot, ".kiro", "steering", "roadmap.md")
    const roadmapExists = fs.existsSync(roadmap)
    const reason = decideStop({
      state,
      stopHookActive: input.stop_hook_active === true,
      root: repoRoot,
      roadmapMtimeMs: roadmapExists ? fs.statSync(roadmap).mtimeMs : null,
      roadmapText: roadmapExists ? fs.readFileSync(roadmap, "utf8") : "",
    })
    if (reason) emit({ decision: "block", reason })
  },
}

const main = async () => {
  const event = process.argv[2]
  const handler = handlers[event]
  if (!handler) throw new Error(`未知のイベント: ${event}`)
  const raw = await new Promise(resolve => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", chunk => (data += chunk))
    process.stdin.on("end", () => resolve(data))
    process.stdin.on("error", () => resolve(data))
  })
  const input = raw.trim() ? JSON.parse(raw) : {}
  handler(input, raw)
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main().catch(error => {
    // 失敗時は判定せず通す（通常の作業を止めない）
    process.stderr.write(
      `kiro-gate: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exit(0)
  })
}
