/**
 * ビルドの版・コミット・リポジトリの解決の検証。
 *
 * 責務と処理概要:
 * - CI の値の優先、Git の値への切り替え、どちらもないときの不明の扱いを検証する。
 */
import { describe, expect, it } from "vitest"
import { resolveBuildInfo } from "@/lib/site/buildEnv"

const CI_SHA = "a".repeat(40)
const GIT_SHA = "b".repeat(40)

describe("resolveBuildInfo", () => {
    it("[feedback-api/AC-11] CI の値があればその値を、なければ Git の値を、どちらもなければ不明とする", () => {
        expect(
            resolveBuildInfo(
                {
                    PUBLIC_VERSION: "2.0.0",
                    GITHUB_SHA: CI_SHA,
                    GITHUB_REPOSITORY: "ci-owner/ci-repo",
                },
                {
                    sha: GIT_SHA,
                    remoteUrl: "git@github.com:git-owner/git-repo.git",
                },
            ),
        ).toEqual({
            version: "2.0.0",
            commit: CI_SHA,
            repository: "ci-owner/ci-repo",
        })

        expect(
            resolveBuildInfo(
                {},
                {
                    sha: `${GIT_SHA}\n`,
                    remoteUrl: "https://github.com/git-owner/git-repo.git",
                },
            ),
        ).toEqual({
            version: "unknown",
            commit: GIT_SHA,
            repository: "git-owner/git-repo",
        })

        expect(resolveBuildInfo({}, {})).toEqual({
            version: "unknown",
            commit: null,
            repository: null,
        })
    })

    it("形式の違う値と GitHub 以外のリモートは使わない", () => {
        expect(
            resolveBuildInfo(
                { GITHUB_SHA: "abc", GITHUB_REPOSITORY: "no-slash" },
                { sha: "xyz", remoteUrl: "https://gitlab.com/a/b.git" },
            ),
        ).toEqual({ version: "unknown", commit: null, repository: null })
    })

    it("認証情報つきの HTTPS のリモートからリポジトリを取り出す", () => {
        expect(
            resolveBuildInfo(
                {},
                { remoteUrl: "https://token@github.com/owner/repo" },
            ).repository,
        ).toBe("owner/repo")
    })
})
