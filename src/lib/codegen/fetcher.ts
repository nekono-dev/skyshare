import { extractorApi } from "@/vars"
import { v1Endpoint } from "@/env"

/**
 * OpenAPI クライアント向けの共通 Fetcher。
 *
 * 責務と処理概要:
 * - `/v1/extract` 宛リクエストを、外部 OGP 抽出サービス(`extractorApi`)へ付け替える。
 * - `/v1/page` 宛リクエストを、legacy backend(`v1Endpoint`)へ付け替える。
 * - `/v2/bsky/images` 宛リクエストは URL 書き換えなし（同一オリジン）で、レスポンスを
 *   JSON化せず Blob のまま返す（Canvas合成用の画像バイナリのため）。
 * - 空ボディや非 JSON ボディでも例外で落とさず `data` に格納して返す。
 * - orval 生成クライアントが期待する `{ data, status, headers }` 形式へ正規化する。
 *
 * 注意:
 * - この `/v1/page` は openapi 上の名前空間であり、legacy backend の実 API を直接叩くための
 *   ルーティングキーに過ぎない。本アプリ自身が持つ同名の Astro ルート
 *   (`src/pages/v1/page.ts`、cookie セッションを検証してから legacy backend を呼ぶプロキシ)
 *   とは別物で、両者はここで URL が書き換わるため実行時に衝突しない。
 */

/**
 * URL 補正とレスポンス正規化を行うフェッチ関数。
 *
 * 想定する入力形状(最小要件):
 * - `url` は絶対 URL もしくは API 相対パス
 * - `options` は Fetch API の `RequestInit`
 *
 * 処理の趣旨:
 * - `/v1/extract` は外部 OGP 抽出サービスがそのまま公開しているパスと一致するため、
 *   ホスト(`extractorApi`)を先頭に付与するだけでよい。
 * - `/v1/page` は legacy backend の実パス `${v1Endpoint}/page`(`v1Endpoint` に
 *   `/api/v1` まで含む)に対応するため、`/v1` 部分を取り除いてから `v1Endpoint` を付与する。
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
 * - 入力: `url="/v1/extract?url=https://example.com"`
 * - 出力: `extractorApi` を先頭に付与したリクエスト結果
 * - 入力: `url="/v1/page/0/did:plc:abc@3lxyz"`
 * - 出力: `${v1Endpoint}/page/0/did:plc:abc@3lxyz` へのリクエスト結果
 * - 入力: `url="/v2/bsky/images?cid=bafkre..."`
 * - 出力: `data` が画像 `Blob` であるリクエスト結果
 */
export const customFetcher = async <T>(
    url: string,
    options: RequestInit,
): Promise<T> => {
    if (url.startsWith("/v1/extract")) {
        url = extractorApi + url
    } else if (url.startsWith("/v1/page")) {
        url = v1Endpoint + url.slice("/v1".length)
    }
    const res = await fetch(url, options)

    if (url.startsWith("/v2/bsky/images")) {
        // 画像バイナリを Blob のまま返す（base64/JSON化はメモリ・CPUコストが増えるだけで
        // メリットが無いため行わない）。
        return {
            data: await res.blob(),
            status: res.status,
            headers: res.headers,
        } as unknown as T
    }

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
