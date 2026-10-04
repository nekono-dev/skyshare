# 動画投稿 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

## 1. 全体方針

- 動画の実体は **ブラウザから Bluesky の動画サービス（`https://video.bsky.app/xrpc/`）へ直接アップロード**する（NFR-1）。skyshare のサーバー（Workers）は、動画アップロード用サービス認証トークンの発行と、アップロード完了後の blob 参照を `embed` に載せた投稿作成のみを担う。
- アップロードは分割アップロード（`startUpload` → `uploadPart` → `finishUpload`）を使い、変換完了を `getJobStatus` のポーリングで待つ。動画は選択直後に**先行アップロード**し、完了するまで投稿ボタンを無効にする。投稿時には動画の blob 参照（JSON）だけを `POST /v2/entry` に送る。
- 動画は `app.bsky.embed.video` で投稿する。画像（`images`/`gallery`）・OGPリンク（`external`）とは排他とする。
- entry の visual は、動画の最初のフレーム相当の poster 1枚から既存の `createDefaultThumbnail` で生成し、その上に **再生ボタンと再生時間バッジを描画**する（§6.5。X の動画表示を模した、色・透明度・寸法を固定した仕様）。
- 表示は、投稿レコードの `embed` から再生URL（HLS）と poster URL を組み立てる。AppView の `embed.view` には依存しない（投稿直後に AppView へ未反映の期間があるため）。
- 引用投稿（`recordWithMedia`）に添付された動画は「利用不可の動画」として、poster を暗くして再生不可を明示する（§7.7）。再生・entry化の対象にはしない。
- Entry 詳細ページの再生は `hls.js` を再生開始時に動的 import して行い（`hls.js` が使えない MSE 非対応の環境、iOS Safari 等はネイティブHLS）、初期バンドルに含めない（NFR-3）。Timeline は poster のサムネイル表示のみとする。

```
ブラウザ                       Workers (skyshare)            video.bsky.app        PDS
  │ POST /v2/bsky/video/upload-token ─▶│ getServiceAuth ────────────────────────────▶│
  │◀──────── { token, did, expiresAt }─┘                                              │
  │ startUpload / uploadPart×N / finishUpload (Bearer token) ─▶│ ─── blob 保存 ──────▶│
  │ getJobStatus ポーリング ─────────────────────────────────▶│  → COMPLETED + blob
  │ POST /v2/entry (multipart: posts[i][video]=blob参照JSON) ─▶│ createRecord/applyWrites
```

## 2. 技術検証結果（設計の前提）

2026-10-04 に検証用アカウントで、スクラッチの検証フォーム（本ブランチと独立）を用いて確認した事実。設計はこれを前提とする。

| 項目                     | 結果                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS                     | `video.bsky.app` の API・HLS プレイリスト・セグメント・サムネイルは `access-control-allow-origin: *`。ブラウザから直接アクセスできる。                                                        |
| サービス認証             | `aud` = 利用者の PDS の `did:web:<PDSホスト>`、`lxm` = `com.atproto.repo.uploadBlob` の組み合わせのみ有効。`aud=did:web:video.bsky.app` や各 procedure 名の `lxm` は 401。                    |
| トークンの検証単位       | `startUpload`・`uploadPart`・`finishUpload` の各リクエストでトークンが検証される。有効期間（`exp`）を 30 分で発行して動作した。                                                               |
| 分割アップロード         | パートサイズはサーバー指定（5,242,880 バイト）。300MB で 58 パート。各パートは冪等。`startUpload` の応答に `jobId`・`partSizeBytes`・`partCount`。                                            |
| 変換ジョブ               | `finishUpload` の `completedJobId` を `getJobStatus`（認証不要）でポーリング。`JOB_STATE_COMPLETED` で `blob`（JSON形式の blob 参照）が得られる。                                             |
| `startUpload` の事前検証 | サイズ 300,000,000 バイト超は `VideoTooLarge`（400）、極端な縦横比は `BadAspectRatio`（400）。長さ・MIME は参考値として受理され、後段の変換で失敗しうる。長さの上限は 10 分（運用上の仕様）。 |
| 再生データ               | 投稿レコードの `video` blob の CID から `https://video.bsky.app/watch/<DID(URLエンコード)>/<CID>/playlist.m3u8` と `.../thumbnail.jpg` が得られる。マスタープレイリストは 360p/720p。         |
| 再生                     | Chromium で hls.js により再生できた。サムネイルの `content-type` は `application/octet-stream`（`<img>` 表示・`fetch` での取得は可能）。                                                      |

## 3. 定数（`src/lib/video/postVideoLimits.ts`）

フロント・API・スキーマが同じ値を参照する。依存を持たない定数のみのモジュールにする（`src/lib/api/schema/**` から相対 import されるため。`threadLimit.ts` と同じ理由）。

```ts
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
/** 変換ジョブのポーリング間隔（ミリ秒）と上限（ミリ秒） */
export const VIDEO_JOB_POLL_INTERVAL_MS = 1500
export const VIDEO_JOB_TIMEOUT_MS = 20 * 60 * 1000
/** 1パートあたりの最大リトライ回数 */
export const VIDEO_PART_MAX_RETRIES = 3
```

## 4. バックエンド

### 4.1 動画アップロード用トークン発行 API

- パス: `POST /v2/bsky/video/upload-token`（リソース＝アップロード用トークン。操作は HTTP メソッドで表現する）。
- スキーマ: `src/lib/api/schema/v2/bsky/video/upload-token/post.ts`（URLパスと対応するディレクトリ構成）。ルートハンドラ: `src/pages/v2/bsky/video/upload-token.ts`。
- リクエスト: ボディなし。ヘッダは既存の `Common.CommonCookieSchema`。認証は `bskySessionRefresh` ミドルウェアが供給する `locals.agent`・`locals.session` を使う。
- レスポンス 200:

```ts
export const ResponseBody200Schema = z
  .object({
    token: z.string().min(1),
    did: z.string(), // 利用者の DID
    expiresAt: z.number().int(), // UNIX 秒
  })
  .strict()
```

- エラー: 401（未認証）、400（対応PDS以外）、500（`getServiceAuth` 失敗）。`Common.errorResponses(["400","401","429","500"])` を使う。レスポンスには `Cache-Control: no-store` を付ける。
- 実装（`src/lib/atproto/videoAuth.ts`）:

```ts
/** PDS の URL が対応PDS（bsky.social 系）か判定する */
export const isSupportedVideoPds = (pdsUrl: string): boolean => {
  const host = new URL(pdsUrl).host
  return host === "bsky.social" || host.endsWith(".host.bsky.network")
}

type VideoAuthAgent = Pick<AtpAgent, "com"> // com.atproto.server.getServiceAuth のみ使用

export const createVideoUploadToken = async (
  agent: VideoAuthAgent,
  session: { did: string; didDoc?: unknown },
  nowSec: number,
): Promise<
  | { ok: true; token: string; did: string; expiresAt: number }
  | { ok: false; status: 400 | 500 }
> => {
  // PDS は session.didDoc の #atproto_pds、無ければ resolvePdsServiceForDid(did)
  const pdsUrl =
    readPdsServiceFromDidDoc(session.didDoc) ??
    (await resolvePdsServiceForDid(session.did))
  if (!pdsUrl) return { ok: false, status: 500 }
  if (!isSupportedVideoPds(pdsUrl)) return { ok: false, status: 400 }
  const expiresAt = nowSec + VIDEO_UPLOAD_TOKEN_TTL_SEC
  try {
    const res = await agent.com.atproto.server.getServiceAuth({
      aud: `did:web:${new URL(pdsUrl).host}`,
      lxm: "com.atproto.repo.uploadBlob",
      exp: expiresAt,
    })
    return { ok: true, token: res.data.token, did: session.did, expiresAt }
  } catch (err) {
    return { ok: false, status: 500 } // トークンはログに出さない（NFR-2）
  }
}
```

