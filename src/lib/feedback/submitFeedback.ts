/**
 * フィードバックを検査し、GitHub Issue として登録する。
 * - 設定確認、回数制限、登録の順で処理し、HTTP 応答への変換は呼び出し側に委ねる。
 * - アカウント DID を limiter key に使い、`limit: 1`・`period: 60` により 60 秒に 1 件に制限する。
 * - 外部トークンを結果やエラーに含めず、想定外の例外は呼び出し側へ伝える。
 */
import { getFeedbackEnv } from "@/lib/feedback/env"
import { createGithubIssue } from "@/lib/feedback/githubIssue"
import { buildIssue } from "@/lib/feedback/issueContent"
import type { FeedbackSubmission } from "@/lib/api/contract/feedbackSubmission"
import { buildInfo } from "@/lib/site/buildInfo"
import type { Outcome } from "@/types/outcome"

/** 送信を判定する入力。報告者はログインのセッションのアカウントを渡す。 */
export type SubmitFeedbackInput = {
    session: { did: string; handle: string }
    submission: FeedbackSubmission
}

/** 登録した Issue の番号と URL。 */
export type SubmittedFeedback = { number: number; url: string }

/**
 * 報告か提案を、回数の制限を守って GitHub の Issue として登録する。
 *
 * 判定の順序: 設定（認証情報・リポジトリ）→ 回数の制限 → Issue の登録。
 * 入力の検証は呼び出し側（ページ）が済ませている前提とする。
 *
 * Input:
 * - `input.session`: ログインのセッションのアカウント（DID とハンドル）
 * - `input.submission`: 検証済みの送信内容
 *
 * Output:
 * - 成功: `{ ok: true, value: { number, url } }`（作成した Issue）
 * - 503: 認証情報かリポジトリが未設定（設定の欠落はコンソールに記録する。値は記録しない）
 * - 429: 同じアカウントの直近の送信から回数の制限の期間内
 * - 500: GitHub への登録が失敗した
 *
 * 例:
 * - 入力: `{ session: { did, handle }, submission: { kind: "bug", ... } }`
 * - 出力: `{ ok: true, value: { number: 12, url: "https://github.com/owner/repo/issues/12" } }`
 */
export const submitFeedback = async ({
    session,
    submission,
}: SubmitFeedbackInput): Promise<Outcome<SubmittedFeedback>> => {
    const env = await getFeedbackEnv()
    const token = env.FEEDBACK_GITHUB_TOKEN
    const { repository } = buildInfo
    if (!token || !repository) {
        console.error("feedback POST: not configured", {
            token: Boolean(token),
            repository: Boolean(repository),
        })
        return { ok: false, status: 503 }
    }

    const { success } = await env.FEEDBACK_RATE_LIMITER.limit({
        key: session.did,
    })
    if (!success) return { ok: false, status: 429 }

    const issue = buildIssue(
        submission,
        { did: session.did, handle: session.handle },
        {
            version: buildInfo.version,
            commit: buildInfo.commit,
            repository,
        },
    )
    const created = await createGithubIssue({ token, repository, issue })
    if (!created) return { ok: false, status: 500 }

    return {
        ok: true,
        value: { number: created.number, url: created.url },
    }
}
