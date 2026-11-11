/**
 * APIエラーのHTTPステータスから、利用者向けの文言キーを選ぶ。
 *
 * - API のエラー文字列は言語に依存しないため、画面には表示せずステータスから文言を選ぶ。
 */
import type { PlainMessageKey } from "./translate"

/** 同じステータスでも画面ごとに文言が異なる呼び出しの種別。 */
export type ErrorContext = "login"

/**
 * ステータスと文脈から、エラー文言のキーを返す。
 *
 * 処理の趣旨:
 * - 文脈ごとの個別対応（例: ログインの 409 はアカウント数上限）を先に判定し、
 *   該当しなければステータス別の汎用文言へ落とす。
 *
 * Input:
 * - `status`: 失敗したレスポンスの HTTP ステータス
 * - `context`: 呼び出しの種別。省略時は汎用
 *
 * Output:
 * - `error.*` の文言キー。未知のステータスは `error.generic`
 *
 * 例:
 * - 入力: `(409, "login")` → 出力: `"error.accountLimitReached"`
 * - 入力: `(500)` → 出力: `"error.generic"`
 */
export const errorMessageKeyFromStatus = (
    status: number,
    context?: ErrorContext,
): PlainMessageKey => {
    if (context === "login") {
        if (status === 409) return "error.accountLimitReached"
        if (status === 429) return "error.rateLimited"
        return "error.loginFailed"
    }
    switch (status) {
        case 400:
            return "error.badRequest"
        case 401:
            return "error.unauthorized"
        case 403:
            return "error.forbidden"
        case 404:
            return "error.notFound"
        case 409:
            return "error.conflict"
        case 429:
            return "error.rateLimited"
        default:
            return "error.generic"
    }
}
