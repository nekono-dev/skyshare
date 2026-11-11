/**
 * 起動時に端末記録とサーバー状態からアンケートを尋ねるか判定する。
 *
 * - プライバシーポリシー（末尾スラッシュを問わない）とゲスト表示では判定しない。
 * - 端末に記録されたアカウントは通信せず抑止し、端末回答済みはサーバー登録成功後にアカウント記録へ加える。
 * - 確認失敗時は回答済みと断定せず、手動で開ける入口を表示する。
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
 * - `ask`: 未回答、または回答済みを確認できなかったとき
 * - `none`: 回答済みの記録・確認、または終了したとき
 *
 * 例: 記録にdidがあれば`none`を返し、`api`は呼ばない。
 * 端末にも回答済み記録がない場合は、サーバーが未回答を明示したときだけ `ask` にする。
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
            try {
                const registered = await api.registerAnswered(surveyId)
                if (registered === "registered")
                    rememberAnswered(surveyId, did, storage)
            } catch {
                // この端末で回答済みのため入口は再表示しない。
            }
            return "none"
        }

        // 端末が未回答の記録なら、サーバーに回答済みかを確認する
        const checked = await api.checkAnswered(surveyId)
        if (checked === "answered") {
            rememberAnswered(surveyId, did, storage)
            return "none"
        }
        // 回答済みと確認できなければ、手動で開ける入口を残す。
        return checked === "gone" ? "none" : "ask"
    } catch {
        // 通信などが失敗しても、自動表示はせず入口だけを残す。
        return "ask"
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
