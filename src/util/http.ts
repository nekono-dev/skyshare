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
