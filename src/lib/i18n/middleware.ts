/**
 * 表示言語の決定ミドルウェア。
 *
 * 責務と処理概要:
 * - サーバー描画（SSR）ページ用に、Accept-Language から表示言語を決めて
 *   `context.locals.locale` へ供給する。
 * - 利用者の言語設定は localStorage にありサーバーへは送られないため、サーバー側の決定は
 *   Accept-Language のみに基づく。保存済み設定との差は、クライアントが初期描画後に埋める。
 * - SSG（prerender）ページはビルド時にリクエストヘッダが存在しない（読むと警告が出る）ため、
 *   常に既定言語を設定する。
 */
import type { MiddlewareHandler } from "astro"
import { DEFAULT_LOCALE, parseAcceptLanguage, resolveLocale } from "./locale"

/**
 * `context.locals.locale` を設定して後続へ進める。
 *
 * Input:
 * - `context`: Astro のリクエストコンテキスト
 * - `next`: 後続のミドルウェア/ルートハンドラ
 *
 * Output:
 * - `next()` の結果をそのまま返す
 */
export const localeMiddleware: MiddlewareHandler = (context, next) => {
    context.locals.locale = context.isPrerendered
        ? DEFAULT_LOCALE
        : resolveLocale(
              undefined,
              parseAcceptLanguage(
                  context.request.headers.get("accept-language"),
              ),
          )
    return next()
}