- PDS の URL 解決には `src/lib/atproto/did.ts` の既存関数 `readPdsServiceFromDidDoc(didDoc)`（DID Document から `#atproto_pds` を抽出）と `resolvePdsServiceForDid(did)` を再利用する。
- 上記ハンドラは、`isSupportedVideoPds` が false のとき `errorResponseFromStatus(400)` を返す。

### 4.2 投稿作成 API（`POST /v2/entry`）の拡張

#### 4.2.1 共通スキーマ（`src/lib/api/schema/common.ts`）

```ts
/** 動画 blob 参照（getJobStatus が返す JSON 形式。`app.bsky.embed.video#video` にそのまま使える） */
export const CommonVideoBlobSchema = z
  .object({
    $type: z.literal("blob"),
    ref: z.object({ $link: z.string().min(1) }).strict(),
    mimeType: z.literal(VIDEO_MIME_TYPE),
    size: z.number().int().min(1).max(MAX_VIDEO_BYTES),
  })
  .strict()

export const CommonVideoMetaSchema = z
  .object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    alt: z.string().optional().default(""),
  })
  .strict()
```

#### 4.2.2 `EntryPostItemSchema` に動画投稿の分岐を追加（`src/lib/api/schema/v2/entry/post.ts`）

既存3分岐（テキストのみ／OGP／画像）の後ろに、4つ目の分岐を追加する。3分岐はいずれも `.strict()` のため `video` を含められず、動画分岐は `images`/`ogImage`/`ogMeta` を持たないため、排他が構造的に保たれる。

```ts
// 動画付き投稿（video/videoMeta が必須。画像・OGP とは排他）
z.object({
    text: textField.optional(),
    facets: Common.CommonFacetsSchema.optional(),
    video: Common.CommonVideoBlobSchema,
    videoMeta: Common.CommonVideoMetaSchema,
    langs: z.array(z.string()).optional(),
    selfLabels: selfLabelsField.optional(),
    gate: Common.CommonGateSettingsSchema.optional(),
}).strict(),
```

`PostItemFieldKinds` に `video: "json"`、`videoMeta: "json"` を追加する。`npm run codegen` で OpenAPI ドキュメントとクライアント（`src/client/openapi/`）を再生成する。

#### 4.2.3 embed 組み立て（`src/lib/atproto/embed.ts`）

```ts
export const createVideoEmbed = (
  video: Components.CommonVideoBlobType,
  meta: Components.CommonVideoMetaType,
) => ({
  $type: "app.bsky.embed.video" as const,
  video,
  alt: meta.alt ?? "",
  aspectRatio: { width: meta.width, height: meta.height },
})
```

#### 4.2.4 ハンドラ（`src/pages/v2/entry.ts`、フェーズ 5b）

embed 作成の分岐を「動画 → 画像 → OGP」の順にする。動画の blob は先行アップロード済みのため、`uploadBlob` は呼ばない。

```ts
if ("video" in item && item.video) {
  embed = createVideoEmbed(item.video, item.videoMeta)
} else if (hasImages && item.images) {
  /* 既存 */
} else if (item.ogMeta && item.ogImage) {
  /* 既存 */
}
```

`createBskyThread` は `embed` を不透明な値として扱うため変更しない。冒頭のドキュメントコメント（テキスト／OGP／画像）に「動画」を加える。

### 4.3 既存投稿の動画抽出

`src/lib/entry/entry.ts` に追加する。

```ts
export type SourceVideo = {
  cid: string
  playlistUrl: string
  thumbnailUrl: string
  alt: string
  aspectRatio?: { width: number; height: number }
}

/** blob の CID と repo DID から再生URL・サムネイルURLを組み立てる */
export const buildVideoUrls = (repoDid: string, cid: string) => ({
  playlistUrl: `${VIDEO_WATCH_BASE_URL}${encodeURIComponent(repoDid)}/${cid}/playlist.m3u8`,
  thumbnailUrl: `${VIDEO_WATCH_BASE_URL}${encodeURIComponent(repoDid)}/${cid}/thumbnail.jpg`,
})

/**
 * embed が `app.bsky.embed.video` のとき SourceVideo を返す。それ以外
 * （`recordWithMedia` 内の動画を含む）は undefined。
 * `toCidString(embed.video)`（既存の blob→CID 変換）が undefined の場合も undefined。
 */
export const extractEmbedVideo = (
  embed: AppBskyFeedPost.Main["embed"] | undefined,
  repoDid: string,
): SourceVideo | undefined => {
  /* $type 判定 → cid → buildVideoUrls → alt / aspectRatio */
}
```

- `src/lib/entry/posts.ts` の `TimelinePost` に `video?: SourceVideo` を追加し、`toTimelinePost` 相当の変換（`extractTimelinePostImages` を呼ぶ箇所）で `extractEmbedVideo(postRecord.embed, post.author.did)` を設定する。
- `src/pages/entries/[slug].astro` の `toEntryPostView` で `video: extractEmbedVideo(record, repoDid)` を設定し、`EntryPostView`（`EntryDetailView/index.astro`）に `video?: SourceVideo` を追加して `PostBody` へ渡す。
- 動画投稿の判定ヘルパーを `posts.ts` に置く: `export const hasEntryMedia = (post: TimelinePost) => post.images.length > 0 || !!post.video`。`unsupportedVideo` は含めない（entry 作成の対象外になる。要件 FR-8）。

#### 利用不可の動画の抽出

```ts
/**
 * embed が `app.bsky.embed.recordWithMedia` で、その `media` が `app.bsky.embed.video` のとき
 * SourceVideo（poster 表示用。再生URLは使わない）を返す。それ以外は undefined。
 * 動画 blob は投稿レコードと同じ repo にあるため、repoDid は投稿者の DID をそのまま使う。
 */
export const extractUnsupportedEmbedVideo = (
  embed: AppBskyFeedPost.Main["embed"] | undefined,
  repoDid: string,
): SourceVideo | undefined => {
  /* embed.$type === "app.bsky.embed.recordWithMedia" && embed.media?.$type === "app.bsky.embed.video" → extractEmbedVideo({ ...embed.media }, repoDid) 相当 */
}
```

- `TimelinePost.unsupportedVideo?: SourceVideo` と `EntryPostView.unsupportedVideo?: SourceVideo` を追加し、`video` と同じ箇所で設定する。`video` と `unsupportedVideo` が同時に設定されることはない（embed は1つの `$type`）。

## 5. フロントエンド：アップロードコア（`src/lib/video/`）

### 5.1 `probeVideo.ts` — 選択ファイルの検査と poster 切り出し

```ts
export type VideoProbe = {
  width: number
  height: number
  durationSec: number
  posterBlob: Blob // JPEG（最大辺 1280px）
}

export type VideoValidationError =
  "notMp4" | "tooLarge" | "tooLong" | "unreadable"

