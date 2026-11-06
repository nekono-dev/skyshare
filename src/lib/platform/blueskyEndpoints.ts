/**
 * Bluesky のサービスの接続先の解決。
 *
 * 責務と処理概要:
 * - 認可サーバー、PLC ディレクトリ、AppView、PDS の上書きを、環境変数の値から一箇所で決める。
 * - 認可サーバーは `PUBLIC_BSKY_AUTH_SERVER_URL` を使う（クライアントのログインフォームも同じ値を送るため公開の名前にする）。
 * - 値が未指定（空文字を含む）なら、本番と同じ既定値を返す。E2E では偽の Bluesky の URL を指定する。
 * - 関数は環境変数の値だけを入力とする純粋な関数。読み取りの場所は呼び出し側に置く（テストしやすさ）。
 * - PDS は既定では DID ドキュメントから解決するため、`pdsOverride` は未指定のままにする。
 */

/** 本番と同じ既定値 */
export const DEFAULT_AUTH_SERVER = "https://bsky.social"
export const DEFAULT_PLC_DIRECTORY = "https://plc.directory"
export const DEFAULT_APP_VIEW = "https://api.bsky.app"

/** 解決の入力になる環境変数（すべて任意） */
export type BlueskyEndpointEnv = {
    readonly PUBLIC_DEFAULT_ATP_SERVICE?: string
    readonly PUBLIC_PLC_DIRECTORY_BASE_URL?: string
    readonly PUBLIC_BSKY_AUTH_SERVER_URL?: string
    readonly BSKY_PDS_URL?: string
}

/** 解決結果。`pdsOverride` が `undefined` のとき、PDS は DID ドキュメントから解決する */
export type BlueskyEndpoints = {
    readonly authServer: string
    readonly plcDirectory: string
    readonly appView: string
    readonly pdsOverride: string | undefined
}

/** 空文字と空白だけの値を未指定として扱う */
const pick = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

/**
 * 環境変数から Bluesky の接続先を決める。
 * Input: env（環境変数の値の集まり。値は任意）
 * Output: 認可サーバー・PLC・AppView の URL と、PDS の上書き（未指定なら undefined）
 * 例: resolveBlueskyEndpoints({}) -> { authServer: "https://bsky.social", plcDirectory: "https://plc.directory", appView: "https://api.bsky.app", pdsOverride: undefined }
 */
export const resolveBlueskyEndpoints = (
    env: BlueskyEndpointEnv,
): BlueskyEndpoints => ({
    authServer: pick(env.PUBLIC_BSKY_AUTH_SERVER_URL) ?? DEFAULT_AUTH_SERVER,
    plcDirectory:
        pick(env.PUBLIC_PLC_DIRECTORY_BASE_URL) ?? DEFAULT_PLC_DIRECTORY,
    appView: pick(env.PUBLIC_DEFAULT_ATP_SERVICE) ?? DEFAULT_APP_VIEW,
    pdsOverride: pick(env.BSKY_PDS_URL),
})
