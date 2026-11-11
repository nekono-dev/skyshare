/**
 * Skyshare v2 feedback API（不具合の報告と機能の提案の受付）。ログイン中の利用者の報告か提案を検証し、送信の判定（`submitFeedback`）の結果を HTTP の応答に変換する。
 *
 * - 報告者の DID とハンドルは、ログインのセッション（`locals.session`）からだけ取る。
 * - `@atproto/*` を読み込まない（無料枠の CPU 時間を守るため）。
 * - 環境の値（認証情報・回数の制限の機能）と Issue の組み立てには触れない（`lib/feedback` が担う）。
 */
import type { APIRoute } from "astro"

import { errorResponseFromStatus, jsonResponse } from "@/util/http"
import * as PostSchema from "@/lib/api/schema/v2/feedback/post"
import { submitFeedback } from "@/lib/feedback/submitFeedback"
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
 * 検証の順序: 見出し → セッション → 入力（この3つはページが行う）
 * → 送信の判定（`submitFeedback`: 認証情報とリポジトリ → 回数の制限 → 登録）。
 * 回数の制限は入力の検証の後に照会し、誤った入力で回数を消費させない。
 *
 * Input:
 * - `request`: cookie と JSON の本文（`PostSchema.RequestBodySchema`）を含む HTTP リクエスト
 * - `locals.session`: 認証ミドルウェアが供給するセッション
 *
 * Output:
 * - 200: `{ number, url }`（作成した Issue）
 * - 4xx/5xx: 共通エラー JSON（判定の失敗は `Outcome` の status をそのまま応答にする）
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

        // 判定の失敗は status をそのまま返す: 認証情報かリポジトリが未設定なら 503、
        // 同じアカウントからの 60 秒以内の再送信は 429、GitHub への登録の失敗は 500
        const result = await submitFeedback({
            session,
            submission: body.data,
        })
        if (!result.ok) return errorResponseFromStatus(result.status)

        const res: PostSchema.ResponseBody200Type = result.value
        return jsonResponse(res, {
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
