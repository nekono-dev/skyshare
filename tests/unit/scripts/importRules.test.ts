/**
 * 依存規則の検査（scripts/architecture）の単体テスト。
 *
 * 責務と処理概要:
 * - 走査（importGraph）と領域の判定（regions）の期待値を、fixture の木で固定する。
 * - 規則・循環・許容リスト・終了コードのテストは、後続の節で追加する。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { scanModules } from "../../../scripts/architecture/importGraph"
import { regionOf } from "../../../scripts/architecture/regions"
import {
    evaluateImportRules,
    RULE_BASIS,
    RULE_IDS,
} from "../../../scripts/architecture/rules"
import { findCycleViolations } from "../../../scripts/architecture/cycles"
import {
    checkAllowlist,
    emitAllowlist,
    loadAllowlist,
} from "../../../scripts/architecture/allowlist"
import { runImportCheck } from "../../../scripts/architecture/check-imports"

const scanRoot = path.resolve(__dirname, "../../fixtures/import-rules/scan")

describe("走査（importGraph）", () => {
    const graph = scanModules(scanRoot)
    const targetsOf = (from: string) =>
        graph.edges
            .filter(e => e.from === from)
            .map(e => ({
                spec: e.specifier,
                typeOnly: e.typeOnly,
                target: e.target,
            }))

    it("生成物と型宣言ファイルを列挙しない", () => {
        expect(graph.modules).not.toContain("src/client/openapi/client.ts")
        expect(graph.modules).not.toContain("src/global.d.ts")
        expect(graph.modules).toContain("src/lib/entry/entry.ts")
    })

    it("型だけの import と動的 import の文字列リテラルを区別して取り出す", () => {
        const edges = targetsOf("src/lib/entry/entry.ts")
        expect(edges).toContainEqual({
            spec: "@/lib/timeline/shape",
            typeOnly: true,
            target: { kind: "module", path: "src/lib/timeline/shape.ts" },
        })
        expect(edges).toContainEqual({
            spec: "@/util/time",
            typeOnly: false,
            target: { kind: "module", path: "src/util/time.ts" },
        })
    })

    it("相対パスを書かれた位置から解決する", () => {
        expect(targetsOf("src/lib/entry/entry.ts")).toContainEqual({
            spec: "./helper",
            typeOnly: false,
            target: { kind: "module", path: "src/lib/entry/helper.ts" },
        })
    })

    it("生成物への import は辺にも未解決にもしない（設計: 生成物は検査の対象外）", () => {
        expect(targetsOf("src/lib/entry/gen.ts")).toEqual([])
        expect(
            graph.unresolved.some(u => u.from === "src/lib/entry/gen.ts"),
        ).toBe(false)
    })

    it("astro はフロントマターの import だけを取り出し、本文の script は含めない", () => {
        const specs = targetsOf("src/pages/index.astro").map(e => e.spec)
        expect(specs).toContain("@/components/common/Badge/index")
        expect(specs).not.toContain("@/nothere/ignored")
    })

    it("外部パッケージは package として取り出し、型だけかどうかを区別する", () => {
        expect(targetsOf("src/lib/entry/view.ts")).toContainEqual({
            spec: "react",
            typeOnly: true,
            target: { kind: "package", name: "react" },
        })
    })
})

describe("領域の判定（regionOf）", () => {
    it.each([
        ["src/lib/entry/entry.ts", "lib/entry"],
        ["src/lib/guestMode.ts", "lib"],
        ["src/components/common/Badge/index.tsx", "components/common/Badge"],
        ["src/components/common/Icon.tsx", "components/common"],
        ["src/pages/index.astro", "pages"],
        ["src/util/http.ts", "util"],
        ["src/env.ts", "(root)"],
    ])("%s は %s", (file, region) => {
        expect(regionOf(file)).toBe(region)
    })
})

const violationsRoot = path.resolve(
    __dirname,
    "../../fixtures/import-rules/violations",
)

describe("規則（rules）", () => {
    const violations = evaluateImportRules(scanModules(violationsRoot))
    const has = (ruleId: string, from: string, specifier: string) =>
        violations.some(
            v =>
                v.ruleId === ruleId &&
                v.from === from &&
                v.specifier === specifier,
        )

    it("R1: lib から components・pages への import を違反にする（要件 1.1・1.2）", () => {
        expect(
            has(
                "layer",
                "src/lib/timeline/bad-layer.ts",
                "@/components/common/Badge/index",
            ),
        ).toBe(true)
    })

    it("R1: util から lib への import を違反にする（要件 1.3）", () => {
        expect(
            has("layer", "src/util/bad-util.ts", "@/lib/timeline/shape"),
        ).toBe(true)
    })

    it("R2: lib の react・react-easy-crop の import（型だけを含む）を違反にする（要件 2.1・5.1）", () => {
        expect(has("uiInLib", "src/lib/timeline/ui.ts", "react")).toBe(true)
        expect(
            has("uiInLib", "src/lib/timeline/ui.ts", "react-easy-crop"),
        ).toBe(true)
    })

    it("R2: components の react の import は違反にしない", () => {
        expect(
            violations.some(
                v => v.from === "src/components/common/Badge/index.tsx",
            ),
        ).toBe(false)
    })

    it("R4a: 領域をまたぐ相対 import を違反にする（要件 4.1）", () => {
        expect(
            has(
                "crossRegionRelative",
                "src/lib/entry/cross.ts",
                "../timeline/shape",
            ),
        ).toBe(true)
    })

    it("R4a: 同じ領域内の相対 import は違反にしない（要件 4.2）", () => {
        expect(violations.some(v => v.from === "src/lib/entry/same.ts")).toBe(
            false,
        )
    })

    it("R4b: ../ が 3 段以上の import を違反にする（要件 4.3）", () => {
        expect(
            has(
                "relativeDepth",
                "src/lib/entry/deep/x.ts",
                "../../../util/time",
            ),
        ).toBe(true)
    })

    it("R4c: .js 付きの import を違反にする（要件 4.4）", () => {
        expect(
            has(
                "jsExtension",
                "src/lib/entry/js-ext.ts",
                "@/lib/timeline/shape.js",
            ),
        ).toBe(true)
    })

    it("違反のない import（clean）は違反にしない", () => {
        expect(violations.some(v => v.from === "src/lib/clean/ok.ts")).toBe(
            false,
        )
    })

    it("R3: 型だけの循環を両方向とも違反にする（要件 3.1・5.1）", () => {
        const cycles = findCycleViolations(scanModules(violationsRoot))
        expect(cycles.map(v => v.from).sort()).toEqual([
            "src/lib/cyc/a.ts",
            "src/lib/cyc/b.ts",
        ])
        expect(cycles.every(v => v.ruleId === "cycle")).toBe(true)
    })
})

describe("許容リスト（allowlist）", () => {
    const viol = (
        ruleId:
            | "layer"
            | "uiInLib"
            | "cycle"
            | "crossRegionRelative"
            | "relativeDepth"
            | "jsExtension",
        from: string,
        specifier: string,
    ) => ({
        ruleId,
        from,
        specifier,
        message: "m",
    })
    const entry = (
        ruleId: string,
        from: string,
        specifier: string,
        owner = "src-cycles",
    ) => ({
        ruleId: ruleId as "cycle",
        from,
        specifier,
        owner,
        reason: "テスト用の理由",
    })
    const tmpFile = (content: string) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-rules-"))
        const file = path.join(dir, "allowlist.json")
        fs.writeFileSync(file, content)
        return file
    }
    const ownerExists = (owner: string) =>
        owner === "src-cycles" || owner === "src-import-style"

    it("許容された違反は失敗にせず、件数だけを数える（要件 6.1）", () => {
        const result = checkAllowlist(
            [viol("cycle", "src/a.ts", "./b")],
            [entry("cycle", "src/a.ts", "./b")],
        )
        expect(result.unlisted).toEqual([])
        expect(result.listedCount).toBe(1)
    })

    it("許容されていない違反は unlisted に入る（要件 6.2）", () => {
        const result = checkAllowlist([viol("cycle", "src/a.ts", "./b")], [])
        expect(result.unlisted).toHaveLength(1)
    })

    it("違反が消えた許容の項目は stale に入る（要件 6.4）", () => {
        const result = checkAllowlist([], [entry("cycle", "src/a.ts", "./b")])
        expect(result.stale).toHaveLength(1)
        expect(result.unlisted).toEqual([])
    })

    it("壊れた JSON・重複キー・未知の規則・存在しない owner はエラーになる（要件 6.3）", () => {
        expect(
            loadAllowlist(tmpFile("{ broken"), ownerExists).errors.length,
        ).toBeGreaterThan(0)
        const dup = JSON.stringify({
            version: 1,
            entries: [
                entry("cycle", "src/a.ts", "./b"),
                entry("cycle", "src/a.ts", "./b"),
            ],
        })
        expect(
            loadAllowlist(tmpFile(dup), ownerExists).errors.length,
        ).toBeGreaterThan(0)
        const unknown = JSON.stringify({
            version: 1,
            entries: [entry("nope", "src/a.ts", "./b")],
        })
        expect(
            loadAllowlist(tmpFile(unknown), ownerExists).errors.length,
        ).toBeGreaterThan(0)
        const noOwner = JSON.stringify({
            version: 1,
            entries: [entry("cycle", "src/a.ts", "./b", "no-such-spec")],
        })
        expect(
            loadAllowlist(tmpFile(noOwner), ownerExists).errors.length,
        ).toBeGreaterThan(0)
    })

    it("reason が欠落・空・空白だけの項目は読み込みエラーになり、entries に入らない（要件 4.1・4.2）", () => {
        const missing = {
            ruleId: "cycle",
            from: "src/a.ts",
            specifier: "./b",
            owner: "src-cycles",
        }
        const empty = { ...missing, reason: "" }
        const blank = { ...missing, reason: "   " }
        for (const bad of [missing, empty, blank]) {
            const loaded = loadAllowlist(
                tmpFile(JSON.stringify({ version: 1, entries: [bad] })),
                ownerExists,
            )
            expect(loaded.errors).toHaveLength(1)
            expect(loaded.errors[0]).toMatch(/reason/)
            expect(loaded.entries).toEqual([])
        }
    })

    it("正しい項目は errors が空になり、entries を返す", () => {
        const ok = JSON.stringify({
            version: 1,
            entries: [entry("cycle", "src/a.ts", "./b")],
        })
        const loaded = loadAllowlist(tmpFile(ok), ownerExists)
        expect(loaded.errors).toEqual([])
        expect(loaded.entries).toHaveLength(1)
    })

    it("下書きは規則ごとの既定の所有 spec を付け、そのまま照合すると違反も stale も 0 件になる（要件 6.3・7.1）", () => {
        const violations = [
            viol("cycle", "src/a.ts", "./b"),
            viol(
                "crossRegionRelative",
                "src/lib/entry/cross.ts",
                "../timeline/shape",
            ),
        ]
        const draft = emitAllowlist(violations)
        expect(draft.entries.every(e => e.reason === "")).toBe(true)
        expect(draft.entries.map(e => e.owner).sort()).toEqual([
            "src-cycles",
            "src-import-style",
        ])
        const result = checkAllowlist(violations, draft.entries)
        expect(result.unlisted).toEqual([])
        expect(result.stale).toEqual([])
    })
})

describe("CLI（check-imports）", () => {
    const ownerExists = (owner: string) => owner.startsWith("src-")
    const writeAllowlist = (entries: unknown[]) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-cli-"))
        const file = path.join(dir, "import-allowlist.json")
        fs.writeFileSync(file, JSON.stringify({ version: 1, entries }))
        return file
    }

    it("許容リストが無い場合、終了コードは 1 になる（要件 7.2）", () => {
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: path.join(
                os.tmpdir(),
                "does-not-exist-allowlist.json",
            ),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(1)
    })

    it("許容されていない違反があると終了コード 1 になり、違反を 1 行ずつ示す（要件 7.2）", () => {
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist([]),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(1)
        expect(
            result.lines.some(line => line.includes("src/lib/cyc/a.ts")),
        ).toBe(true)
    })

    // 下書きの reason は空で出るため、読み込む前に理由を埋める（要件 4.3）
    const fillReasons = (entries: { reason: string }[]) =>
        entries.map(e => ({ ...e, reason: "テスト用の理由" }))

    it("--emit-allowlist の下書きは reason が空で、理由を埋めれば違反も stale も 0 件で終了コード 0 になる（要件 4.3・6.1・7.1）", () => {
        const draft = runImportCheck({
            root: violationsRoot,
            allowlistPath: "",
            emit: true,
            ownerExists,
        })
        expect(draft.exitCode).toBe(0)
        const parsed = JSON.parse(draft.lines.join("\n")) as {
            entries: { reason: string }[]
        }
        expect(parsed.entries.every(e => e.reason === "")).toBe(true)
        const unfilled = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(parsed.entries),
            emit: false,
            ownerExists,
        })
        expect(unfilled.exitCode).toBe(1)
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(fillReasons(parsed.entries)),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(0)
        expect(result.lines.some(line => line.startsWith("警告"))).toBe(false)
    })

    it("理由が欠落・空の許容リストは読み込みエラーとなり、終了コード 1 になる（要件 4.2）", () => {
        const draft = runImportCheck({
            root: violationsRoot,
            allowlistPath: "",
            emit: true,
            ownerExists,
        })
        const parsed = JSON.parse(draft.lines.join("\n")) as {
            entries: { reason: string }[]
        }
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(fillReasons(parsed.entries)),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(0)
        const missing = parsed.entries.map(
            ({ reason: _reason, ...rest }) => rest,
        )
        const negative = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(missing),
            emit: false,
            ownerExists,
        })
        expect(negative.exitCode).toBe(1)
        expect(
            negative.lines.some(
                line => line.startsWith("エラー") && line.includes("reason"),
            ),
        ).toBe(true)
    })

    it("消えた許容の項目は警告として示し、終了コードは 0 のままになる（要件 6.4）", () => {
        const extra = {
            ruleId: "cycle",
            from: "src/lib/gone.ts",
            specifier: "./x",
            owner: "src-cycles",
            reason: "テスト用の理由",
        }
        const draft = runImportCheck({
            root: violationsRoot,
            allowlistPath: "",
            emit: true,
            ownerExists,
        })
        const parsed = JSON.parse(draft.lines.join("\n")) as {
            entries: { reason: string }[]
        }
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist([
                ...fillReasons(parsed.entries),
                extra,
            ]),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(0)
        expect(
            result.lines.some(
                line =>
                    line.startsWith("警告") && line.includes("src/lib/gone.ts"),
            ),
        ).toBe(true)
    })

    it("許容リストにエラーがあると終了コードは 1 になる（要件 6.3）", () => {
        // reason は埋めておき、失敗の原因を owner の検査の経路だけに絞る
        const bad = {
            ruleId: "cycle",
            from: "src/a.ts",
            specifier: "./b",
            owner: "no-such-spec",
            reason: "テスト用の理由",
        }
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist([bad]),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(1)
        // 終了コード 1 は未許容の違反でも起きるため、owner のエラー行が出ていることも確かめる
        expect(
            result.lines.some(
                line =>
                    line.startsWith("エラー") &&
                    line.includes("所有 spec no-such-spec"),
            ),
        ).toBe(true)
        expect(result.lines.some(line => line.includes("reason"))).toBe(false)
    })
})

describe("想定の構成からの独立（要件 10）", () => {
    const arbitraryRoot = path.resolve(
        __dirname,
        "../../fixtures/import-rules/arbitrary",
    )

    it("任意の名前と配置のフォルダだけの木で、違反が 0 件になる（要件 10.2）", () => {
        const graph = scanModules(arbitraryRoot)
        expect(evaluateImportRules(graph)).toEqual([])
        expect(findCycleViolations(graph)).toEqual([])
    })

    it("すべての規則に、根拠となる steering の節が紐づいている（要件 10.1）", () => {
        for (const id of RULE_IDS) {
            expect(RULE_BASIS[id]).toMatch(/structure\.md/)
        }
    })
})

describe("層の逆流の規則（libLayer）", () => {
    // 基盤 → 業務の辺だけを違反にする。fixture の各辺の層は対応表（libLayers.ts）に従う
    const libLayerRoot = path.resolve(
        __dirname,
        "../../fixtures/import-rules/lib-layers",
    )
    const libLayerViolations = evaluateImportRules(scanModules(libLayerRoot))
        .filter(v => v.ruleId === "libLayer")
        .map(v => [v.from, v.specifier])

    it("基盤 → 業務の import を違反にする（要件 2.1・3.1）", () => {
        expect(libLayerViolations).toContainEqual([
            "src/lib/api/bad.ts",
            "@/lib/feedback/y",
        ])
        expect(libLayerViolations).toContainEqual([
            "src/lib/site/bad-guest.ts",
            "@/lib/guestMode",
        ])
    })

    it("業務 → 基盤・基盤どうし・業務どうしは違反にしない（要件 2.2）", () => {
        // 違反は上の 2 件だけで、正例（業務 → 基盤、基盤 → 基盤、業務 → 業務）は含まれない
        expect(libLayerViolations).toHaveLength(2)
        expect(
            libLayerViolations.some(
                ([from]) => from === "src/lib/session/x.ts",
            ),
        ).toBe(false)
        expect(
            libLayerViolations.some(([from]) => from === "src/lib/entry/x.ts"),
        ).toBe(false)
        expect(
            libLayerViolations.some(([from]) => from === "src/lib/entry/z.ts"),
        ).toBe(false)
    })

    it("guestMode.ts は業務として扱い、業務の import（timeline）を違反にしない（要件 1.1・2.2）", () => {
        expect(
            libLayerViolations.some(
                ([from]) => from === "src/lib/guestMode.ts",
            ),
        ).toBe(false)
    })

    it("基盤から guestMode.ts（業務）を import すると違反にする（要件 1.1・2.1）", () => {
        expect(
            libLayerViolations.some(
                ([from, spec]) =>
                    from === "src/lib/site/bad-guest.ts" &&
                    spec === "@/lib/guestMode",
            ),
        ).toBe(true)
    })
})
