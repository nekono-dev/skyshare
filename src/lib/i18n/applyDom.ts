/**
 * `.astro` が出力した静的DOMの文言を、表示言語に合わせて書き換える。
 *
 * - SSG の静的DOMはクライアントで再描画されないため、言語変更時に翻訳対象を更新する。
 * - React が管理するDOMには翻訳属性を付けない（再描画と競合するため）。
 */
import { serviceName } from "@/vars"
import type { Locale } from "./locale"
import { createTranslator, type MessageKey } from "./translate"

/**
 * 文書内の翻訳対象要素を指定言語の文言へ書き換える。
 *
 * 処理の趣旨:
 * - タイトル用キーは `{service}` を含む場合があるため、サービス名を常に渡す
 *   （`interpolate` は使われないパラメータを無視する）。
 *
 * Input:
 * - `locale`: 表示言語
 *
 * 失敗時の方針:
 * - `document` が無い環境（SSR）では何もしない。
 *
 * 例:
 * - `<span data-i18n="nav.settings">設定</span>` → 英語では `Settings` に変わる
 */
export const applyDomTranslations = (locale: Locale): void => {
    if (typeof document === "undefined") return
    const { t } = createTranslator(locale)
    const lookup = (key: string | undefined): string | undefined =>
        key
            ? t(key as MessageKey, { service: serviceName } as never)
            : undefined

    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(element => {
        const text = lookup(element.dataset.i18n)
        if (text !== undefined) element.textContent = text
    })
    document
        .querySelectorAll<HTMLElement>("[data-i18n-aria-label]")
        .forEach(element => {
            const text = lookup(element.dataset.i18nAriaLabel)
            if (text !== undefined) element.setAttribute("aria-label", text)
        })
    const title = lookup(
        document.querySelector<HTMLElement>("title[data-i18n-title]")?.dataset
            .i18nTitle,
    )
    if (title !== undefined) document.title = title
}
