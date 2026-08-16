/**
 * タイムライン表示設定の永続化ユーティリティ。
 *
 * 責務と処理概要:
 * - タイムラインの1ページあたり表示件数を localStorage で管理する。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする。
 */

const PAGE_SIZE_KEY = "timelinePageSize"

/**
 * タイムラインの表示件数設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定/不正値時に返す既定値
 *
 * Output:
 * - 保存済みの表示件数。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `20`
 * - 出力: `50`（保存済み値が 50 の場合）
 */
export const readPageSizeSetting = (defaultValue: number) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(PAGE_SIZE_KEY)
        if (rawValue === null) {
            return defaultValue
        }

        const parsed = Number(rawValue)
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return defaultValue
        }

        return parsed
    } catch (error) {
        return defaultValue
    }
}

/**
 * タイムラインの表示件数設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい表示件数
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `50`
 * - 出力: localStorage に `timelinePageSize=50` を保存
 */
export const writePageSizeSetting = (value: number) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(PAGE_SIZE_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