/** 同期的に検査できるもの（形式・サイズ）。違反なら理由を返し、問題なければ undefined */
export const validateVideoFile = (
  file: File,
): VideoValidationError | undefined => {
  if (file.type !== VIDEO_MIME_TYPE) return "notMp4"
  if (file.size > MAX_VIDEO_BYTES) return "tooLarge"
  return undefined
}

/**
 * <video preload="auto"> で width/height/duration を読み、
 * 最初のフレーム相当（`currentTime = Math.min(0.1, duration / 2)` へシークし `seeked` を待つ。0 秒ちょうどは未デコードのことがあるため）のフレームを canvas に描画して poster を作る。
 * Safari は `preload="metadata"` だとシーク後もフレームを描画せず黒一色になり、`seeked` の時点でも未デコードのことがあるため、`preload="auto"` とし、`requestVideoFrameCallback`（未対応なら `readyState >= 2`）でフレームの描画可能を待ってから描画する（待機は1秒で打ち切り、超えても描画へ進む）。
 * duration > MAX_VIDEO_DURATION_SEC なら "tooLong"、読み込み不能・寸法0・duration が有限でなければ
 * "unreadable" で reject する。object URL は finally で revoke する。
 */
export const probeVideo = async (file: File): Promise<VideoProbe> => {
  /* ... */
}
```

### 5.2 `videoUploader.ts` — アップロード本体

```ts
export type VideoUploadToken = { token: string; did: string; expiresAt: number }

export type VideoUploadProgress =
    | { phase: "uploading"; percent: number }   // 送信済みバイト / 総バイト
    | { phase: "processing"; percent: number }  // getJobStatus.progress（状態ごと）

export type VideoBlobRef = z.infer<typeof Common.CommonVideoBlobSchema>

export type VideoUploadErrorCode =
    | "tooLarge" | "badAspectRatio" | "dailyLimit" | "forbidden"
    | "tooManyUploads" | "overloaded" | "processingFailed"
    | "timeout" | "network" | "unsupportedPds" | "unknown"

export class VideoUploadError extends Error {
    constructor(readonly code: VideoUploadErrorCode, message?: string) { super(message ?? code) }
}

export const uploadVideo = async (params: {
    file: File
    probe: Pick<VideoProbe, "width" | "height" | "durationSec">
    fetchToken: () => Promise<VideoUploadToken> // POST /v2/bsky/video/upload-token
    onProgress: (p: VideoUploadProgress) => void
    signal: AbortSignal
}): Promise<VideoBlobRef>
```

処理フロー:

```
getToken = トークンキャッシュ関数（expiresAt - now < VIDEO_TOKEN_REFRESH_MARGIN_SEC なら fetchToken() で再取得）

1. start = POST {XRPC}app.bsky.video.startUpload
     headers: Authorization: Bearer <getToken()>, Content-Type: application/json
     body: { sizeBytes: file.size, mimeType: "video/mp4", name: file.name,
             durationMs: round(durationSec*1000), width, height }
     失敗 → mapStartUploadError(error名)（§5.4）
2. for partNumber in 1..start.partCount（逐次）:
     chunk = file.slice((n-1)*partSizeBytes, n*partSizeBytes)
     POST {XRPC}app.bsky.video.uploadPart?jobId=…&partNumber=n
        headers: Authorization (毎回 getToken())、Content-Type: application/octet-stream
     リトライ: ネットワークエラー・HTTP 5xx・429 のみ。
        最大 VIDEO_PART_MAX_RETRIES 回、待機 1s,2s,4s（signal で中断可）
     その他の 4xx は即失敗（mapPartError）
     成功ごとに onProgress({ phase:"uploading", percent: sentBytes/file.size*100 })
3. fin = POST …finishUpload { jobId } （冪等。ネットワークエラーは 1 回だけ再試行）
4. 変換待ち: jobId = fin.completedJobId
     loop（VIDEO_JOB_POLL_INTERVAL_MS 間隔、VIDEO_JOB_TIMEOUT_MS で timeout）:
       s = GET {XRPC}app.bsky.video.getJobStatus?jobId=…（認証なし）
       COMPLETED → return s.jobStatus.blob（CommonVideoBlobSchema.safeParse 失敗なら "unknown"）
       FAILED    → throw VideoUploadError("processingFailed")
       その他    → onProgress({ phase:"processing", percent: s.jobStatus.progress ?? 0 })
5. signal 中断時: uploading フェーズ（finishUpload 前）なら abortUpload を best-effort で呼び
   （失敗は無視）、AbortError を投げる。finishUpload 後はジョブを放置する（blob は PDS のGC対象）。
```

### 5.3 `videoUploadToken.ts` — トークン取得

`createVideoUploadToken`（OpenAPI生成クライアント `@/client/openapi/client`）を呼び、`status !== 200` なら `status === 400` を `VideoUploadError("unsupportedPds")`、それ以外を `"unknown"` として投げる。

### 5.4 エラーとメッセージキーの対応（`src/lib/video/videoErrors.ts`）

| 発生源                                                   | `VideoUploadErrorCode` / `VideoValidationError` | メッセージキー（`video.error.*`） |
| -------------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| `validateVideoFile`: 形式                                | `notMp4`                                        | `notMp4`                          |
| `validateVideoFile`/`startUpload`: `VideoTooLarge`       | `tooLarge`                                      | `tooLarge`                        |
| `probeVideo`: 長さ超過                                   | `tooLong`                                       | `tooLong`                         |
| `probeVideo`: 読み込み不能                               | `unreadable`                                    | `unreadable`                      |
| `startUpload`: `BadAspectRatio`                          | `badAspectRatio`                                | `badAspectRatio`                  |
| `startUpload`: `DailyLimitExceeded`                      | `dailyLimit`                                    | `dailyLimit`                      |
| `startUpload`: `UploadForbidden`                         | `forbidden`                                     | `forbidden`                       |
| `startUpload`: `TooManyOpenUploads`                      | `tooManyUploads`                                | `tooManyUploads`                  |
| `startUpload`/`finishUpload`: `ServiceOverloaded`        | `overloaded`                                    | `overloaded`                      |
| `getJobStatus`: `JOB_STATE_FAILED`（`failureCode` 全般） | `processingFailed`                              | `processingFailed`                |
| ポーリングが `VIDEO_JOB_TIMEOUT_MS` 超過                 | `timeout`                                       | `timeout`                         |
| トークン発行 400                                         | `unsupportedPds`                                | `unsupportedPds`                  |
| `fetch` の TypeError（再試行後）                         | `network`                                       | `network`                         |
| 上記以外                                                 | `unknown`                                       | `unknown`                         |

`startUpload` 等のエラー応答は `{ error: string }` の JSON で返るため、`error` 名で分岐する。`mapVideoError(code): PlainMessageKey` を提供する。

## 6. フロントエンド：投稿フォーム

### 6.1 データモデル（`ThreadComposer/segments.ts`）

```ts
export type VideoEntry = {
  fileName: string
  width: number
  height: number
  durationSec: number
  alt: string
  posterPreview: string // object URL（取り外し時に revoke）
  posterBlob: Blob // poster（JPEG）
  cropState: SlotCropState // visual の poster の切り抜き状態（初期値は computeInitialCrop の既定配置。「サムネ調整」で更新）
  thumbnailPreview: string // thumbnailBlob の object URL（プレビュー・縮小表示用。差し替え・取り外し時に revoke）
  thumbnailBlob: Blob // visual（cropState の切り抜きに再生ボタン・バッジを重ねた 1200x630。初期は createDefaultThumbnail の結果）
  upload:
    | { state: "uploading"; progress: VideoUploadProgress }
    | { state: "done"; blob: VideoBlobRef }
    | { state: "error"; messageKey: PlainMessageKey }
}

