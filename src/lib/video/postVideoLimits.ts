/**
 * 動画投稿の定数。
 *
 * フロント・API・スキーマが同じ値を参照する。`src/lib/api/schema/**` から
 * 相対 import されるため、他モジュールに依存しない定数のみで構成する。
 */

/** 動画の最大サイズ（バイト）。Bluesky の `app.bsky.embed.video` の上限と同値 */
export const MAX_VIDEO_BYTES = 300_000_000
/** 動画の最大長（秒） */
export const MAX_VIDEO_DURATION_SEC = 600
/** 添付できる動画の MIME タイプ */
export const VIDEO_MIME_TYPE = "video/mp4"
/** 動画サービスの XRPC ベースURL */
export const VIDEO_SERVICE_XRPC_URL = "https://video.bsky.app/xrpc/"
/** 再生URL・サムネイルURLの配信ベースURL */
export const VIDEO_WATCH_BASE_URL = "https://video.bsky.app/watch/"
/** サービス認証トークンの有効期間（秒） */
export const VIDEO_UPLOAD_TOKEN_TTL_SEC = 30 * 60
/** トークン残り時間がこの秒数を下回ったら再発行する */
export const VIDEO_TOKEN_REFRESH_MARGIN_SEC = 5 * 60
/** 変換ジョブのポーリング間隔（ミリ秒） */
export const VIDEO_JOB_POLL_INTERVAL_MS = 1500
/** 変換ジョブのポーリング上限（ミリ秒） */
export const VIDEO_JOB_TIMEOUT_MS = 20 * 60 * 1000
/** 1パートあたりの最大リトライ回数 */
export const VIDEO_PART_MAX_RETRIES = 3
