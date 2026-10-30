/**
 * SurveyConfigLoader: 配信用のアンケート設定の取得。
 *
 * 責務と処理概要:
 * - ビルドの旗 `PUBLIC_SURVEY_CONFIG_PRESENT` が "true" のときだけ、`/surveys/index.json` を取得する。偽なら通信も読み出しもしない（要件 4.1）。
 * - 404・通信エラー・解析の失敗・検証の失敗を区別せず `undefined`（なし）にし、例外を投げず、表示もしない（要件 4.2）。
 * - 画面側（fetchSurveyConfig）は再検証つきで取得する。サーバー側（readSurveyConfig）は ASSETS から読み、検証済みの設定の内容だけを短時間メモリに保持する。
 * - `@atproto/*` に依存しない（middleware から辿れるため）。
 */

import { parseSurveyConfig, type SurveyConfig } from "@/lib/survey/definition"

/** 配信用の設定の取得先 */
const SURVEY_CONFIG_PATH = "/surveys/index.json"

/** サーバー側でメモリに保持する時間（ミリ秒） */
const SERVER_CACHE_TTL_MS = 60_000

/** サーバー側のメモリ保持。検証済みの設定の内容だけを持つ */
let serverCache: { config: SurveyConfig; expiresAt: number } | undefined

/**
 * サーバー側のメモリ保持を破棄する（テスト用）。
 */
export const resetSurveyConfigCache = (): void => {
    serverCache = undefined
}

/**
 * ビルドの旗を読む。未定義と "true" 以外は偽。
 *
 * Output: 配信用の設定がビルドに含まれるとき true
 * 例: PUBLIC_SURVEY_CONFIG_PRESENT="true" → true / 未定義 → false
 */
export const isSurveyConfigPresent = (): boolean =>
    import.meta.env.PUBLIC_SURVEY_CONFIG_PRESENT === "true"

/**
 * レスポンスを解析して検証する。どの失敗も undefined にする。
 *
 * Input: 取得したレスポンス
 * Output: 検証済みの設定、または undefined
 */
const parseResponse = async (
    response: Response,
): Promise<SurveyConfig | undefined> => {
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    const result = parseSurveyConfig(body)
    return result.ok ? result.config : undefined
}

/**
 * 画面側: 配信用の設定を再検証つきで取得する。
 *
 * Input:
 * - options.present: 旗の上書き（省くとビルドの旗）
 * - options.fetcher: 取得関数の上書き（省くと fetch）
 * Output: 検証済みの設定。旗が偽・取得や検証の失敗は undefined
 * 例: fetchSurveyConfig({ present: false }) → undefined（通信しない）
 */
export const fetchSurveyConfig = async (options?: {
    present?: boolean
    fetcher?: typeof fetch
}): Promise<SurveyConfig | undefined> => {
    const present = options?.present ?? isSurveyConfigPresent()
    if (!present) return undefined
    try {
        const fetcher = options?.fetcher ?? fetch
        const response = await fetcher(SURVEY_CONFIG_PATH, {
            cache: "reload",
        })
        return await parseResponse(response)
    } catch {
        return undefined
    }
}

/**
 * サーバー側: 静的アセットから配信用の設定を読む。成功した設定だけを 60 秒メモリに保持する。
 *
 * Input:
 * - assets: ASSETS バインディング
 * - origin: 仮の原点（ASSETS はパスで引く）
 * - options.present: 旗の上書き（省くとビルドの旗）
 * Output: 検証済みの設定。旗が偽・読み出しや検証の失敗は undefined
 * 例: readSurveyConfig(env.ASSETS, "https://example.invalid") → SurveyConfig | undefined
 */
export const readSurveyConfig = async (
    assets: { fetch(input: Request | string): Promise<Response> },
    origin: string,
    options?: { present?: boolean },
): Promise<SurveyConfig | undefined> => {
    const present = options?.present ?? isSurveyConfigPresent()
    if (!present) return undefined
    const now = Date.now()
    if (serverCache && now < serverCache.expiresAt) return serverCache.config
    try {
        const response = await assets.fetch(
            new URL(SURVEY_CONFIG_PATH, origin).toString(),
        )
        const config = await parseResponse(response)
        if (config) {
            serverCache = { config, expiresAt: now + SERVER_CACHE_TTL_MS }
        }
        return config
    } catch {
        return undefined
    }
}
