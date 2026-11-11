/**
 * Bluesky のサービス接続先を環境変数から解決する。
 *
 * - PDS の上書きが未指定なら、DID ドキュメントから接続先を解決する。
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
 * `PUBLIC_BSKY_AUTH_SERVER_URL` はクライアントのログインフォームも同じ値を送るため公開名を使う。
 * 空文字を含め値が未指定なら本番と同じ既定値を返し、E2E では偽の Bluesky URL を指定する。
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
