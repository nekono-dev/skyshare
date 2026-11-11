/**
 * 表示テーマの保存と、テーマ設定の文書への反映を担う。
 *
 * - SSR では localStorage の読み書きと文書への反映を行わず、localStorage が使えない場合は読み込み時に既定値へ戻す。
 */

export type ThemeMode = "system" | "light" | "dark"

const THEME_MODE_KEY = "themeMode"
const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"]

const isThemeMode = (value: string): value is ThemeMode =>
    (THEME_MODES as readonly string[]).includes(value)

/**
 * 表示テーマ設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済みテーマ設定。未設定/不正値/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `"system"`
 * - 出力: `"dark"`（保存済み値が "dark" の場合）
 */
export const readThemeModeSetting = (defaultValue: ThemeMode): ThemeMode => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(THEME_MODE_KEY)
        if (rawValue === null || !isThemeMode(rawValue)) {
            return defaultValue
        }
        return rawValue
    } catch (error) {
        return defaultValue
    }
}

/**
 * 表示テーマ設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したいテーマ設定
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `"dark"`
 * - 出力: localStorage に `themeMode=dark` を保存
 */
export const writeThemeModeSetting = (value: ThemeMode) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(THEME_MODE_KEY, value)
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * テーマ設定を実際のDOMに反映する。
 *
 * 処理の趣旨:
 * - `"system"` の場合は `data-theme` 属性を外し、`prefers-color-scheme` に委ねる。
 * - `"light"`/`"dark"` の場合は `data-theme` 属性を設定し、OS設定より優先させる。
 *
 * Input:
 * - `mode`: 反映したいテーマ設定
 *
 * Output:
 * - なし
 */
export const applyThemeMode = (mode: ThemeMode) => {
    if (typeof document === "undefined") {
        return
    }

    if (mode === "system") {
        document.documentElement.removeAttribute("data-theme")
        return
    }
    document.documentElement.dataset.theme = mode
}
