/**
 * 投稿フォームの @メンション/#ハッシュタグ候補表示のON/OFF設定を localStorage で管理するユーティリティ。
 *
 * 責務と処理概要:
 * - `useSuggest`（`src/components/post/PostForm/useSuggest.ts`）が候補ポップアップ自体を
 *   出すかどうかの判定に使う。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする
 *   （`src/lib/settings/shareSettings.ts` と同じ方針）。
 */

const HASHTAG_SUGGEST_ENABLED_KEY = "hashtagSuggestEnabled"
const MENTION_SUGGEST_ENABLED_KEY = "mentionSuggestEnabled"

/**
 * 「ハッシュタグ候補を表示」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `true`
 * - 出力: `false`（保存済み値が false の場合）
 */
export const readHashtagSuggestEnabledSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(
            HASHTAG_SUGGEST_ENABLED_KEY,
        )
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「ハッシュタグ候補を表示」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `false`
 * - 出力: localStorage に `hashtagSuggestEnabled=false` を保存
 */
export const writeHashtagSuggestEnabledSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(HASHTAG_SUGGEST_ENABLED_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「メンション候補を表示」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `true`
 * - 出力: `false`（保存済み値が false の場合）
 */
export const readMentionSuggestEnabledSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(
            MENTION_SUGGEST_ENABLED_KEY,
        )
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「メンション候補を表示」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `false`
 * - 出力: localStorage に `mentionSuggestEnabled=false` を保存
 */
export const writeMentionSuggestEnabledSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(MENTION_SUGGEST_ENABLED_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
