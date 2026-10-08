# 動画のアップロード 設計書

## 1. 構成

| パス                                                    | 責務                           |
| ------------------------------------------------------- | ------------------------------ |
| `src/lib/video/postVideoLimits.ts`                      | 動画の上限と動画サービスの定数 |
| `src/lib/atproto/videoAuth.ts`                          | 対応PDSの判定とトークンの発行  |
| `src/pages/v2/bsky/video/upload-token.ts`               | トークン発行のハンドラ         |
| `src/lib/api/schema/v2/bsky/video/upload-token/post.ts` | トークン発行の応答のスキーマ   |
| `src/lib/video/videoUploadToken.ts`                     | クライアントのトークンの取得   |
| `src/lib/video/videoUploader.ts`                        | 分割アップロードと変換の待機   |
| `src/lib/video/videoErrors.ts`                          | 失敗の分類と文言キーの対応     |
| `src/lib/atproto/embed.ts`                              | 動画の埋め込みの組み立て       |
| `src/lib/api/schema/v2/entry/post.ts`                   | 投稿の動画の分岐               |

## 2. 設計項目

### D-1: トークンの発行 (FR-1, FR-2, NFR-2)

```ts
export const isSupportedVideoPds = (pdsUrl: string): boolean => {
  const host = new URL(pdsUrl).host
  return host === "bsky.social" || host.endsWith(".host.bsky.network")
}
export const createVideoUploadToken = async (agent, session, nowSec) => {
  const pdsUrl =
    readPdsServiceFromDidDoc(session.didDoc) ??
    (await resolvePdsServiceForDid(session.did))
  if (!pdsUrl) return { ok: false, status: 500 }
  if (!isSupportedVideoPds(pdsUrl)) return { ok: false, status: 400 }
  const expiresAt = nowSec + VIDEO_UPLOAD_TOKEN_TTL_SEC // 30 * 60
  const res = await agent.com.atproto.server.getServiceAuth({
    aud: `did:web:${new URL(pdsUrl).host}`,
    lxm: "com.atproto.repo.uploadBlob",
    exp: expiresAt,
  }) // 失敗は 500。トークンをログに出さない
  return { ok: true, token: res.data.token, did: session.did, expiresAt }
}
// POST /v2/bsky/video/upload-token → 200 { token, did, expiresAt }（Cache-Control: no-store）
```

`aud` を動画サービスにする組み合わせは動画サービスが401で拒否するため、利用者のPDSを `aud` にする。

### D-2: 分割アップロード (FR-3, FR-4, FR-5, FR-6, FR-8, NFR-1)

```
getToken = expiresAt - now < 5分 なら fetchToken() で再取得する
1. POST {video.bsky.app/xrpc}/app.bsky.video.startUpload
     { sizeBytes, mimeType, name, durationMs, width, height }（Bearer トークン）
2. partNumber = 1..partCount を順に uploadPart（octet-stream、毎回 getToken()）
     通信エラー・5xx・429 だけを 1s, 2s, 4s 待って最大3回再試行。他の 4xx は即失敗
     成功ごとに onProgress({ phase: "uploading", percent: 送信済み / 全体 * 100 })
3. finishUpload { jobId }（通信エラーは1回だけ再試行）
4. 1.5秒ごとに getJobStatus（認証なし）を問い合わせ、20分で timeout
     COMPLETED → blob を CommonVideoBlobSchema で検証して返す（不正なら unknown）
     FAILED → processingFailed、それ以外 → onProgress({ phase: "processing", percent })
5. 中断: finishUpload の前なら abortUpload を1回だけ要求して AbortError、後なら放置
```

### D-3: 失敗の分類 (FR-7)

| 発生源                                                                     | 分類                                         |
| -------------------------------------------------------------------------- | -------------------------------------------- |
| `startUpload` の `VideoTooLarge` / `BadAspectRatio` / `DailyLimitExceeded` | `tooLarge` / `badAspectRatio` / `dailyLimit` |
| `startUpload` の `UploadForbidden` / `TooManyOpenUploads`                  | `forbidden` / `tooManyUploads`               |
| `ServiceOverloaded`                                                        | `overloaded`                                 |
| `JOB_STATE_FAILED` / 待機の上限超過                                        | `processingFailed` / `timeout`               |
| トークン発行の400 / 再試行後の通信例外                                     | `unsupportedPds` / `network`                 |
| 上記以外                                                                   | `unknown`                                    |

`mapServiceErrorName` が応答の `error` 名から分類し、`mapVideoError(code)` が `video.error.*` の文言キーを返す。

### D-4: 投稿への埋め込み (FR-9, FR-10, FR-11)

```ts
// EntryPostItemSchema の4つ目の分岐（.strict()。images・ogImage・ogMeta を持たない）
z.object({
  text,
  facets,
  video: Common.CommonVideoBlobSchema,
  videoMeta: Common.CommonVideoMetaSchema,
  langs,
  selfLabels,
  gate,
}).strict()
export const createVideoEmbed = (video, meta) => ({
  $type: "app.bsky.embed.video" as const,
  video,
  alt: meta.alt ?? "",
  aspectRatio: { width: meta.width, height: meta.height },
})
```

ハンドラは埋め込みを動画・画像・リンクカードの順に判定し、動画は送信済みのため `uploadBlob` を呼ばない。

## 3. エラー処理

| 事象                                | 処理 |
| ----------------------------------- | ---- |
| PDSを解決できない・認証の要求の失敗 | 500  |
| 対応外のPDS                         | 400  |
| 未認証                              | 401  |
