/**
 * 未ログイン時に URL の `guest` クエリでダミー表示を選ぶ共通処理を提供する。
 *
 * - 各画面は未ログイン（401）の分岐内でのみゲスト表示を判定するため、その条件ではログイン済みユーザーの表示に影響しない。
 */

import type { Translator } from "@/lib/i18n/translate"
import type { EntryDeleteScope } from "@/lib/timeline/resolveEntryDeleteScope"
import { getGuestDummyData } from "@/lib/timeline/guest"

export const GUEST_MODE_QUERY_KEY = "guest"

/**
 * 現在のブラウザURLにゲストモードを要求するクエリパラメータが付いているかを判定する。
 *
 * Output:
 * - SSR環境（`window` 不在）では常に `false`
 */
export const isGuestModeRequested = (): boolean => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).has(GUEST_MODE_QUERY_KEY)
}

/**
 * 内部ナビゲーションリンクの href に、ゲストモードのクエリパラメータを引き継がせる。
 *
 * Input:
 * - `href`: 遷移先のパス（例: `/entries/`）
 * - `guestModeActive`: 現在ゲストモード表示中かどうか
 *
 * Output:
 * - `guestModeActive` が `false` ならそのままの `href`
 * - `true` なら `?guest=1` を付与した `href`
 *
 * 例:
 * - 入力: `href="/entries/"`, `guestModeActive=true`
 * - 出力: `"/entries/?guest=1"`
 */
export const withGuestModeQuery = (
    href: string,
    guestModeActive: boolean,
): string => {
    if (!guestModeActive) return href
    const separator = href.includes("?") ? "&" : "?"
    return `${href}${separator}${GUEST_MODE_QUERY_KEY}=1`
}

/**
 * ゲスト表示用に`sourceUri`から削除範囲を引く。テーブルにないentryは`unknown`。
 *
 * Input:
 * - `sourceUri`: ダミーentryの`source`投稿のAT URI
 * - `translator`: 表示言語の翻訳関数（削除予定投稿の本文を言語に合わせるため）
 *
 * Output:
 * - `EntryDeleteScope`
 */
export const resolveGuestDeleteScope = (
    sourceUri: string,
    translator: Translator,
): EntryDeleteScope =>
    getGuestDummyData(translator).deleteScopes[sourceUri] ?? {
        kind: "unknown",
    }