export type SegmentState = {
  // 既存フィールド…
  videoEntry: VideoEntry | null
}
```

- `createEmptySegment` は `videoEntry: null`。
- `revokeVideoEntry(entry)` を追加し、`posterPreview` と `thumbnailPreview` を revoke する。`revokeImageEntry` と同じ呼び出し箇所（segment 削除・差し替え・unmount）で呼ぶ。
- 排他: `imageEntry` または `ogpResult` が非 null のとき動画追加ボタンを `disabled`、`videoEntry` が非 null のとき画像追加・OGP取得ボタンを `disabled` にする（`ThreadSegmentForm` の既存の排他制御 `update({ imageEntry: entry, ogpResult: null })` と同じ場所に並べる）。ボタンの `title`（ツールチップ）に排他の理由を表示する。
- 下書き変換（`DraftSegmentPost`）は変更しない（動画は保存対象外）。

### 6.2 `VideoPicker` コンポーネント（`src/components/video/VideoPicker/index.tsx`・`index.module.css`）

`ImagePicker` の隣に置く、**独立した動画専用ボタン**＋プレビュー（画像追加ボタンには統合しない。ファイル入力も別個に持つ）。

配置: `ThreadSegmentForm` のツールバー左側（`ImagePicker` と `OgpFetchButton` を並べている `toolbar-align-left` の領域）で、`<ImagePicker />` の直後、`<OgpFetchButton />` の前に `<VideoPicker />` を置く。

ボタン: `ImagePicker` の追加ボタン（`<label>`）と同一のクラス（`ui["base-button"] ui["white-button"] ui["nontext-button"] ui["md-button"]`）・同一のアイコン寸法（`var(--size-icon-button)` 四方の `<img>`）を使い、見た目の差をアイコンの絵柄だけにする。`aria-label` は `t("video.picker.addAria")`、`aria-disabled` は `disabled` に連動させる。

アイコン: `src/images/video.svg`（新規）にビデオカメラ風のSVGを置き、`ImagePicker` の `src/images/image.svg` と同じ方法で `import video from "@/images/video.svg"` して `<img src={video.src}>` で表示する。色は既存の `image.svg` と同じシステムの青 `#0085ff`（ルート要素の `fill="#0085ff" stroke="#0085ff"`）とする。形状は、角丸の矩形（カメラ本体）と、その右側に接する台形（レンズ部）の2要素。

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0085ff" stroke="#0085ff" stroke-linejoin="round">
  <rect x="2" y="6" width="13" height="12" rx="2.5"/>
  <path d="M16.5 10.5 L22 7 V17 L16.5 13.5 Z"/>
</svg>
```

props:

```ts
type Props = {
  value: VideoEntry | null
  onChange: (entry: VideoEntry | null) => void
  disabled?: boolean // 画像/OGP添付済み、または投稿処理中
}
```

動作:

```
onSelectFile(file):
  err = validateVideoFile(file)           → あれば value を変えず、エラー通知（video.error.*）
  probe = await probeVideo(file)          → 失敗は同様に通知
  thumbnailBlob = await createDefaultThumbnail(
                    [URL.createObjectURL(probe.posterBlob)],
                    drawVideoOverlay(probe.durationSec),   // §6.5
                )
  entry = { …, alt: "", upload: { state: "uploading", progress: {phase:"uploading", percent:0} } }
  onChange(entry)
  ac = new AbortController()（取り外しで abort）
  try  blob = await uploadVideo({ file, probe, fetchToken, signal, onProgress: 進捗を onChange で反映 })
       onChange({ …entry, upload: { state:"done", blob } })
  catch (e) AbortError なら何もしない／VideoUploadError は mapVideoError で upload.state="error"
```

- 表示（`previewContainerRef` へポータルされるプレビュー。`data-testid="video-preview"`）は、上から次の順に並べる。
  1. サムネイル: `MediaThumb`（§6.2.1）を、画像の `thumb-grid` と同じ `1200 / 630` の領域・枠線・角丸でフォーム全幅に置く。中身は poster の `<img>`（`object-fit: cover`）。右上に「×」（取り外し。`aria-label` は `t("video.picker.remove")`）、右下に「alt」（`aria-label` は `t("video.picker.altAria")`、alt が入力済みなら強調色）を `MediaThumb` のバッジで表示する。
  2. 進捗: サムネイルの直下に、進捗バー（`role="progressbar"`、`aria-valuenow`）と状態文言（アップロード中／変換中／完了／エラー）を縦に並べる。エラー状態では「別の動画を選ぶ」ボタンをその下に出す。
  - alt 入力は、画像と同じ `ImageAltDialog` を `altDialogOpen` state で開く（`onChange` で `VideoEntry.alt` を更新）。インラインの alt 入力欄・「動画を取り外す」テキストボタン・ファイル名表示は持たない。
- `<input type="file" accept="video/mp4">` を使う。`File` は `onSelectFile` のクロージャでのみ保持し、`VideoEntry` には持たせない（アップロード後は blob 参照だけが必要）。
- 取り外し: アップロード中なら `abort()`、`revokeVideoEntry`、`onChange(null)`。
- 全文言は `useT()` の `video.*` キー（§9）。

#### 6.2.1 共通部品 `MediaThumb`（`src/components/common/MediaThumb/index.tsx`・`index.module.css`）

画像（`ImagePicker`）と動画（`VideoPicker`）のプレビューで、サムネイル1枚の枠・「×」ボタン・「alt」ボタンを共有する部品。両者の見た目を一致させる。

```ts
type Props = {
  onRemove: () => void
  onEditAlt: () => void
  removeAriaLabel: string
  altAriaLabel: string
  altFilled: boolean // alt 入力済みなら強調色
  disabled?: boolean
  style?: CSSProperties // グリッド配置（gridArea）用
  testId?: string // コンテナの data-testid
  children: ReactNode // サムネイルの中身（<img> と、必要なら追加のバッジ）
}
```

- コンテナは `position: relative; overflow: hidden; background: var(--color-muted)`。`ImagePicker` の従来の `.thumb-item`・`.remove-badge`・`.alt-badge`・`.alt-badge-active` のスタイルを本部品へ移す。
- ボタンはボタンと分かる寸法・縁取りにする: 「×」は 40px の円・文字は `var(--font-size-2xl)`、「alt」は高さ 36px・文字は `var(--font-size-lg)`・左右の余白は `var(--space-3)`。どちらも `border: 2px solid #fff`、背景は `rgb(0 0 0 / 60%)`。`:hover:not(:disabled)` で背景を `var(--color-bluesky)` に変える（alt 入力済みの強調色 `var(--color-bluesky-hover)` も hover 時は `var(--color-bluesky)` にする）。位置は従来どおり（×: 右上、alt: 右下。余白は `var(--space-2)`）。
- `ImagePicker` は従来のサムネイルごとの `<div>`・2つのボタンを `MediaThumb` に置き換える（`data-testid="image-thumb"`・各 `aria-label` は従来と同じ値を渡す）。「Visual対象外」ラベルは `children` として渡す。

