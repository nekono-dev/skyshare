/**
 * HTTP リクエスト/レスポンス補助の汎用ユーティリティ群。
 *
 * 責務と処理概要:
 * - `Headers` を通常のオブジェクトへ変換し、ログ出力やJSON化を扱いやすくする。
 * - `limit` クエリパラメータの妥当性を検証する。
 * - cookie ヘッダの有無、Content-Type が multipart/form-data かどうかを判定する。
 * - いずれもskyshare固有のドメイン知識を持たない、Fetch API標準の型のみを扱う処理。
 */

/**
 * limit クエリを検証する。
 *
 * Input:
 * - `value`: query string value
 *
 * Output:
 * - 1〜100 の整数なら number、未指定なら undefined、不正値なら null
 */
export const parseLimit = (value: string | null) => {
    if (value === null || value.trim().length === 0) {
        return undefined
    }

    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return null
    }

    return parsed
}

/**
 * `Headers` をプレーンオブジェクトへ変換する。
 *
 * 処理の趣旨:
 * - `Headers` はそのまま JSON 化しづらいため、key/value の通常オブジェクトへ展開する。
 *
 * Input:
 * - `headers`: Fetch API の `Headers` インスタンス
 *
 * Output:
 * - ヘッダー名をキー、値を値に持つオブジェクト
 *
 * 例:
 * - 入力: `Headers { content-type: "application/json" }`
 * - 出力: `{ "content-type": "application/json" }`
 */
export const convertHeaderToObj = (headers: Headers) => {
    const headersObj: Record<string, string> = {}

    headers.forEach((value: string, key: string) => {
        headersObj[key] = value
    })
    return headersObj
}

/**
 * リクエストに cookie ヘッダが付与されているかを検証する。
 *
 * 処理の趣旨:
 * - cookie の中身までは解釈せず、未ログイン状態を早期に弾くための軽量チェックに使う。
 *
 * Input:
 * - `request`: Fetch API の `Request`
 *
 * Output:
 * - cookie ヘッダが存在し空でなければ `true`
 *
 * 例:
 * - 入力: `Request` に `Cookie: atp_session=xxx`
 * - 出力: `true`
 */
export const hasCookieHeader = (request: Request): boolean => {
    const headers = convertHeaderToObj(request.headers)
    return typeof headers.cookie === "string" && headers.cookie.length > 0
}

/**
 * Content-Type が multipart/form-data かどうかを判定する。
 *
 * Input:
 * - `contentType`: `request.headers.get("content-type")` の値
 *
 * Output:
 * - multipart/form-data を含んでいれば `true`
 *
 * 例:
 * - 入力: `"multipart/form-data; boundary=----xxx"`
 * - 出力: `true`
 */
export const isMultipartFormData = (contentType: string | null): boolean => {
    return (contentType ?? "").includes("multipart/form-data")
}

/**
 * JSON の応答を組み立てる（本文・状態・ヘッダーを呼び出し側が指定する）。
 *
 * 処理の趣旨:
 * - 応答の形（ヘッダー）は呼び出しごとに異なるため、ヘッダーは呼び出し側が `headers` で渡す。
 *   既定で `content-type: application/json` を付け、呼び出し側の指定で上書きできる。
 * - 本文が `undefined` のときは本文を付けない（`content-type` も付けない）。
 * - 同じ名前のヘッダーを複数渡す場合（`set-cookie` など）は、配列の形で渡す。
 *
 * Input:
 * - `body`: JSON にする本文（`undefined` なら本文なし）
 * - `init.status`: 状態（既定 200）
 * - `init.headers`: 追加するヘッダー（既定の `content-type` より優先）
 *
 * Output:
 * - JSON の `Response`
 *
 * 例:
 * - 入力: `{ a: 1 }`, `{ headers: { "cache-control": "no-store" } }`
 * - 出力: 状態 200、本文 `{"a":1}`、`content-type` と `cache-control: no-store`
 */
export const jsonResponse = (
    body: unknown,
    init: { status?: number; headers?: HeadersInit } = {},
): Response => {
    const headers = new Headers(init.headers)
    if (body !== undefined && !headers.has("content-type")) {
        headers.set("content-type", "application/json")
    }
    return new Response(body === undefined ? null : JSON.stringify(body), {
        status: init.status ?? 200,
        headers,
    })
}

/**
 * HTTP ステータスに対応する JSON エラーレスポンスを生成する。
 *
 * 処理の趣旨:
 * - API 層で共通のエラー形式 `{ error: string }` を維持する。
 * - `switch` で主要なクライアント/認証/レート制限エラーを明示し、未定義は 500 相当へ寄せる。
 * - `cache-control: no-store` を付与し、cookie 依存のレスポンスをブラウザ/CDNにキャッシュさせない
 *   （キャッシュされると、ログイン直後でも古い 401 応答が返り続ける不具合につながるため）。
 *
 * Input:
 * - `status`: 返却する HTTP ステータス
 *
 * Output:
 * - `content-type: application/json` と `cache-control: no-store` を持つ `Response`
 *
 * 例:
 * - 入力: `401`
 * - 出力: `{"error":"Unauthorized"}` を含む `Response`
 */
export const errorResponseFromStatus = (status: number): Response => {
    const message = { error: "Unknown Error" }
    switch (status) {
        case 400:
            message.error = "Bad Request"
            break
        case 401:
            message.error = "Unauthorized"
            break
        case 403:
            message.error = "Forbidden"
            break
        case 404:
            message.error = "Not Found"
            break
        case 409:
            message.error = "Conflict"
            break
        case 422:
            message.error = "Unprocessable Content"
            break
        case 429:
            message.error = "Too Many Requests"
            break
        case 503:
            message.error = "Service Unavailable"
            break
        default:
            message.error = "Internal Server Error"
            break
    }
    return jsonResponse(message, {
        status,
        headers: { "cache-control": "no-store" },
    })
}
