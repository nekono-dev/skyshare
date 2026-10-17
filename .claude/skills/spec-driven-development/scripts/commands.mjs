/**
 * 検査以外のコマンド（lint の合否には使わない）。
 *
 * - --status: 工程の導出。成果物（tasks.md のチェックボックス・PoC の結論と反映先・architecture の突合）から求め、
 *   宣言値は持たない。常に終了コード 0。
 * - --retarget-poc <テーマ>: architecture の根拠 `poc/<テーマ>` を、PoC の反映先 spec へ付け替える。
 *   既定は差分の表示のみで、--write で適用する。PoC ディレクトリの削除は行わない。
 * - --check-poc-committed <テーマ>: PoC を削除してよい状態（履歴に入っており未コミットの変更がない）かを確認する。
 *   read-only。0=削除可 / 1=未コミットあり / 2=追跡外・確認不能。lint と CI には含めない。
 * - --show-config: 実効値の設定を JSON で表示する。
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { isDesigned, taskProgress } from "./lib.mjs"
import {
  parseArchitecture,
  parsePoc,
  pocState,
  pocThemeOf,
} from "./docs-model.mjs"
import { crossFindings } from "./check-structure.mjs"

const THEME_RE = /^[a-z0-9][a-z0-9-]*$/

export async function runCommand(command, ctx, { json, write }) {
  switch (command.name) {
    case "status":
      return status(ctx, json)
    case "retarget":
      return retarget(ctx, command.theme, write)
    case "checkCommitted":
      return checkCommitted(ctx, command.theme)
    case "showConfig":
      process.stdout.write(JSON.stringify(ctx.config, null, 2) + "\n")
      return 0
    default:
      return 2
  }
}

// ---------------------------------------------------------------------------
// --status
// ---------------------------------------------------------------------------

function specState(spec) {
  const { done, total } = taskProgress(spec)
  if (!isDesigned(spec)) return { state: "要件のみ", done, total }
  if (total > 0 && done === total) return { state: "完了", done, total }
  return { state: done === 0 ? "着手前" : "進行中", done, total }
}

export function statusModel(ctx) {
  const specs = ctx.specs.map((s) => ({ name: s.name, ...specState(s) }))
  const pocs = ctx.docs.pocs.map((p) => {
    const st = pocState(p, ctx.specs)
    return {
      name: p.name,
      state: st.state,
      target: st.target,
      remove: st.remove,
    }
  })
  const designed = ctx.specs.filter(isDesigned).length
  const required = designed >= ctx.config.architecture.minSpecs
  const cross = crossFindings(ctx).length
  const parsed = parseArchitecture(ctx.docs.architecture)
  return {
    specs,
    pocs,
    architecture: {
      exists: Boolean(ctx.docs.architecture.main),
      required,
      designedSpecs: designed,
      minSpecs: ctx.config.architecture.minSpecs,
      mode: parsed?.mode ?? null,
      internalComponents: parsed?.internalCount ?? 0,
      groupMinComponents: ctx.config.architecture.groupMinComponents,
      parts: ctx.docs.architecture.parts.length,
      crossFindings: cross,
    },
  }
}

function status(ctx, json) {
  const m = statusModel(ctx)
  if (json) {
    process.stdout.write(JSON.stringify(m, null, 2) + "\n")
    return 0
  }
  const out = ["spec"]
  for (const s of m.specs)
    out.push(
      `  ${s.name}  ${s.state}${s.state === "要件のみ" ? "" : ` ${s.done}/${s.total}`}`,
    )
  out.push("poc")
  if (m.pocs.length === 0) out.push("  なし")
  for (const p of m.pocs)
    out.push(
      `  ${p.name}  ${p.state}${p.target ? `（反映先: ${p.target}${p.remove ? "・削除対象" : ""}）` : ""}`,
    )
  const a = m.architecture
  out.push(
    "architecture",
    `  ${ctx.docs.architecture.mainRel}  ${a.exists ? "あり" : "なし"}（設計済み spec ${a.designedSpecs} 件、必須とする閾値 ${a.minSpecs} 件 → ${a.required ? "必須" : "任意"}）`,
    `  形式  ${a.mode === "grouped" ? `機能のくくり別（くくりの文書 ${a.parts} 件）` : a.mode === "single" ? "1 ファイル" : a.mode === "legacy" ? "旧形式（要移行）" : "-"}（内部の構成要素 ${a.internalComponents} 個、くくり別にする閾値 ${a.groupMinComponents} 個以上）`,
    `  spec・根拠との突合  ${a.crossFindings === 0 ? "指摘なし" : `${a.crossFindings} 件の指摘`}`,
  )
  process.stdout.write(out.join("\n") + "\n")
  return 0
}

// ---------------------------------------------------------------------------
// --retarget-poc
// ---------------------------------------------------------------------------

function retarget(ctx, theme, write) {
  const poc = ctx.docs.pocs.find((p) => p.name === theme)
  if (!poc || !poc.readme) {
    process.stderr.write(`poc/${theme} が存在しない（README.md が必要）\n`)
    return 2
  }
  const target = parsePoc(poc).target.name
  if (!target) {
    process.stderr.write(
      `poc/${theme} の反映先が「- なし」のため、付け替え先を決められない\n`,
    )
    return 2
  }
  if (!ctx.specs.some((s) => s.name === target && isDesigned(s))) {
    process.stderr.write(
      `反映先 ${target} が設計済みの spec として存在しない\n`,
    )
    return 2
  }
  const parsed = parseArchitecture(ctx.docs.architecture)
  if (!parsed) {
    process.stdout.write("付け替え対象なし（docs/architecture.md がない）\n")
    return 0
  }
  const changes = []
  for (const doc of parsed.docs)
    for (const row of doc.basis) {
      if (!row.refs.some((r) => pocThemeOf(r) === theme)) continue
      const line = doc.file.lines.find((l) => l.no === row.no)
      const m = /^(.*\|\s*)([^|]*?)(\s*\|\s*)$/.exec(line.text)
      if (!m) continue
      const sep = m[2].includes("、") ? "、" : ", "
      const next = [
        ...new Set(row.refs.map((r) => (pocThemeOf(r) === theme ? target : r))),
      ].join(sep)
      changes.push({
        file: doc.file,
        no: row.no,
        before: m[2],
        after: next,
        text: m[1] + next + m[3],
      })
    }
  if (changes.length === 0) {
    process.stdout.write(
      `付け替え対象なし（根拠に poc/${theme} を持つ行がない）\n`,
    )
    return 0
  }
  for (const c of changes)
    process.stdout.write(`${c.file.rel}:${c.no}: ${c.before} → ${c.after}\n`)
  if (!write) {
    process.stdout.write("差分の表示のみ。適用は --write を付ける\n")
    return 0
  }
  for (const rel of new Set(changes.map((c) => c.file.rel))) {
    const file = path.resolve(rel)
    const raw = fs.readFileSync(file, "utf8").split("\n")
    for (const c of changes) if (c.file.rel === rel) raw[c.no - 1] = c.text
    fs.writeFileSync(file, raw.join("\n"))
  }
  process.stdout.write(
    `適用した。表の桁を整えるため prettier --write docs を実行する\n`,
  )
  return 0
}

// ---------------------------------------------------------------------------
// --check-poc-committed
// ---------------------------------------------------------------------------

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" })

function checkCommitted(ctx, theme) {
  if (!THEME_RE.test(theme ?? "")) {
    process.stderr.write(`テーマ名が不正: ${theme}\n`)
    return 2
  }
  const dir = path.join(ctx.repoRoot, "poc", theme)
  if (!fs.existsSync(dir)) {
    process.stderr.write(`poc/${theme} が存在しない\n`)
    return 2
  }
  const inside = git(ctx.repoRoot, "rev-parse", "--is-inside-work-tree")
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    process.stderr.write(
      "git の作業ツリーではないため、履歴の有無を確認できない\n",
    )
    return 2
  }
  const tracked = git(ctx.repoRoot, "ls-files", "--", `poc/${theme}`)
  if (tracked.stdout.trim() === "") {
    process.stderr.write(
      `poc/${theme} は git の追跡外（履歴に入っていない）。削除前にコミットが必要\n`,
    )
    return 2
  }
  const dirty = git(ctx.repoRoot, "status", "--porcelain", "--", `poc/${theme}`)
  if (dirty.stdout.trim() !== "") {
    process.stdout.write(
      `poc/${theme} に未コミットの変更がある。削除前にコミットが必要:\n${dirty.stdout}`,
    )
    return 1
  }
  process.stdout.write(
    `poc/${theme} は履歴に入っており、未コミットの変更がない（削除してよい）\n`,
  )
  return 0
}