### 6.2.2 「サムネ調整」ボタンの分離と動画の visual 調整

要件 FR-11・FR-12。

**ボタンの切り離し**: 従来 `ImagePicker` の内部（`slots.length > 0` のとき描画）にあった「サムネ調整」ボタンを、独立コンポーネント `ThumbnailAdjustButton`（`src/components/image/ThumbnailAdjustButton/index.tsx`）にする。

```ts
type Props = {
  onClick: () => void
  disabled?: boolean
}
// 見た目: ui["base-button"] ui["text-button"] ui["blue-button"]、ラベル t("image.picker.adjustThumbnail")
```

**配置と制御**（`ThreadSegmentForm`）: ツールバー左側で `<ImagePicker />`・`<VideoPicker />` の後、`<OgpFetchButton />` の前に置く。`segment.imageEntry || segment.videoEntry` のときだけ描画する。ダイアログは各 Picker が持ち、`ThreadSegmentForm` は命令的ハンドル経由で開く。

```ts
export type ImagePickerHandle = {
  addFiles: (files: File[]) => void | Promise<void>
  openCropDialog: () => void // 既存の handleOpenCrop。slots が空なら何もしない
}
export type VideoPickerHandle = {
  openCropDialog: () => void // value が null なら何もしない
}

// ThreadSegmentForm
const onAdjustThumbnail = () =>
  segment.videoEntry
    ? videoPickerRef.current?.openCropDialog()
    : imagePickerRef.current?.openCropDialog()
// disabled: disabled（投稿処理中）。動画の upload 状態には依存しない
```

- `ImagePicker` は内部のボタンを削除し、`useImperativeHandle(ref, () => ({ addFiles, openCropDialog: handleOpenCrop }))` とする。調整ダイアログの描画・確定処理は従来どおり `ImagePicker` に置く。
- `VideoPicker` は `forwardRef<VideoPickerHandle, Props>` にし、`cropDialogOpen` state で調整ダイアログを描画する。

**調整ダイアログ（動画）**: 既存の `ImageCropDialog` を再利用する。props に `overlay?: CompositeOverlay` を追加する。

```ts
// ImageCropDialog.handleConfirm
if (overlay) {
  const thumbnailBlob = await createCroppedThumbnail(
    imageUrls,
    cropStates,
    overlay,
  )
  onConfirm([], thumbnailBlob, cropStates) // 原本画像は無い（動画の poster は投稿しない）
} else {
  const { originalBlobs, thumbnailBlob } = await createProcessedImages(
    imageUrls,
    cropStates,
  )
  onConfirm(originalBlobs, thumbnailBlob, cropStates)
}
```

`createCroppedThumbnail`（`src/lib/image/postImageProcessing.ts`）は `composeThumbnailBlob(imageUrls, cropStates, overlay)` の `thumbnailBlob` だけを返す薄い関数として追加する。

`VideoPicker` は `imageUrls={[value.posterPreview]}`・`initialCropStates={[value.cropState]}`・`overlay={drawVideoOverlay(value.durationSec)}` を渡す。確定時は `onChange({ ...value, cropState: states[0], thumbnailBlob })` とする。ダイアログ上のプレビューには再生ボタン・バッジは描かれない（確定後の visual にのみ重なる）。

**初期値**: `VideoPicker.handleFileChange` で `loadImageSize(posterPreview)` で poster の寸法を得て、`cropState = { crop: {x:0,y:0}, zoom: 1, cropPixels: computeInitialCrop(poster.width, poster.height, slot.w, slot.h) }`（`slot = getSlotDefs(1)[0]`）とする。`thumbnailBlob` は従来どおり `createDefaultThumbnail`（同じ `computeInitialCrop` を使うため `cropState` と一致する）。

**アップロード進捗との独立**: `VideoPicker.startUpload` の `emit` は、クロージャの `entryBase` ではなく最新の `valueRef.current` に `upload` だけをマージして通知する（アップロード中に調整された `cropState`・`thumbnailBlob`・`alt` を進捗通知で上書きしない）。`valueRef.current` が `null`（取り外し済み）なら通知しない。

**プレビューの表示**: `VideoPicker` のサムネイル `<img>` と、`ThreadSegmentForm` の非アクティブ時の縮小表示（`segment-thumbnail`）は、poster の切り抜きではなく、`VideoEntry.thumbnailPreview`（`thumbnailBlob` の object URL。再生ボタン・バッジ入りの visual、1200×630）を表示する。`thumbnailPreview` は `VideoPicker` が、動画選択時と調整確定時（`thumbnailBlob` を作り直すたび）に生成して `VideoEntry` に持たせる。解放は `posterPreview` と同じく、`ThreadSegmentForm` が URL をキーにした `useEffect` のクリーンアップで行い（差し替え・unmount）、取り外し・segment 削除は `revokeVideoEntry` が行う。サムネイル枠は `aspect-ratio: 1200 / 630` で visual と同じ比率のため、`object-fit: cover` で歪みなく収まり、再生ボタンは調整によらず枠の中央に表示される。調整ダイアログ（`ImageCropDialog`）は poster のみを表示し、`overlay` は確定時の生成にだけ使う（ダイアログ上には再生ボタン・バッジを描かない）。

### 6.3 送信（`ThreadComposer/submitThread.ts`）

- `buildPostItem`: `videoEntry?.upload.state === "done"` のとき `post.video = videoEntry.upload.blob`、`post.videoMeta = { width, height, alt }` を設定する。`imageEntry`/`ogpResult` より前に判定し、動画があれば他は設定しない。
- entry 作成候補: `segment => (!!segment.imageEntry || !!segment.videoEntry) && !manualImageAttach`。visual は `imageEntry?.thumbnailBlob ?? videoEntry.thumbnailBlob`。
- 投稿ボタンの `disabled` 条件（`ThreadComposer/index.tsx` と `spec.submitButton.md`）に次を加える。
  ```ts
  const hasPendingVideo = segments.some(
    segment =>
      segment.videoEntry !== null && segment.videoEntry.upload.state !== "done",
  )
  // submitDisabled = 既存条件 || hasPendingVideo
  ```
  - `uploading`（アップロード・変換中）と `error`（失敗）の動画が1つでも残っている間は投稿できない。これを解消できる操作は、(a) 完了を待つ、(b) 取り外し（キャンセル）、(c) `error` 時の選び直し（新しいアップロードの開始）のみである。取り外すと `videoEntry` が `null` になり、`hasPendingVideo` が偽になる。
  - 無効の理由は `video.submit.waitUpload`（アップロード中）または `video.submit.removeFailed`（失敗した動画が残っている）で表示する。`ThreadComposer` が `pendingVideoState(segments)` の結果を各 `ThreadSegmentForm` へ `submitBlockedReason` として渡し、`ThreadSegmentForm` が、ツールバー（`toolboxRef` の `div`）の直後・プレビュー（`OgpPreview`・`imagePreviewContainerRef`）の直前に `<p role="status" data-testid="video-submit-reason">` として描画する（文字サイズ `var(--font-size-sm)`、右寄せ。非アクティブな segment は `hidden` のため、表示されるのはアクティブな segment のみ）。投稿ボタン列には置かない。
  - `onSubmit` の先頭でも `hasPendingVideo` を再確認し、真なら送信せず return する（ボタンの `disabled` を迂回した Enter キー等の送信への防御）。
- 投稿完了後の検証は既存の `warmOgpCache`・`waitForImageLoad` をそのまま使う。

