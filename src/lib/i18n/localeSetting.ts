/**
 * 表示言語設定の永続化ユーティリティ。
 *
 * - `system` は保存キーの削除で表し、SSR や localStorage の失敗時は「system」を使う。
 */
import { isLocale, type LocaleSetting } from "./locale"

export const LOCALE_SETTING_KEY = "uiLocale"

/**
 * 保存済みの言語設定を読み取る。
 *
 * Output:
 * - 保存済みの `ja`/`en`。未保存・不正値・読み取り失敗・SSR 時は `"system"`
 *
 * 例:
 * - 出力: `"en"`（localStorage の `uiLocale` が `"en"` の場合）
 */
export const readLocaleSetting = (): LocaleSetting => {
    if (typeof window === "undefined") return "system"
    try {
        const raw = window.localStorage.getItem(LOCALE_SETTING_KEY)
        return isLocale(raw) ? raw : "system"
    } catch (error) {
        return "system"
    }
}

/**
 * 言語設定を保存する。
 *
 * 処理の趣旨:
 * - `system` はキーを削除する。書き込み失敗時は何もしない
 *   （現在の表示言語は維持され、永続化されないだけで済ませる）。
 *
 * Input:
 * - `setting`: 保存したい言語設定
 *
 * 例:
 * - 入力: `"en"` → localStorage に `uiLocale=en` を保存
 */
export const writeLocaleSetting = (setting: LocaleSetting): void => {
    if (typeof window === "undefined") return
    try {
        if (setting === "system") {
            window.localStorage.removeItem(LOCALE_SETTING_KEY)
        } else {
            window.localStorage.setItem(LOCALE_SETTING_KEY, setting)
        }
    } catch (error) {
        // 保存できない環境では、保存せずに現在のセッションの表示のみ切り替える
    }
}
