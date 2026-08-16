/**
 * タイムライン表示設定の永続化ユーティリティ。
 *
 * 責務と処理概要:
 * - タイムラインの1ページあたり表示件数を localStorage で管理する。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする。
 *
 * 注記:
 * - ページネーション方式（ページ送り/無限スクロール）の選択肢は廃止し、
 *   無限スクロールに固定した。関連する永続化ロジックはデッドコードとして
 *   下記にコメントアウトのまま残置している（再導入時の参照用）。
 */

const PAGE_SIZE_KEY = "timelinePageSize"
// const PAGINATION_MODE_KEY = "timelinePaginationMode"

/**
 * ページネーション方式。
 *
 * - `paged`: 前へ/次へボタンによるページ送り方式
 * - `infinite`: スクロールによる自動追記方式（1回50件固定）
 */
export type PaginationMode = "paged" | "infinite"

// const isPaginationMode = (value: unknown): value is PaginationMode =>
//     value === "paged" || value === "infinite"

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

// /**
//  * タイムラインのページネーション方式設定を localStorage から読み取る。
//  *
//  * Input:
//  * - `defaultValue`: localStorage が利用できない場合や未設定/不正値時に返す既定値
//  *
//  * Output:
//  * - 保存済みのページネーション方式。未設定/失敗時は `defaultValue`
//  *
//  * 例:
//  * - 入力: `"paged"`
//  * - 出力: `"infinite"`（保存済み値が `"infinite"` の場合）
//  */
// export const readPaginationModeSetting = (
//     defaultValue: PaginationMode,
// ): PaginationMode => {
//     if (typeof window === "undefined") {
//         return defaultValue
//     }
//
//     try {
//         const rawValue = window.localStorage.getItem(PAGINATION_MODE_KEY)
//         if (!isPaginationMode(rawValue)) {
//             return defaultValue
//         }
//
//         return rawValue
//     } catch (error) {
//         return defaultValue
//     }
// }
//
// /**
//  * タイムラインのページネーション方式設定を localStorage に保存する。
//  *
//  * Input:
//  * - `value`: 保存したいページネーション方式
//  *
//  * Output:
//  * - なし
//  *
//  * 例:
//  * - 入力: `"infinite"`
//  * - 出力: localStorage に `timelinePaginationMode=infinite` を保存
//  */
// export const writePaginationModeSetting = (value: PaginationMode) => {
//     if (typeof window === "undefined") {
//         return
//     }
//
//     try {
//         window.localStorage.setItem(PAGINATION_MODE_KEY, value)
//     } catch (error) {
//         // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
//     }
// }