### 6.4 トークン取得失敗時の挙動

`fetchToken` が `unsupportedPds` を投げた場合は、`uploadVideo` が最初のトークン取得（`startUpload` 前）で失敗するため、動画は1バイトも送信されない。`VideoEntry.upload` は `{ state: "error", messageKey: "video.error.unsupportedPds" }` になり、プレビュー上に理由が表示される（取り外しで解消）。

### 6.5 動画投稿の visual（再生ボタン・再生時間バッジ）

要件 FR-10。X の動画表示を模した見た目を、`src/lib/video/videoOverlay.ts` に実装する。数値は X の画面のスクリーンショット（再生ボタン4枚・再生時間表示1枚。リポジトリには含めない）を実測して定めた。スクリーンショットは DPR 2 で取得されたもので、再生時間の数字の高さ 19px（デバイスピクセル）が 13px の文字（大文字高さ約 9.5 CSS px）に一致することから、`1 CSS px = 2 デバイスピクセル` とした。

#### 6.5.1 寸法・色（単位は CSS px。スクリーンショットの実測値 ÷ 2）

| 要素                | 値                                                                                            | 根拠（実測）                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 再生ボタン 円の中心 | 動画の表示領域の中心（水平・垂直とも）。動画の縦横比によらない                                | 正方形の動画のスクリーンショットで、動画枠の中心 (618, 680.5) と円の中心 (618, 681) が一致                                                                                                                                                                                      |
| 再生ボタン 円の直径 | `59`                                                                                          | 円の外接幅 118px（2枚の独立した画像で一致）                                                                                                                                                                                                                                     |
| 再生ボタン 円の色   | `rgba(50, 50, 50, 0.6)`                                                                       | 背景値→円の内側の値の実測 4 点（黒背景 `0→30`、赤背景 `251→130`・`32→43`・`30→42`。いずれも 1 チャンネルの値）を `結果 = (1-α)×背景 + α×色` に当てはめた（α=0.60、色=50.0、誤差 0.2 以下）。別の状態として α=0.8（色は同じ 50）の表示も観測されたが、採用しない（意思決定済み） |
| 再生記号の形        | 右向きの二等辺三角形。頂点は外接矩形内の `(0,0)`・`(0,H)`・`(W,H/2)`。`W = 20`・`H = 25`      | 外接矩形 40×50px                                                                                                                                                                                                                                                                |
| 再生記号の色        | `#FFFFFF`（不透明）                                                                           | 実測 `rgb(255,255,255)`                                                                                                                                                                                                                                                         |
| 再生記号の位置      | 外接矩形の中心を、円の中心から右へ `2.5` ずらす（垂直は中心一致）                             | 円の中心 (69.5, 64)・記号の中心 (74.5, 64.5)                                                                                                                                                                                                                                    |
| 再生時間バッジ 高さ | `20`                                                                                          | 外接 y 12〜51（40px）                                                                                                                                                                                                                                                           |
| 再生時間バッジ 幅   | `文字列の幅 + 18`（左右の余白 `9` ずつ）。`0:05` のとき `26 + 18 = 44`                        | 外接 x 28〜115（88px）、文字 x 46〜97                                                                                                                                                                                                                                           |
| 再生時間バッジ 角丸 | `4`                                                                                           | 角の曲がり開始が約 6〜8px                                                                                                                                                                                                                                                       |
| 再生時間バッジ 色   | `rgba(0, 0, 0, 0.8)`                                                                          | 明暗の異なる複数の背景（`84→20`、`145→31`、`251→58`、`32→7` 等、15 点）への当てはめで α=0.80・色≈黒（2）。最大誤差 7 程度                                                                                                                                                       |
| 再生時間バッジ 文字 | 白 `#FFFFFF`、`font-weight: 700`、`13px`、`sans-serif`、バッジ内で水平・垂直中央、書式 `m:ss` | 文字外接 高さ 19px                                                                                                                                                                                                                                                              |
| 再生時間バッジ 位置 | 動画の表示領域の左端から `12`、下端から `12`（バッジの左下角基準）                            | 動画全体が写ったスクリーンショットで、動画枠（x 0〜1235、y 63〜1298）に対し、バッジ x 24〜107・y 1235〜1274（左余白 24px、下余白 24px）                                                                                                                                         |

検証時の許容誤差は、色は各チャンネル ±6（JPEG 圧縮と補間のため）、位置・寸法は ±2 デバイスピクセルとする。

#### 6.5.2 visual（1200×630）への換算と、UI の再生ボタン

visual は X のカードで幅 `506` CSS px 前後に縮小表示されるため、描画時に `S = 1200 / 506`（≈ 2.3715）を CSS px の値に掛けて換算する。これにより X 上での見た目が、実測した CSS px の大きさになる。

| 要素                        | visual（1200×630）上の寸法（デバイスピクセル、S 倍。小数 1 桁） |
| --------------------------- | --------------------------------------------------------------- |
| 円の直径                    | `139.9`                                                         |
| 再生記号 W×H・右ずらし      | `47.4 × 59.3`・`5.9`                                            |
| バッジ 高さ・角丸・左右余白 | `47.4`・`9.5`・`21.3`                                           |
| バッジ 文字サイズ           | `30.8px`                                                        |
| バッジ 余白（左・下）       | `28.5`                                                          |

**動画の表示領域**は、visual では 1200×630 の画像全体である（`createDefaultThumbnail` が poster を縦横比を保って全面に収まるよう切り抜くため、横長・正方形・縦長のどの動画でも poster が画像全体を占める）。したがって、円の中心は常に `(width/2, height/2) = (600, 315)`、バッジは常に画像の左下隅からの余白で決まり、動画の縦横比に依存しない。UI（`VideoPlayer`・`VideoThumbnail`）では、円は poster コンテナ（`aspect-ratio` で動画の比率に合わせた領域）の中心に置く。

UI（`VideoPlayer`・`VideoThumbnail`）の再生ボタンは `VideoPlayButton`（`src/components/video/VideoPlayButton/index.tsx`）に実装し、同じ数値を **S = 1** の CSS px で使う（直径 59px の円、`<svg width="20" height="25">` の `<polygon points="0,0 0,25 20,12.5" fill="#fff">` を円の中心から右へ 2.5px ずらして配置）。数値は `videoOverlay.ts` の定数 `VIDEO_OVERLAY_SPEC` を唯一の定義とし、`VideoPlayButton` も同定数を参照する。

#### 6.5.3 実装

