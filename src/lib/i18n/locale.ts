/**
 * 表示言語（Locale）の型定義と判定ロジック。
 *
 * 責務と処理概要:
 * - 対応言語の一覧と、外部入力（localStorage・Accept-Language・navigator.languages）から
 *   表示言語を決める純粋関数を提供する。
 * - 状態を持たない。Cloudflare Workers（SSR）とブラウザの双方から呼べる。
 */

export const LOCALES = ["ja", "en"] as const
export type Locale = (typeof LOCALES)[number]

/** 利用者が選べる言語設定。`system` は「ブラウザの言語設定に従う」。 */
export type LocaleSetting = Locale | "system"

export const DEFAULT_LOCALE: Locale = "ja"

/**
 * 値が対応言語かを判定する。
 *
 * Input:
 * - `value`: localStorage などから得た任意の値
 *
 * Output:
 * - 対応言語なら `true`
 *
 * 例:
 * - 入力: `"en"` → 出力: `true` / 入力: `"fr"` → 出力: `false`
 */
export const isLocale = (value: unknown): value is Locale => {
    return LOCALES.some(locale => locale === value)
}

/**
 * Accept-Language ヘッダを、優先度の高い順の言語タグ配列に変換する。
 *
 * 想定する入力形状:
 * - `"en-US,en;q=0.9,ja;q=0.8"` のようなカンマ区切り。`q` 省略時は 1。
 *
 * 処理の趣旨:
 * - `q=0` は「受け入れない」の意味のため除外する。
 * - `q` が同じ場合は記載順を保つ（安定ソート）。
 * - 解釈できない `q` は 1 として扱う。
 *
 * Input:
 * - `header`: Accept-Language ヘッダ値。`null`/空文字可
 *
 * Output:
 * - 言語タグの配列。ヘッダが無ければ空配列
 *
 * 例:
 * - 入力: `"ja;q=0.5,en-US"` → 出力: `["en-US", "ja"]`
 */
export const parseAcceptLanguage = (
    header: string | null | undefined,
): string[] => {
    if (!header) return []
    return header
        .split(",")
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(";")
            const qParam = params
                .map(param => param.trim())
                .find(param => param.startsWith("q="))
            const parsedQ = qParam ? Number(qParam.slice(2)) : 1
            const q = Number.isFinite(parsedQ) ? parsedQ : 1
            return { tag: tag.trim(), q, index }
        })
        .filter(entry => entry.tag !== "" && entry.tag !== "*" && entry.q > 0)
        .sort((a, b) => b.q - a.q || a.index - b.index)
        .map(entry => entry.tag)
}

/**
 * 言語タグ配列（優先順）から、対応言語のうち最初に一致するものを返す。
 *
 * 処理の趣旨:
 * - `en-US` のような地域付きタグは主言語（`en`）で照合する。
 *
 * Input:
 * - `languages`: 優先順の言語タグ（`navigator.languages` や `parseAcceptLanguage` の結果）
 *
 * Output:
 * - 一致した Locale。1つも一致しなければ `undefined`
 *
 * 例:
 * - 入力: `["fr-FR", "en-GB"]` → 出力: `"en"`
 */
export const pickLocaleFromLanguages = (
    languages: readonly string[],
): Locale | undefined => {
    for (const language of languages) {
        const primary = language.toLowerCase().split("-")[0]
        if (isLocale(primary)) return primary
    }
    return undefined
}

/**
 * 表示言語を決定する。優先順位は 保存済み設定 → ブラウザ言語 → 既定（日本語）。
 *
 * Input:
 * - `storedValue`: 保存済みの言語設定（未保存・不正値は無視される）
 * - `languages`: 優先順のブラウザ言語
 *
 * Output:
 * - 表示言語
 *
 * 例:
 * - 入力: `(null, ["en-US"])` → 出力: `"en"`
 * - 入力: `("ja", ["en-US"])` → 出力: `"ja"`
 */
export const resolveLocale = (
    storedValue: string | null | undefined,
    languages: readonly string[],
): Locale => {
    if (isLocale(storedValue)) return storedValue
    return pickLocaleFromLanguages(languages) ?? DEFAULT_LOCALE
}
