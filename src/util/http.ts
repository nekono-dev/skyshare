/**
 * HTTP リクエスト/レスポンス補助の汎用ユーティリティ群。
 *
 * 責務と処理概要:
 * - `Headers` を通常のオブジェクトへ変換し、ログ出力やJSON化を扱いやすくする。
 * - `limit` クエリパラメータの妥当性を検証する。
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