```ts
// src/lib/video/videoOverlay.ts
export const VIDEO_OVERLAY_SPEC = {
  buttonDiameter: 59,
  buttonFill: "rgba(50, 50, 50, 0.6)",
  triangleWidth: 20,
  triangleHeight: 25,
  triangleFill: "#ffffff",
  triangleOffsetX: 2.5,
  badgeHeight: 20,
  badgePaddingX: 9,
  badgeRadius: 4,
  badgeFill: "rgba(0, 0, 0, 0.8)",
  badgeTextColor: "#ffffff",
  badgeFontSize: 13,
  badgeFontWeight: 700,
  badgeMarginLeft: 12,
  badgeMarginBottom: 12,
  /** CSS px → visual のデバイスピクセルへの換算基準幅 */
  referenceCardWidth: 506,
} as const

/** 秒数を `m:ss`（分は桁揃えなし、秒は2桁）へ整形する。四捨五入し、最小 `0:01`。例: 5 → "0:05"、600 → "10:00" */
export const formatVideoDuration = (sec: number): string => {
  const total = Math.max(1, Math.round(sec))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/**
 * `composeThumbnailBlob` の描画後に呼ばれるオーバーレイ描画関数を返す。
 * `scale` は composeThumbnailBlob が渡す「出力長辺 / 1200」で、通常 1。
 * S = TARGET_WIDTH / referenceCardWidth（1200 / 506）を掛けた寸法で描く。
 */
export const drawVideoOverlay =
  (durationSec: number) =>
  (context: CanvasRenderingContext2D, scale: number): void => {
    const s = (TARGET_WIDTH / VIDEO_OVERLAY_SPEC.referenceCardWidth) * scale
    const width = TARGET_WIDTH * scale
    const height = TARGET_HEIGHT * scale
    // 1. 円: 中心 (width/2, height/2)、半径 buttonDiameter*s/2、fill buttonFill
    // 2. 三角: 外接矩形の中心 = (cx + triangleOffsetX*s, cy)。頂点 (x0,y0),(x0,y0+H),(x0+W,y0+H/2)、fill triangleFill
    // 3. バッジ文字: font = `${badgeFontWeight} ${badgeFontSize*s}px sans-serif`、
    //    textWidth = measureText(formatVideoDuration(durationSec)).width
    //    バッジ幅 = textWidth + 2*badgePaddingX*s、高さ = badgeHeight*s
    //    左 = badgeMarginLeft*s、下端 = height - badgeMarginBottom*s
    //    角丸矩形（badgeRadius*s）を badgeFill で塗り、文字を badgeTextColor で
    //    textAlign="center"・textBaseline="middle" としてバッジ中央に描く
  }
```

`src/lib/image/postImageProcessing.ts` を次のように拡張する（既存の呼び出しは第2引数なしで従来どおり動く）。

```ts
export type CompositeOverlay = (
  context: CanvasRenderingContext2D,
  scale: number,
) => void

const composeThumbnailBlob = async (
  imageUrls,
  cropStates,
  overlay?: CompositeOverlay,
) => {
  // … renderComposite 内、slotDefs.forEach の描画の直後に:
  overlay?.(context, scale)
  // compressToByteBudget は従来どおり。オーバーレイ込みで容量予算に収める
}
export const createDefaultThumbnail = async (
  imageUrls: string[],
  overlay?: CompositeOverlay,
): Promise<Blob> => {
  // … composeThumbnailBlob(targetUrls, cropStates, overlay)
}
```

オーバーレイは `compressToByteBudget` の縮小描画（`renderComposite(longSide)`）の度に `scale` 付きで再描画されるため、容量予算のために縮小された場合も、比率が保たれる。

## 7. フロントエンド：表示

### 7.1 `VideoPlayer`（`src/components/video/VideoPlayer/index.tsx`・`index.module.css`）

props: `{ video: SourceVideo; postUrl?: string }`。

```
初期: <button> に poster（<img src=thumbnailUrl alt=alt>）と、中央に VideoPlayButton（§6.5.2 と同一の見た目）を重ねて表示。
      コンテナに aspect-ratio（video.aspectRatio があればその比、無ければ 16/9）を指定。
      <button aria-label={t("video.play")}>。キーボード操作は <button> の既定動作。
クリック時 start():
  videoEl = <video controls playsInline poster=thumbnailUrl>
  const { default: Hls } = await import("hls.js")
  if (Hls.isSupported()) {
      hls = new Hls(); hls.loadSource(playlistUrl); hls.attachMedia(videoEl)
      hls.on(Hls.Events.ERROR, (_, d) => d.fatal && setError())
  } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) videoEl.src = playlistUrl   // MSE 非対応環境（iOS Safari 等）
  else → error
  videoEl の `error` イベントも setError() に結びつける（ネイティブ再生の失敗用）
  await videoEl.play()（自動再生ブロック時は controls で再生可能）
unmount: hls?.destroy()
エラー時: t("video.playError") と postUrl への外部リンクを表示
```

`<video>` は再生開始前に DOM へ作らない（NFR-3、AC-7: poster 画像以外は取得しない）。`hls.js` は `package.json` の dependencies に追加する。

### 7.2 `VideoThumbnail`（`src/components/video/VideoThumbnail/index.tsx`・`index.module.css`）

Timeline 用の静的表示。`<img src=thumbnailUrl alt=alt>` の中央に `VideoPlayButton`（装飾、`aria-hidden`）を重ねる。インタラクションを持たない。再生時間は取得できないため、再生時間バッジは表示しない。縦横比は `VideoPlayer` と同じ規則。

### 7.3 `PostBody`（`src/components/post/PostBody/index.tsx`）

`video?: SourceVideo`・`unsupportedVideo?: SourceVideo`・`unsupportedVideoLinkUrl?: string`・`videoInteractive?: boolean`（既定 `true`）を追加する。`unsupportedVideoLinkUrl` は、`postUrl`（日時リンク用で、Timeline では渡されない）とは独立した、利用不可表示のリンク先（元の Bluesky 投稿の URL）。

```tsx
{video ? (
    videoInteractive ? <VideoPlayer video={video} postUrl={postUrl} /> : <VideoThumbnail video={video} />
) : unsupportedVideo ? (
    <VideoUnavailable video={unsupportedVideo} postUrl={unsupportedVideoLinkUrl} />
) : images.length > 0 ? (<ImageGallery …/>) : null}
```

- Entry 詳細ページ（`EntryDetailView`）は `video` をそのまま渡す（`videoInteractive` 既定の `true`）。
- Timeline（`PostCard`）は `videoInteractive={false}` を渡す。

### 7.4 Timeline（`PostCard`・`ThreadCard`）

- `PostCard`: `item.video` または `item.unsupportedVideo` がある場合は `galleryImages = []`（entry の visual は表示せず、動画のサムネイルまたは利用不可表示を出す）。`PostBody` に `video={item.video}`・`unsupportedVideo={item.unsupportedVideo}`・`videoInteractive={false}`・`unsupportedVideoLinkUrl={item.url}` を渡す。
- `isSkyshareIneligible`（グレーアウト）の判定は、`useSkyshareEntryStatus` が `hasEntryMedia` を使うため、動画投稿は対象外にならず、`unsupportedVideo` のみを持つ投稿は対象外（グレーアウト、作成ボタン無効）になる。
- `entryCandidate.ts` の `resolveEntryVisualSourcePost`: 画像の有無の判定を `hasEntryMedia(post)` に置き換える（ルート → ルートに最も近い replies の順）。

### 7.5 既存動画投稿からの entry 事後作成（`useSkyshareEntryStatus.ts`）

- `hasImages` を `hasEntryMedia(visualSource)` に変更する。
- visual の素材取得: `visualSource.video` がある場合は、`fetch(video.thumbnailUrl)`（CORS `*`）で Blob を取得し、object URL を `createDefaultThumbnail([url])` に渡す。画像の場合は従来どおり `getBskyImage`（同一オリジンプロキシ）経由。取得失敗は既存の `createError` の経路（`setCreateError("post.entry.createFailed")`）で扱う。
- 再生時間バッジに使う動画の長さは、HLS プレイリストから取得する（投稿レコードには長さが無いため）。`src/lib/video/fetchVideoDuration.ts`:

