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

describe("deploy workflow survey environment", () => {
    const code = stripComments(deploy)
    const guard = job(code, "survey-config-guard")
    const deployJob = job(code, "deploy")

    it("keeps the existing deployment triggers, concurrency and workflow permissions", () => {
        expect(code).toContain('branches: ["release/**", develop]')
        expect(code).toContain(
            "group: deploy-${{ github.ref_name == 'develop' && 'develop' || 'production' }}",
        )
        expect(code).toContain("cancel-in-progress: false")
        expect(code).toContain("permissions:\n  contents: read")
        expect(deployJob).toContain(
            "if: startsWith(github.ref, 'refs/heads/release/') || github.ref == 'refs/heads/develop'",
        )
    })

    it("selects the matching environment and waits for verify, E2E and the guard", () => {
        expect(deployJob).toContain("needs: [verify, e2e, survey-config-guard]")
        expect(deployJob).toContain(
            "environment: ${{ github.ref_name == 'develop' && 'develop' || 'production' }}",
        )
        expect(job(code, "verify")).not.toContain("environment:")
        expect(job(code, "e2e")).not.toContain("environment:")
    })

    it("rejects shared config in an environment-free, permission-free guard", () => {
        expect(guard).toContain(
            "if: startsWith(github.ref, 'refs/heads/release/') || github.ref == 'refs/heads/develop'",
        )
        expect(guard).toContain("timeout-minutes: 5")
        expect(guard).toContain("permissions: {}")
        expect(guard).not.toContain("environment:")
        expect(guard).toContain("if: ${{ vars.SURVEY_CONFIG != '' }}")
        expect(guard).toContain(`echo '${guardError}'`)
        expect(guard).toContain("exit 1")
    })

    it("passes the environment value only to the build and never to verification or E2E", () => {
        const buildStart = deployJob.indexOf("      - name: Run build\n")
        const buildTail = buildStart < 0 ? "" : deployJob.slice(buildStart)
        const nextStep = buildTail.slice(1).search(/^ {6}- /m)
        const buildStep =
            buildStart < 0
                ? ""
                : nextStep < 0
                  ? buildTail
                  : buildTail.slice(0, nextStep + 1)
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
