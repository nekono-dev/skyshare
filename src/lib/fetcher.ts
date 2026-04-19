import { extractorApi } from "@/vars"

/**
 * OpenAPI クライアント向けの共通 Fetcher。
 *
 * 責務と処理概要:
 * - `/v1/extract` 系の相対パスを `extractorApi` へ振り替える。
 * - 空ボディや非 JSON ボディでも例外で落とさず `data` に格納して返す。
 * - orval 生成クライアントが期待する `{ data, status, headers }` 形式へ正規化する。
 */

/**
 * URL 補正とレスポンス正規化を行うフェッチ関数。
 *
 * 想定する入力形状(最小要件):
 * - `url` は絶対 URL もしくは API 相対パス
 * - `options` は Fetch API の `RequestInit`
 *
 * 処理の趣旨:
 * - `/v1/extract` のみ抽出APIへルーティングし、それ以外は指定 URL をそのまま利用する。
 * - レスポンス本文は一度 `text()` で受け、JSON 解析失敗時は生文字列を返す。
 * - 失敗時に throw せず戻り値へ集約し、上位で HTTP ステータス判定できるようにする。
 *
 * Input:
 * - `url`: 送信先 URL
 * - `options`: fetch オプション
 *
 * Output:
 * - ジェネリック型 `T` として `{ data, status, headers }` 互換オブジェクト
 *
 * 例:
 * - 入力: `url="/v1/extract/ogp"`
 * - 出力: `extractorApi` を先頭に付与したリクエスト結果
 */
export const customFetcher = async <T>(
    url: string,
    options: RequestInit,
): Promise<T> => {
    if (url.startsWith("/v1/extract")) {
        url = extractorApi + url
    }
    const res = await fetch(url, options)
    // ボディが空や非 JSON の場合でも例外を回避し、`data` へ安全に格納する。
    const text = await res.text()
    let parsed: any = undefined
    if (text && text.length > 0) {
        try {
            parsed = JSON.parse(text)
        } catch (e) {
            parsed = text
        }
    }

    // orval 生成のクライアントが期待する形に整形して返す
    return {
        data: parsed,
        status: res.status,
        headers: res.headers,
    } as unknown as T
}
