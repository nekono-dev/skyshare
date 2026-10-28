/**
 * 起動時の判定（SurveyLaunchCheck）。ページの除外と、端末の記録からサーバーへの確認までの手順で、聞くか聞かないかを決める。
 *
 * 責務と処理概要:
 * - プライバシーポリシーのページ（末尾のスラッシュの有無を問わない）と、ゲスト表示の印があるページは判定しない。
 * - 端末の記録にアカウントがあれば通信せず何もしない。
 * - 記録にアカウントが無くて端末が回答済みなら、サーバーへ回答済みとして登録し、成功したらアカウントを記録に加える。
 * - 記録にも端末の回答済みにも無ければ、サーバーに回答済みかを確認する。回答済みなら記録し、未回答と明示されたときだけ「聞く」を返す。
 * - 終了または無い・失敗・想定外の例外のときは、記録を変えずに何もしない（次の起動で再度判定される）。
 * - アンケートの内容や表示には触れない。React・D1には依存しない。
 */
import type { SurveyApi } from "@/lib/survey/client"
import { readDeviceRecord, rememberAnswered } from "@/lib/survey/deviceRecord"
import { GUEST_MODE_QUERY_KEY } from "@/lib/guestMode"

/** 判定の結果。`ask` は回答必須のダイアログを出すこと */
export type LaunchOutcome = "none" | "ask"

/** プライバシーポリシーのページのパス（末尾のスラッシュは除いて比べる） */
const privacyPagePath = "/privacy"

/**
 * 起動時の判定を行う。例外は投げず、失敗のときは `none` を返す。
 *
 * Input:
 * - `surveyId`: 開催中のアンケートの識別子
 * - `did`: アクティブなアカウントの識別子（空でないこと）
 * - `api`: 回答済みの確認と登録の呼び出し口
 * - `storage`: 端末の記録の保存先。省略時はlocalStorage
 *
 * Output:
 * - `ask`: サーバーが未回答と明示したときだけ
 * - `none`: それ以外（記録にあり・端末が回答済み・回答済み・終了・失敗・例外）
 *
 * 例: 記録にdidがあれば`none`を返し、`api`は呼ばない。
 */
export const decideLaunch = async (input: {
    surveyId: string
    did: string
    api: Pick<SurveyApi, "checkAnswered" | "registerAnswered">
    storage?: Storage
}): Promise<LaunchOutcome> => {
    const { surveyId, did, api, storage } = input
    try {
        const record = readDeviceRecord(surveyId, storage)
        // 記録にあるアカウントは回答済みとして扱い、通信しない
        if (record.dids.includes(did)) return "none"

        // 端末が回答済みなら、サーバーへ回答済みとして登録する
        if (record.answered) {
            const registered = await api.registerAnswered(surveyId)
            if (registered === "registered") {
                rememberAnswered(surveyId, did, storage)
            }
            return "none"
        }

        // 端末が未回答の記録なら、サーバーに回答済みかを確認する
        const checked = await api.checkAnswered(surveyId)
        if (checked === "answered") {
            rememberAnswered(surveyId, did, storage)
            return "none"
        }
        // 未回答と明示されたときだけ聞く
        return checked === "unanswered" ? "ask" : "none"
    } catch {
        // 想定外の例外でも、利用者の操作を妨げずに何もしない
        return "none"
    }
}

/**
 * 現在のページでアンケートの判定を行わないかを決める。
 *
 * Input:
 * - `pathname`: 現在のパス（例: `/privacy/`）
 * - `search`: 現在のクエリ文字列（例: `?guest=1`）
 *
 * Output:
 * - プライバシーポリシーのページ、またはゲスト表示の印があるときは true
 *
 * 例: `isSurveyPageExcluded("/privacy", "")` は true。`isSurveyPageExcluded("/", "?guest=1")` は true。
 */
export const isSurveyPageExcluded = (
    pathname: string,
    search: string,
): boolean => {
    const normalized = pathname.replace(/\/+$/, "")
    if (normalized === privacyPagePath) return true
    return new URLSearchParams(search).has(GUEST_MODE_QUERY_KEY)
}