```ts
/**
 * マスタープレイリスト（playlistUrl）を取得し、最初のバリアントのメディアプレイリストの
 * `#EXTINF:<秒>,` の合計を返す。いずれかの取得失敗・EXTINF が1件も無い・合計が 0 以下の
 * 場合は Error を throw する（呼び出し側が entry 作成を失敗させる。要件 FR-5）。
 */
export const fetchVideoDurationSec = async (
  playlistUrl: string,
): Promise<number> => {
  const master = await (await fetchOk(playlistUrl)).text()
  const variant = master
    .split("\n")
    .find(line => line !== "" && !line.startsWith("#"))
  if (!variant) throw new Error("no variant playlist")
  const media = await (await fetchOk(new URL(variant, playlistUrl).href)).text()
  const total = [...media.matchAll(/^#EXTINF:([0-9.]+)/gm)].reduce(
    (sum, m) => sum + Number(m[1]),
    0,
  )
  if (!(total > 0)) throw new Error("no segment duration")
  return total
}
```

`createEntryFromPost` は、`visualSource.video` がある場合、`fetchVideoDurationSec(video.playlistUrl)` と poster 取得を並行して行い、`createDefaultThumbnail([posterUrl], drawVideoOverlay(durationSec))` に渡す。どちらかが throw したら既存の `setCreateError("post.entry.createFailed")` の経路で失敗とし、`createEntry` API は呼ばない。

- `createDefaultThumbnail` は `<img>` を object URL から読み込むため、`thumbnail.jpg` の `content-type` が `application/octet-stream` であっても、`fetch` した Blob の `type` が空の場合は `new Blob([blob], { type: "image/jpeg" })` に作り直して渡す。

### 7.6 ゲスト・サンプル

- `src/lib/entry/guestDummyPosts.ts` に、動画投稿のダミー投稿を1件追加する（`video` に `SourceVideo`。`thumbnailUrl` は `public/` 配下の静的画像、`playlistUrl` はサンプルEntryページ用の値）。
- `src/pages/entries/sample.astro` 系のサンプルに、動画付き投稿を1件含める。サンプルの再生URLは、`playlistUrl` が存在しない場合でもページが壊れない（再生に失敗しエラー表示になる）。E2E ではネットワークをモックする（§10）。

### 7.7 `VideoUnavailable`（`src/components/video/VideoUnavailable/index.tsx`・`index.module.css`）

props: `{ video: SourceVideo; postUrl?: string }`。利用不可の動画（要件 FR-8）の表示専用部品で、インタラクション（再生）を持たない。

- コンテナは `VideoThumbnail` と同じ規則の `aspect-ratio`。`<img src=thumbnailUrl alt=alt>` を `filter: brightness(0.35)` で暗くし、その上に `rgba(0,0,0,0.45)` の面を重ねる（合計の暗さで、文言の白文字が読めること）。
- 中央に、文言 `t("video.unavailable.title")`（白、`font-weight: 700`）と、`postUrl` があるとき `<a href={postUrl} target="_blank" rel="noopener noreferrer">{t("video.unavailable.link")}</a>`（白、下線）を縦に並べる。`postUrl` が無い場合はリンクを出さない。
- `VideoPlayButton` は置かない。`<button>` を使わず、再生に関わる操作要素を一切持たない。
- リンク先は `PostBody` の `unsupportedVideoLinkUrl`（Timeline は `TimelinePost.url`、Entry 詳細ページは `EntryPostView.webUrl`）。

## 8. 非機能要件の実現

| 要件  | 実現方法                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-1 | 動画のバイト列は `video.bsky.app` へのみ送信。`POST /v2/entry` のボディには blob 参照 JSON のみ（AC-9 は E2E でリクエストを検査）。                                            |
| NFR-2 | `lxm=com.atproto.repo.uploadBlob` かつ `exp` 30 分のトークン。レスポンスは `no-store`。サーバー・クライアントともトークンをログ出力しない。                                    |
| NFR-3 | `hls.js` は `VideoPlayer.start()` 内の動的 import のみ。初期表示は poster `<img>` のみ。                                                                                       |
| NFR-4 | 再生開始は `<button aria-label>`、進捗は `role="progressbar"`、再生中は `<video controls>` のネイティブ操作。                                                                  |
| NFR-5 | `src/lib/i18n/messages/{ja,en}/video.ts` を新設し `index.ts` に登録（§9）。                                                                                                    |
| NFR-6 | hls.js（MSE）を優先し、MSE が使えない環境（iOS Safari 等）はネイティブHLS。Chromium は近年ネイティブHLSも報告するため、`canPlayType` ではなく `Hls.isSupported()` で分岐する。 |
| NFR-7 | 動画のエラーは `VideoEntry.upload.state="error"` に閉じ、segment の他の入力に触れない。投稿失敗時は既存どおり入力を保持。                                                      |

## 9. i18n キー（`src/lib/i18n/messages/{ja,en}/video.ts`）

`video.picker.add`（動画を追加）、`video.picker.addAria`（動画追加ボタンの `aria-label`）、`video.picker.remove`、`video.picker.reselect`、`video.picker.altLabel`、`video.picker.exclusiveWithImage`、`video.picker.exclusiveWithOgp`、`video.picker.exclusiveWithVideo`、`video.status.uploading`、`video.status.processing`、`video.status.done`、`video.submit.waitUpload`、`video.submit.removeFailed`、`video.play`、`video.playError`、`video.unavailable.title`（「Skyshareでは再生できません」）、`video.unavailable.link`（「Blueskyで見る」）、および `video.error.*`（§5.4 の14種）。`video.thumbnail.badge` は使わない（再生ボタンは装飾のため）。ja・en で同一キー集合とする（`tests/lib/i18n/messages.test.ts` と `noHardcodedText.test.ts` の対象に含める）。

## 10. テスト方針

- 単体（vitest）: `probeVideo`（モックの `HTMLVideoElement`）、`validateVideoFile`、`uploadVideo`（`fetch` のフェイク。正常系・パートの再試行・`startUpload` 各エラー・`FAILED`・timeout・中断時の `abortUpload`・トークン再取得）、`createVideoUploadToken`/`isSupportedVideoPds`、`createVideoEmbed`、スキーマ（動画分岐の成功・画像併用の失敗・サイズ超過の失敗）、`extractEmbedVideo`/`buildVideoUrls`、ルートハンドラ（`/v2/entry` が `app.bsky.embed.video` を載せること、`upload-token` の 200/400/401/500）。
- 単体: `formatVideoDuration`（5→`0:05`、59.6→`1:00`、0→`0:01`、600→`10:00`）、`VIDEO_OVERLAY_SPEC` の値、`fetchVideoDurationSec`（マスター → バリアント → EXTINF 合計、取得失敗・EXTINF なしで throw）、`extractUnsupportedEmbedVideo`、`composeThumbnailBlob` が `overlay` を `scale` 付きで呼ぶこと。
- E2E（Playwright）: `video.bsky.app` へのリクエスト（`startUpload`/`uploadPart`/`finishUpload`/`getJobStatus`、プレイリスト、セグメント、サムネイル）を `page.route` でモックする。固定の小さな mp4（`tests/fixtures/video-sample.mp4`、約 80KB）を `setInputFiles` で選択する。
- 手動（実アカウント）: Bluesky 公式アプリでの表示、既存の動画投稿からの entry 事後作成、300MB 級の実ファイルでの所要時間・トークン再発行。
