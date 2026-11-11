/**
 * React コンポーネントで表示言語に応じた翻訳・書式化を使うフック。
 *
 * - SSR と水和では既定言語を使い、サーバー HTML との不一致（hydration mismatch）を防ぐ。
 * - 言語変更時は再描画のみで再マウントしない（入力中のフォーム・開いたダイアログを保つため）。
 *   `key` に言語を使ってはならない。
 */
import { useMemo, useSyncExternalStore } from "react"
import { formatDateTime, formatNumber } from "@/lib/i18n/format"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale"
import { getLocale, subscribe } from "@/lib/i18n/store"
import { createTranslator, type Translator } from "@/lib/i18n/translate"

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
