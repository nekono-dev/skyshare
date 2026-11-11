/**
 * 表示言語の決定ミドルウェア。
 *
 * SSR の表示言語をリクエストから決め、後続のページ描画へ渡す。
 *
 * - サーバーには localStorage の設定が届かないため、Accept-Language を使う。
 * - prerender 中はリクエストヘッダが無いため、既定言語を使う。
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
