/**
 * Issue の件名・本文・ラベルの組み立ての検証。
 *
 * 責務と処理概要:
 * - 種別ごとのラベルと節、報告者と環境の情報の記載、利用者の入力の無害化、
 *   画面とサーバーのビルドの差の記載を検証する。
 */
import { describe, expect, it } from "vitest"
import {
    buildIssue,
    fencedBlock,
    inlineValue,
} from "@/lib/feedback/issueContent"
import type { RequestBodyType } from "@/lib/api/schema/v2/feedback/post"

const COMMIT = "0123456789abcdef0123456789abcdef01234567"
const reporter = { did: "did:plc:reporter", handle: "alice.bsky.social" }
const build = { version: "2.0.0", commit: COMMIT, repository: "owner/repo" }
const environment = {
    os: "iOS 18.1",
    browser: "Safari 18.1",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)",
    standalone: true,
    version: "2.0.0",
    commit: COMMIT,
}
const bug: RequestBodyType = {
    kind: "bug",
    title: "画像が\n送れない",
    steps: "画像を選んで送信した",
    reproducibility: "always",
    environment,
}
const enhancement: RequestBodyType = {
    kind: "enhancement",
    title: "下書きの並べ替え",
    description: "下書きを日付で並べ替えたい",
    environment,
}

describe("buildIssue", () => {
    it("[feedback-api/3.1,3.2] 不具合に bug、提案に enhancement のラベルが付き、件名の改行が空白になる", () => {
        const bugIssue = buildIssue(bug, reporter, build)
        expect(bugIssue.labels).toEqual(["bug"])
        expect(bugIssue.title).toBe("画像が 送れない")
        expect(buildIssue(enhancement, reporter, build).labels).toEqual([
            "enhancement",
        ])
    })

    it("[feedback-api/3.3] 本文に入力・ハンドル・DID・版・コミット・OS・ブラウザ・起動の形態・識別文字列が含まれる", () => {
        const { body } = buildIssue(bug, reporter, build)
        for (const text of [
            "画像を選んで送信した",
            "毎回起きる",
            "`@alice.bsky.social`",
            "[did:plc:reporter](https://bsky.app/profile/did:plc:reporter)",
            "`2.0.0`",
            `[0123456](https://github.com/owner/repo/commit/${COMMIT})`,
            "`iOS 18.1`",
            "`Safari 18.1`",
            "PWA（ホーム画面から起動）: はい",
            "`Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)`",
        ]) {
            expect(body).toContain(text)
        }
    })

    it("[feedback-api/2.3,2.4] 技術的な補足を省いた提案は、補足の見出しを載せない", () => {
        expect(buildIssue(enhancement, reporter, build).body).not.toContain(
            "技術的な補足",
        )
        const withNotes = buildIssue(
            { ...enhancement, technicalNotes: "IndexedDB で保持する" },
            reporter,
            build,
        )
        expect(withNotes.body).toContain("### 技術的な補足")
        expect(withNotes.body).toContain("IndexedDB で保持する")
    })

    it("[feedback-api/3.5] 画面のコミットがサーバーと異なるときだけ、画面のコミットを並べる", () => {
        expect(buildIssue(bug, reporter, build).body).not.toContain(
            "画面のコミット",
        )
        const stale = buildIssue(
            {
                ...bug,
                environment: { ...environment, commit: "f".repeat(40) },
            },
            reporter,
            build,
        )
        expect(stale.body).toContain(`- 画面のコミット: \`${"f".repeat(40)}\``)
    })

    it("サーバーのコミットが不明なら「不明」と載せる", () => {
        const { body } = buildIssue(
            { ...bug, environment: { ...environment, commit: "" } },
            reporter,
            { ...build, commit: null },
        )
        expect(body).toContain("- コミット: 不明")
        expect(body).not.toContain("画面のコミット")
    })
})

describe("fencedBlock / inlineValue", () => {
    it("[feedback-api/3.4] バッククォートとメンションと HTML を含む入力が、閉じられないコードブロックの中に載る", () => {
        const input = "@octocat ```\n<img src=x onerror=alert(1)>\n````"
        const block = fencedBlock(input)
        const lines = block.split("\n")
        // 囲いは入力の最長の連続（4つ）より長い
        expect(lines[0]).toBe("`````text")
        expect(lines.at(-1)).toBe("`````")
        // 入力の中に、囲いを閉じる行がない
        const inner = lines.slice(1, -1)
        expect(inner.some(line => line.startsWith("`````"))).toBe(false)
        expect(inner.join("\n")).toBe(input)

        const { body } = buildIssue({ ...bug, steps: input }, reporter, build)
        expect(body).toContain(block)
    })

    it("インラインコードはバッククォートと改行を除き、空なら「不明」とする", () => {
        expect(inlineValue("a`b\nc")).toBe("`abc`")
        expect(inlineValue("``")).toBe("不明")
    })
})
