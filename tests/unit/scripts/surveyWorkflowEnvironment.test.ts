/**
 * ワークフローの環境選択と共有設定の門番を文字列で検査する。
 *
 * - YAML の解析依存を増やさず、配備条件と設定値の参照範囲を保つ。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const deploy = readFileSync(
    path.join(repoRoot, ".github/workflows/deploy.yaml"),
    "utf8",
)
const preview = readFileSync(
    path.join(repoRoot, ".github/workflows/preview.yaml"),
    "utf8",
)

const stripComments = (source: string): string =>
    source
        .split("\n")
        .map(line => line.replace(/\s+#.*$/, ""))
        .filter(line => !line.trimStart().startsWith("#"))
        .join("\n")

const job = (source: string, name: string): string => {
    const jobs = source.slice(source.indexOf("jobs:\n"))
    const start = jobs.indexOf(`  ${name}:\n`)
    if (start < 0) return ""
    const tail = jobs.slice(start + 2)
    const nextJob = tail.search(/^  [\w-]+:\s*$/m)
    return nextJob < 0 ? tail : tail.slice(0, nextJob)
}

const guardError =
    "error: shared-config: リポジトリ（または組織）の変数 SURVEY_CONFIG が残っています。削除してください（DEVELOP.md 6.2.1）"

const step = (source: string, name: string): string => {
    const start = source.indexOf(`      - name: ${name}\n`)
    if (start < 0) return ""
    const tail = source.slice(start)
    const nextStep = tail.slice(1).search(/^ {6}- /m)
    return nextStep < 0 ? tail : tail.slice(0, nextStep + 1)
}

describe("deploy workflow survey environment", () => {
    const code = stripComments(deploy)
    const resolveJob = job(code, "resolve")
    const resolveStep = step(resolveJob, "Resolve target")
    const guard = job(code, "survey-config-guard")
    const deployJob = job(code, "deploy")

    it("keeps the existing deployment triggers, concurrency and workflow permissions", () => {
        expect(code).toContain('branches: ["release/**", develop]')
        expect(code).toContain(
            "group: deploy-${{ needs.resolve.outputs.target }}",
        )
        expect(code).toContain("cancel-in-progress: false")
        expect(code).toContain("permissions:\n  contents: read")
        expect(deployJob).toContain("if: needs.resolve.outputs.target != ''")
    })

    it("selects the matching environment and waits for verify, E2E and the guard", () => {
        expect(deployJob).toContain(
            "needs: [resolve, verify, e2e, survey-config-guard]",
        )
        expect(deployJob).toContain(
            "environment: ${{ needs.resolve.outputs.target }}",
        )
        expect(job(code, "verify")).not.toContain("environment:")
        expect(job(code, "e2e")).not.toContain("environment:")
    })

    it("maps release and develop branches to their deployment targets", () => {
        expect(resolveStep).toContain(
            "grep -Eq '^release/.*$'; then target=production",
        )
        expect(resolveStep).toContain(
            "grep -Eq '^develop$'; then target=develop",
        )
        expect(resolveStep).toContain('          target=""')
    })

    it("makes the guard depend on resolve", () => {
        expect(guard).toContain("needs: [resolve]")
    })

    it("rejects shared config in an environment-free, permission-free guard", () => {
        expect(guard).toContain("if: needs.resolve.outputs.target != ''")
        expect(guard).toContain("timeout-minutes: 5")
        expect(guard).toContain("permissions: {}")
        expect(guard).not.toContain("environment:")
        expect(guard).toContain("if: ${{ vars.SURVEY_CONFIG != '' }}")
        expect(guard).toContain(`echo '${guardError}'`)
        expect(guard).toContain("exit 1")
    })

    it("passes the environment value only to the build and never to verification or E2E", () => {
        const buildStep = step(deployJob, "Run build")
        const workflowOutsideBuildAndGuardCondition = code
            .replace(buildStep, "")
            .replace("if: ${{ vars.SURVEY_CONFIG != '' }}", "")
        const guardWithoutCondition = guard.replace(
            "if: ${{ vars.SURVEY_CONFIG != '' }}",
            "",
        )
        expect(buildStep).toContain("SURVEY_CONFIG: ${{ vars.SURVEY_CONFIG }}")
        expect(workflowOutsideBuildAndGuardCondition).not.toContain(
            "vars.SURVEY_CONFIG",
        )
        expect(guardWithoutCondition).not.toContain("vars.SURVEY_CONFIG")
        expect(guard).not.toMatch(/\benv:\s*\n(?:\s+\S.*\n)*\s+SURVEY_CONFIG:/)
        expect(job(code, "verify")).not.toContain("SURVEY_CONFIG")
        expect(job(code, "e2e")).not.toContain("SURVEY_CONFIG")
    })
})

describe("preview workflow survey environment", () => {
    const code = stripComments(preview)
    const guard = job(code, "survey-config-guard")
    const previewJob = job(code, "preview")

    it("keeps the existing preview trigger, concurrency and workflow permissions", () => {
        expect(code).toContain('branches: ["dev/**"]')
        expect(code).toContain("group: preview-${{ github.ref }}")
        expect(code).toContain("cancel-in-progress: true")
        expect(code).toContain("permissions:\n  contents: read")
        expect(previewJob).not.toMatch(/^    if:/m)
        expect(guard).not.toMatch(/^    if:/m)
        expect(previewJob).toContain("if: steps.alias.outputs.valid == 'true'")
    })

    it("selects develop and waits for the environment-free guard", () => {
        expect(previewJob).toContain("needs: [survey-config-guard]")
        expect(previewJob).toContain("environment: develop")
        expect(guard).not.toContain("environment:")
    })

    it("rejects shared config with no permissions, a five minute limit and the fixed failure", () => {
        expect(guard).toContain("timeout-minutes: 5")
        expect(guard).toContain("permissions: {}")
        expect(guard).toContain("if: ${{ vars.SURVEY_CONFIG != '' }}")
        expect(guard).toContain(`echo '${guardError}'`)
        expect(guard).toContain("exit 1")
    })

    it("passes SURVEY_CONFIG only to Run build and keeps it out of the guard shell", () => {
        const buildStep = step(previewJob, "Run build")
        const outsideBuildAndGuardCondition = code
            .replace(buildStep, "")
            .replace("if: ${{ vars.SURVEY_CONFIG != '' }}", "")
        const guardWithoutCondition = guard.replace(
            "if: ${{ vars.SURVEY_CONFIG != '' }}",
            "",
        )
        expect(buildStep).toContain("SURVEY_CONFIG: ${{ vars.SURVEY_CONFIG }}")
        expect(outsideBuildAndGuardCondition).not.toContain(
            "vars.SURVEY_CONFIG",
        )
        expect(guardWithoutCondition).not.toContain("vars.SURVEY_CONFIG")
        expect(guard).not.toMatch(/\benv:\s*\n(?:\s+\S.*\n)*\s+SURVEY_CONFIG:/)
    })
})
