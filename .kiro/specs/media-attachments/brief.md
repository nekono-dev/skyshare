# Brief: media-attachments

## Problem

投稿に添付する画像と動画は、サイズ・枚数・長さの上限、加工（切り抜き・圧縮）、代替テキストの規則が多い。動画はブラウザから Bluesky の動画サービスへ直接送るため、サーバーの役割は限られる。規則が散らばると、投稿の検証と表示がずれる。

## Current State

- 画像の部品: `src/components/image/`（`ImagePicker`・`CropSlot`・`ImageCropDialog`・`ImageAltDialog`・`ImageGallery`・`ImageLightbox`・`ThumbnailAdjustButton`。`OgpFetchButton`・`OgpPreview` はリンクカードとして post-composition が所有する）。
- 画像の処理: `src/lib/image/`（`postImageProcessing.ts`: OGP 仕様 1200×630 のスロットと中央基準の切り抜き、バイト予算内の PNG 優先の圧縮、JPEG の二分探索。`postImageLimits.ts`: 枚数の上限）。`galleryLayout.ts`・`croppedImageStyle.ts`。
- 画像の配信: `GET /v2/bsky/images`（`src/pages/v2/bsky/images.ts`）。Cookie のセッションを確かめ、PDS の blob をそのまま返す（cdn.bsky.app は CORS を返さないため）。
- 動画: `src/components/video/`（`VideoPicker`・`VideoPlayer`・`VideoThumbnail`・`VideoPlayButton`・`VideoUnavailable`）、`src/lib/video/`（`videoUploader.ts`: `startUpload`→`uploadPart`→`finishUpload`→`getJobStatus`、`probeVideo.ts`・`fetchVideoDuration.ts`・`formatVideoDuration.ts`・`videoOverlay.ts`・`postVideoLimits.ts`・`videoErrors.ts`）。
- サービス認証: `POST /v2/bsky/video/upload-token`（`src/pages/v2/bsky/video/upload-token.ts`）と `src/lib/atproto/videoAuth.ts`。対応する PDS は Bluesky 公式のホスティングのみ。トークンはログに出さず、キャッシュもさせない。
- `src/util/waitForImageLoad.ts`: 画像の読み込み待ち。
- 利用者: `lib/entry/createPostVisual.ts` が動画の再生時間と overlay を使う（entry-sharing）。

## Desired Outcome

- 画像と動画の上限（枚数・容量・長さ）と、その検証の規則が記録されている。
- 加工の規則（切り抜き・圧縮・バイト予算）と代替テキストの扱いが記録されている。
- 動画の直接アップロードの流れ（ブラウザ → 動画サービス）と、トークンの扱いが記録されている。

## Approach

添付メディアの処理と配信を所有する。投稿の中での添付（どの枠に何を入れるか）は post-composition が所有する。

## Scope

- **In**: 画像の選択・切り抜き・圧縮・代替テキスト、動画の選択・上限・アップロード・変換の待機、画像の配信、動画のトークン、表示部品。
- **Out**: 投稿の組み立てと送信（post-composition）、Entry の画像の合成（entry-sharing）、リンクカード（post-composition）、動画サービスの内部。

## Boundary Candidates

- 画像の処理（lib/image/・ImagePicker・CropSlot・ImageCropDialog・ImageAltDialog）
- 画像の表示と配信（ImageGallery・ImageLightbox・v2/bsky/images.ts）
- 動画の処理と配信（lib/video/・components/video/・v2/bsky/video/・videoAuth.ts）

## Out of Boundary

- 投稿の組み立て、Entry の画像の合成、リンクカード、動画サービス

## Upstream / Downstream

- **Upstream**: session-accounts（配信の認証）、api-contract、atproto-records（blob・動画の埋め込み）、i18n、ui-primitives。
- **Downstream**: post-composition、entry-sharing、timeline-browsing（表示）、scheduled-posting（予約の画像）。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: post-composition（添付）、entry-sharing（動画の情報と画像の合成）。

## Constraints

- 動画のトークンはログに出さず、キャッシュさせない。
- 画像の上限は一つの定数ファイル（`postImageLimits.ts`）を参照させる。
- 既知の不一致: `lib/entry` が `lib/video` の関数を直接使う（entry-sharing との境界）。
