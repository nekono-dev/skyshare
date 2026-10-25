/**
 * GitHub の REST API で Issue を作成する。
 *
 * 責務と処理概要:
 * - 組み立て済みの件名・本文・ラベルを `POST /repos/{owner}/{repo}/issues` に送り、作成した Issue の番号と URL を返す。
 * - 認証は Issues の読み書きだけを許す Fine-grained PAT（Worker のシークレット `FEEDBACK_GITHUB_TOKEN`）で行う。
 *
 * 実装上の制約:
 * - Cloudflare Workers の `fetch` を使う。GitHub の API は User-Agent の見出しを必須とする。
 */
import type { IssueContent } from "./issueContent"

export type CreatedIssue = { number: number; url: string }

/**
 * Issue を作成する。
 *
 * 想定する入力形状（GitHub の応答の最小要件）:
 * - 201 の本文に `number`（整数）と `html_url`（文字列）がある
 *
 * Input:
 * - `opts.token`: GitHub の認証情報
 * - `opts.repository`: `owner/repo`
 * - `opts.issue`: 件名・本文・ラベル
 * - `fetchFn`: 送信に使う関数（テストで差し替える）
 *
 * Output:
 * - 作成した Issue の番号と URL。201 以外・応答の形式違い・通信の例外は null
 *   （失敗の状態はコンソールに記録する。認証情報は記録しない）
 *
 * 例:
 * - 入力: `({ token, repository: "o/r", issue }, fetch)` → 出力: `{ number: 12, url: "https://github.com/o/r/issues/12" }`
 */
export const createGithubIssue = async (
    opts: { token: string; repository: string; issue: IssueContent },
    fetchFn: typeof fetch = fetch,
): Promise<CreatedIssue | null> => {
    try {
        const res = await fetchFn(
            `https://api.github.com/repos/${opts.repository}/issues`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${opts.token}`,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "skyshare",
                },
                body: JSON.stringify({
                    title: opts.issue.title,
                    body: opts.issue.body,
                    labels: opts.issue.labels,
                }),
            },
        )
        if (res.status !== 201) {
            console.error(
                "createGithubIssue: unexpected status",
                res.status,
                await res.text().catch(() => ""),
            )
            return null
        }
        const data = (await res.json()) as {
            number?: unknown
            html_url?: unknown
        }
        if (
            typeof data.number !== "number" ||
            typeof data.html_url !== "string"
        ) {
            console.error("createGithubIssue: invalid response body")
            return null
        }
        return { number: data.number, url: data.html_url }
    } catch (err) {
        console.error("createGithubIssue: request failed", err)
        return null
    }
}
