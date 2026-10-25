/**
 * 表示言語を React コンポーネントから使うためのフック。
 *
 * 責務と処理概要:
 * - `store.ts` の言語を `useSyncExternalStore` で購読し、言語が変わると再描画する。
 * - サーバー描画・水和時は `getServerSnapshot` が既定言語を返すため、日本語で描画された
 *   HTMLと一致し、水和後に実際の言語へ再描画される（hydration mismatch を起こさない）。
 * - 言語切り替えは再描画のみで行い、コンポーネントを再マウントしない
 *   （入力中のフォーム・開いたダイアログを保持するため）。`key` に言語を使ってはならない。
 */
import { useMemo, useSyncExternalStore } from "react"
import { formatDateTime, formatNumber } from "./format"
import { DEFAULT_LOCALE, type Locale } from "./locale"
import { getLocale, subscribe } from "./store"
import { createTranslator, type Translator } from "./translate"

/**
 * 現在の表示言語を返す。
 *
 * Output:
 * - 表示言語。言語が変わると呼び出し元コンポーネントが再描画される
 */
export const useLocale = (): Locale =>
    useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE)

/**
 * 現在の表示言語の翻訳関数を返す。
 *
 * Output:
 * - `{ t, tn, locale }`。言語が変わらない間は同一オブジェクト
 *
 * 例:
 * - `const { t } = useT()` → `t("common.cancel")`
 */
export const useT = (): Translator => {
    const locale = useLocale()
    return useMemo(() => createTranslator(locale), [locale])
}

/**
 * 現在の表示言語に束縛した日時・数値の書式化関数を返す。
 *
 * Output:
 * - `{ formatDateTime(value, options?), formatNumber(value) }`
 */
export const useFormat = () => {
    const locale = useLocale()
    return useMemo(
        () => ({
            formatDateTime: (
                value: string | number | Date,
                options?: Intl.DateTimeFormatOptions,
            ) => formatDateTime(value, locale, options),
            formatNumber: (value: number) => formatNumber(value, locale),
        }),
        [locale],
    )
}
