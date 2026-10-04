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
/** 投稿に載る動画 blob の MIME タイプ（変換後の出力。常に mp4） */
export const VIDEO_BLOB_MIME_TYPE = "video/mp4"
/** 添付できる動画の MIME タイプ（アップロード前の形式）と、MIME が空のときに判定へ使う拡張子 */
export const VIDEO_SOURCE_FORMATS = [
    { mimeType: "video/mp4", extensions: ["mp4", "m4v"] },
    { mimeType: "video/quicktime", extensions: ["mov"] },
    { mimeType: "video/webm", extensions: ["webm"] },
    { mimeType: "video/mpeg", extensions: ["mpeg", "mpg"] },
] as const
/** `<input type="file">` の `accept` に渡す値（MIME タイプと拡張子の両方） */
export const VIDEO_ACCEPT = VIDEO_SOURCE_FORMATS.flatMap(f => [
    f.mimeType,
    ...f.extensions.map(e => `.${e}`),
]).join(",")
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
