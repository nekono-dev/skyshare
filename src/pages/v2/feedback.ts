/**
 * Skyshare v2 feedback API（不具合の報告と機能の提案の受付）。
 *
 * 責務と処理概要:
 * - POST: ログイン中の利用者の報告か提案を検証し、報告者と環境の情報を添えて、
 *   ソースコードのリポジトリに GitHub の Issue として登録する。
 * - 報告者の DID とハンドルはログインのセッション（`locals.session`）からだけ取る。
 * - 入力不正は 400、未認証は 401、同じアカウントからの60秒以内の再送信は 429、
 *   認証情報かリポジトリが未設定なら 503、GitHub の登録の失敗は 500 を返す。
 *
 * 実装上の制約:
 * - `@atproto/*` を読み込まない（無料枠の CPU 時間を守るため）。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus } from "@/lib/api/response.js"
import * as PostSchema from "@/lib/api/schema/v2/feedback/post"
import { getFeedbackEnv } from "@/lib/feedback/env"
import { createGithubIssue } from "@/lib/feedback/githubIssue"
import { buildIssue } from "@/lib/feedback/issueContent"
import { buildInfo } from "@/lib/site/buildInfo"
import { convertHeaderToObj } from "@/util/http"

/**
 * リクエストの本文を JSON として読む。
 *
 * Output:
 * - 読めた値。JSON として壊れていれば undefined（呼び出し側で 400 にする）
 */
const readJson = async (request: Request): Promise<unknown> => {
    try {
        return await request.json()
    } catch {
        return undefined
    }
}

/**
 * POST /v2/feedback — 報告か提案を Issue として登録する。
 *
 * 検証の順序: 見出し → セッション → 入力 → 認証情報とリポジトリ → 回数の制限 → 登録
 * （回数の制限は入力の検証の後に照会し、誤った入力で回数を消費させない）。
 *
 * Input:
 * - `request`: cookie と JSON の本文（`PostSchema.RequestBodySchema`）を含む HTTP リクエスト
 * - `locals.session`: 認証ミドルウェアが供給するセッション
 *
 * Output:
 * - 200: `{ number, url }`（作成した Issue）
 * - 4xx/5xx: 共通エラー JSON
 *
 * 例:
 * - 入力: `{ "kind": "bug", "title": "画像が送れない", "steps": "...", "reproducibility": "always", "environment": {...} }`
 * - 出力: `{"number":12,"url":"https://github.com/owner/repo/issues/12"}`
 */
export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const head = PostSchema.RequestHeaderSchema.safeParse(
            convertHeaderToObj(request.headers),
        )
        if (!head.success) return errorResponseFromStatus(400)

        const { session } = locals
        if (!session) return errorResponseFromStatus(401)

        const body = PostSchema.RequestBodySchema.safeParse(
            await readJson(request),
        )
        if (!body.success) return errorResponseFromStatus(400)

        const env = await getFeedbackEnv()
        const token = env.FEEDBACK_GITHUB_TOKEN
        const { repository } = buildInfo
        if (!token || !repository) {
            console.error("feedback POST: not configured", {
                token: Boolean(token),
                repository: Boolean(repository),
            })
            return errorResponseFromStatus(503)
        }

        const { success } = await env.FEEDBACK_RATE_LIMITER.limit({
            key: session.did,
        })
        if (!success) return errorResponseFromStatus(429)

        const issue = buildIssue(
            body.data,
            { did: session.did, handle: session.handle },
            {
                version: buildInfo.version,
                commit: buildInfo.commit,
                repository,
            },
        )
        const created = await createGithubIssue({ token, repository, issue })
        if (!created) return errorResponseFromStatus(500)

        const res: PostSchema.ResponseBody200Type = created
        return new Response(JSON.stringify(res), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "cache-control": "no-store",
            },
        })
    } catch (err) {
        console.error("feedback POST: unexpected error", err)
        return errorResponseFromStatus(500)
    }
}
