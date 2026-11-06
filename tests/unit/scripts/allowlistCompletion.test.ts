/**
 * 許容リストの完了時の状態の検査（structure-checks 6.1）の単体テスト。
 *
 * 責務と処理概要:
 * - 実リポジトリの `config/architecture/import-allowlist.json` が `loadAllowlist` で読め、
 *   エラーが無いことを確かめる。
 * - 読み込んだ項目のうち、完了時に許されない規則（libLayer・utilShared・typesLeaf・typesOnly）が
 *   0 件であることを確かめる（要件 1.4・8.5）。
 * - 負例として、utilShared の項目を持つ一時ファイルを読み、その項目が検出されることを確かめる。
 *
 * 実装上の制約:
 * - 所有 spec の存在は `check-imports.ts` と同じ判定（`.kiro/specs/<owner>` の存在）で見る。
 * - 一時ファイルは `fs.mkdtempSync` で作り、テストの後に削除する。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    loadAllowlist,
    type AllowlistEntry,
} from "../../../scripts/architecture/allowlist"

const repoRoot = path.resolve(__dirname, "../../..")
const realAllowlistPath = path.join(
    repoRoot,
    "config/architecture/import-allowlist.json",
)

/** check-imports.ts と同じ所有 spec の存在判定。 */
const ownerExists = (owner: string) =>
    fs.existsSync(path.join(repoRoot, ".kiro/specs", owner))

/** 完了時に許容リストへ残してはならない規則（structure-checks 6.1）。 */
const FORBIDDEN_AT_COMPLETION = [
    "libLayer",
    "utilShared",
    "typesLeaf",
    "typesOnly",
] as const

/** 完了時に許されない規則の項目を取り出す（実リポジトリの検査と負例の両方がこの判定を通す）。 */
const forbiddenEntriesOf = (entries: AllowlistEntry[]): AllowlistEntry[] =>
    entries.filter(entry =>
        (FORBIDDEN_AT_COMPLETION as readonly string[]).includes(entry.ruleId),
    )

const tmpDirs: string[] = []

afterAll(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true })
})

describe("許容リストの完了時の状態（structure-checks 6.1）", () => {
    it("実リポジトリの許容リストが読み込みエラー無しで読める（要件 4.4）", () => {
        const loaded = loadAllowlist(realAllowlistPath, ownerExists)
        expect(loaded.errors).toEqual([])
    })

    it("実リポジトリの許容リストに libLayer・utilShared・typesLeaf・typesOnly の項目が 0 件（要件 1.4・8.5）", () => {
        const loaded = loadAllowlist(realAllowlistPath, ownerExists)
        expect(forbiddenEntriesOf(loaded.entries)).toEqual([])
    })

    it("負例: utilShared の項目を持つ一時ファイルは、その項目が検出される（要件 8.5）", () => {
        const dir = fs.mkdtempSync(
            path.join(os.tmpdir(), "allowlist-completion-"),
        )
        tmpDirs.push(dir)
        const file = path.join(dir, "import-allowlist.json")
        fs.writeFileSync(
            file,
            JSON.stringify({
                version: 1,
                entries: [
                    {
                        ruleId: "utilShared",
                        from: "src/util/x.ts",
                        specifier: "",
                        owner: "structure-checks",
                        reason: "負例",
                    },
                ],
            }),
        )
        const loaded = loadAllowlist(file, ownerExists)
        expect(loaded.errors).toEqual([])
        const found = forbiddenEntriesOf(loaded.entries)
        expect(found).toHaveLength(1)
        expect(found[0].ruleId).toBe("utilShared")
    })
})
