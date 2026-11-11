/**
 * Skyshare Entry 詳細ページの SSR 応答を Cloudflare Cache API で再利用する。
 * 表示のたびの DID 解決・PDS・AppView の呼び出しと HTML の描画が Workers 無料枠の CPU 上限（10ms）を圧迫するため、描画済みの HTML を返す。
 *
 * - 言語ごとに内容が異なるため、キャッシュキーに locale を含める。保存するのは 200 の HTML だけで、404/500 や Cookie を設定する応答は保存しない。
 * - Cache API はデータセンター単位で保存されるため、entry の更新・削除は最大 `ENTRY_PAGE_CACHE_TTL_SECONDS` 秒、他拠点の保存済みページに反映されない。
 * - `workers.dev` ドメインでは Cache API が動作しない（保存も取得も行われない）ため、毎回描画する。Cache API の失敗も握りつぶし、通常の描画へ戻す。
 */
import type { MiddlewareHandler } from "astro"

/** 保存したページを再利用する秒数 */
export const ENTRY_PAGE_CACHE_TTL_SECONDS = 300

/** キャッシュの命中状況を示す応答ヘッダー名（値は `HIT` / `MISS`） */
export const ENTRY_PAGE_CACHE_HEADER = "x-skyshare-cache"

const ENTRY_DETAIL_PATH = /^\/entries\/[^/]+\/$/

/**
 * entry詳細ページのパスかどうかを判定する。
 *
 * Input:
 * - `pathname`: リクエストURLのパス部分
 *
 * Output:
 * - `/entries/{slug}/` の形（末尾スラッシュ付き、スラッシュ区切りは1段）なら `true`
 */
export const isEntryDetailPath = (pathname: string): boolean =>
    ENTRY_DETAIL_PATH.test(pathname)

/**
 * 表示言語ごとのキャッシュキーを作る。
 *
 * Input:
 * - `url`: リクエストURL
 * - `locale`: 表示言語
 *
 * Output:
 * - クエリ文字列を取り除き、言語を `locale` パラメータとして付けた GET の `Request`
 *
 * 例:
 * - 入力: `https://skyshare.example.com/entries/x/?utm=1`, `"ja"`
 * - 出力: `https://skyshare.example.com/entries/x/?locale=ja`
 */
export const entryPageCacheKey = (url: URL, locale: string): Request => {
    const key = new URL(url.pathname, url.origin)
    key.searchParams.set("locale", locale)
    return new Request(key.toString(), { method: "GET" })
}

/**
 * 実行環境の `caches.default` を返す。取得できない環境では `undefined`。
 */
const defaultCache = (): Cache | undefined =>
    (globalThis.caches as unknown as { default?: Cache } | undefined)?.default

/**
 * entry詳細ページの応答を保存・再利用するミドルウェア。
 *
 * Input:
 * - `context`: Astro のリクエストコンテキスト（`locals.locale` と `locals.cfContext` を参照する）
 * - `next`: 後続のルートハンドラ
 *
 * Output:
 * - 対象外（GET以外・対象外パス・Cache API が使えない環境）: `next()` の結果をそのまま返す
 * - 保存済みあり: 保存した応答（`x-skyshare-cache: HIT`）
 * - 保存済みなし: 描画した応答（`x-skyshare-cache: MISS`）。200 の HTML は非同期に保存する
 */
export const entryPageCache: MiddlewareHandler = async (context, next) => {
    const { request, url, locals } = context
    const cache = defaultCache()
    if (
        !cache ||
        context.isPrerendered ||
        request.method !== "GET" ||
        !isEntryDetailPath(url.pathname)
    ) {
        return next()
    }

    const key = entryPageCacheKey(url, locals.locale)

    try {
        const cached = await cache.match(key)
        if (cached) {
            const hit = new Response(cached.body, cached)
            // 保存用に付けた Cache-Control をブラウザへ漏らさない（端末側で古い内容が残るのを防ぐ）
            hit.headers.delete("cache-control")
            hit.headers.set(ENTRY_PAGE_CACHE_HEADER, "HIT")
            return hit
        }
    } catch (error) {
        console.warn("entryPageCache: match failed", error)
    }

    const response = await next()
    const contentType = response.headers.get("content-type") ?? ""
    const cacheable =
        response.status === 200 &&
        contentType.includes("text/html") &&
        !response.headers.has("set-cookie")
    if (!cacheable) {
        return response
    }

    const stored = new Response(response.clone().body, response)
    stored.headers.set(
        "cache-control",
        `public, max-age=${ENTRY_PAGE_CACHE_TTL_SECONDS}`,
    )
    const saving = cache.put(key, stored).catch(error => {
        console.warn("entryPageCache: put failed", error)
    })
    locals.cfContext?.waitUntil(saving)

    const miss = new Response(response.body, response)
    miss.headers.set(ENTRY_PAGE_CACHE_HEADER, "MISS")
    return miss
}
