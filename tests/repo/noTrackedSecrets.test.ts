/**
 * Git管理下のenvファイルに認証情報が混入していないことの検査。
 *
 * 責務と処理概要:
 * - `git ls-files`で管理対象の`.env*`を列挙し、`PASSWORD`・`SECRET`・`TOKEN`・`KEY`を名前に含む
 *   変数の値が空・プレースホルダ以外であれば失敗させる（過去に検証用アカウントの
 *   アプリパスワードがコミットされた事故の再発防止）。
 * - 認証情報を置くファイルは`.gitignore`で管理対象外にし、雛形（`*.template`）だけを管理する。
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const SENSITIVE_NAME = /(PASSWORD|SECRET|TOKEN|KEY)/i
/** 値として許容するプレースホルダ（空・your-…・example・<…>・xxxx 等） */
const PLACEHOLDER =
    /^(|your[-_].*|.*example.*|<.*>|x{4,}.*|changeme|minioadmin(:minioadmin)?)$/i

const trackedEnvFiles = (): string[] =>
    execFileSync("git", ["ls-files"], { encoding: "utf8" })
        .split("\n")
        .filter(f => /(^|\/)\.env(\.|$)/.test(f))

describe("Git管理下のenvファイル", () => {
    it("認証情報らしい変数に実値が入っていない", () => {
        const violations: string[] = []
        for (const file of trackedEnvFiles()) {
            readFileSync(file, "utf8")
                .split("\n")
                .forEach((line, i) => {
                    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
                    if (!m || !SENSITIVE_NAME.test(m[1])) return
                    const value = m[2].trim().replace(/^["']|["']$/g, "")
                    if (!PLACEHOLDER.test(value)) {
                        // 値そのものは出力しない
                        violations.push(`${file}:${i + 1} ${m[1]}`)
                    }
                })
        }
        expect(violations).toEqual([])
    })
})
