# 複数画像（5枚以上）添付 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

## 1. 全体方針

- 画像枚数に関する定数を `src/lib/image/postImageLimits.ts` に集約し、フロント・API・スキーマが同じ値を参照する。
- 投稿embedは枚数で型を切り替える（1〜4枚: `app.bsky.embed.images`、5〜10枚: `app.bsky.embed.gallery`）。
- visual は「先頭4枚の合成」に統一する。合成処理（`getSlotDefs`・`composeThumbnailBlob`）は最大4枚前提の現行ロジックを維持し、呼び出し側で先頭4枚に切り詰めて渡す。
- 投稿に添付する元画像（`originalBlobs`）の生成は、visual の合成とは独立させ、全画像（最大10枚）に対して行う。

## 2. 前提パッケージ・サブモジュール

- `atproto` サブモジュール（lexicon 参照用）は最新タグ `@atproto/lexicon@0.7.16`（`@atproto/api@0.23.0` と同一コミット `a7c8604d8`）を指す。`.gitmodules` の `branch` もこのタグへ更新する。`gallery` lexicon はこのコミットに含まれる。
- `package.json` の `@atproto/api` を `^0.23.0` へ更新する。`AppBskyEmbedGallery` 型と、`app.bsky.feed.post` の `embed` union への `gallery` 追加が入るため。

## 3. 定数（`src/lib/image/postImageLimits.ts`）

```ts
/** 1投稿に添付できる画像の最大枚数（gallery のクライアント運用上限） */
export const MAX_POST_IMAGES = 10
/** `app.bsky.embed.images` で投稿できる最大枚数。これを超えると gallery を使う */
export const MAX_IMAGES_EMBED = 4
/** visual の合成素材とする先頭からの枚数 */
export const VISUAL_IMAGE_COUNT = 4
```

## 4. バックエンド

### 4.1 スキーマ（`src/lib/api/schema/v2/entry/post.ts`）

`EntryPostItemSchema` の3分岐すべての `images` / `imagesMeta` に `.max(MAX_POST_IMAGES)` を付与する（`z.array(imageField).max(MAX_POST_IMAGES)`、`Common.CommonImagesMetaSchema` 自体に `.max(MAX_POST_IMAGES)` を付ける）。違反は既存の `safeParse` 失敗経路で400になる。`npm run codegen` で OpenAPI ドキュメントとクライアント（`src/client/openapi/`）を再生成する。

### 4.2 embed 組み立て（`src/lib/atproto/embed.ts`）

`createImageEmbed(uploadedBlobs, metadata)` を枚数分岐に拡張する。

```ts
export const createImageEmbed = (uploadedBlobs, metadata) => {
  const entries = uploadedBlobs.map((blob, idx) => ({
    image: blob,
    alt: metadata?.[idx]?.alt ?? "",
    aspectRatio:
      metadata?.[idx]?.width && metadata?.[idx]?.height
        ? { width: metadata[idx].width, height: metadata[idx].height }
        : undefined,
  }))
  if (entries.length <= MAX_IMAGES_EMBED) {
    return { $type: "app.bsky.embed.images" as const, images: entries }
  }
  // gallery は aspectRatio 必須。imagesMeta は width/height が必須(min 1)なので常に存在する。
  return {
    $type: "app.bsky.embed.gallery" as const,
    items: entries.map(e => ({
      $type: "app.bsky.embed.gallery#image" as const,
      ...e,
    })),
  }
}
```

`validateImageMetadata` に `images.length > MAX_POST_IMAGES` の場合の Error を追加する（スキーマを通過しない内部呼び出しへの防御。呼び出し元の `src/pages/v2/entry.ts` が catch して400を返す既存経路を使う）。

### 4.3 画像のアップロード（`src/pages/v2/entry.ts`）

既存の `item.images.map(image => uploadBlob(agent, image))` による並列アップロードをそのまま使い、全画像（最大10枚）を処理する。embed への渡し方のみ 4.2 に従う。

### 4.4 既存投稿からの画像抽出（`src/lib/entry/entry.ts`・`src/lib/entry/posts.ts`）

現状は `extractSourceImages`（entry.ts）と `extractTimelinePostImages`（posts.ts）が、それぞれ `app.bsky.embed.images` のみを解釈している。両者の重複を解消し、`entry.ts` の共通関数に統一する。

```ts
// embed の $type に応じて { url, alt, cid }[] を返す。未対応の $type は []。
export const extractEmbedImages = (embed, repoDid): SourceImage[] => {
  switch (embed?.$type) {
    case "app.bsky.embed.images":
      return toSourceImages(embed.images, repoDid)
    case "app.bsky.embed.gallery":
      return toSourceImages(
        embed.items.filter(i => i.$type === "app.bsky.embed.gallery#image"),
        repoDid,
      )
    default:
      return []
  }
}
```

- `toSourceImages` は `img.image`（blob）から `blobToCdnUrl`・`toCidString` で url/cid を作り、どちらかが得られない要素は除外する（現行ロジックの抽出）。
- `extractSourceImages` と `extractTimelinePostImages` は `extractEmbedImages` を呼ぶ薄いラッパーにする（`extractTimelinePostImages` の `postRecord.embed` 取り出しはそこで行う）。
- gallery の items のうち未知の `$type`（将来追加されるメディア種別）は除外する。

## 5. フロントエンド

### 5.1 画像処理（`src/lib/image/postImageProcessing.ts`）

- `getSlotDefs(count)` は `Math.min(VISUAL_IMAGE_COUNT, ...)` で上限を丸める現行挙動を維持する（スロット定義は最大4個）。
- `createProcessedImages(imageUrls, cropStates)` を次のように変更する。

```ts
export const createProcessedImages = async (imageUrls, cropStates) => {
    const visualUrls = imageUrls.slice(0, VISUAL_IMAGE_COUNT)
    const [{ thumbnailBlob }, sourceBlobs, loadedImages] = await Promise.all([
        composeThumbnailBlob(visualUrls, cropStates.slice(0, VISUAL_IMAGE_COUNT)),
        Promise.all(imageUrls.map(url => fetch(url).then(res => res.blob()))),
        Promise.all(imageUrls.map(url => loadImage(url))),
    ])
    // originalBlobs は全画像分。canUsePostImageAsIs なら元Blob、そうでなければ compressToByteBudget（現行どおり）
    const originalBlobs = await Promise.all(loadedImages.map((image, i) => /* 現行ロジック */))
    return { originalBlobs, thumbnailBlob }
}
```

従来 `composeThumbnailBlob` が返していた `images`（読み込み済み要素）は、先頭4枚のみのため使わず、全画像の読み込みを `createProcessedImages` 側で行う。`composeThumbnailBlob`・`createDefaultThumbnail` の「5枚以上は先頭4枚のみ使用」という挙動は維持する。

### 5.2 ImagePicker（`src/components/image/ImagePicker/index.tsx`）

- スロット上限をリテラル `4` から `MAX_POST_IMAGES` へ変更する（`addFiles` の `allowed` 計算、`slice(0, 4)` の2箇所）。
- `addFiles` 内の `defs[idx]` は idx ≥ 4 で `undefined` になるため、次のように分岐する。

```ts
const def = defs[idx] // idx >= VISUAL_IMAGE_COUNT なら undefined
const cropPixels = def
  ? computeInitialCrop(size.width, size.height, def.w, def.h)
  : null
```

5枚目以降のスロットは `cropState.cropPixels = null` のままとし、visual のクロップ対象に含めない。`normalizeSlotsForLayout` は既に `!def` のスロットをそのまま返すため変更不要。

- 上限を超えて切り詰めた場合（`newFiles.length > allowed`）、`ImagePicker` 内に通知文言「画像は最大10枚までです。超過分は追加されませんでした」を表示する状態（`overflowNotice`）を持つ。次の追加操作・削除操作で消す。
- プレビューでは `index >= VISUAL_IMAGE_COUNT` のスロットのサムネイルに「Visual対象外」ラベルを重ねる（`index.module.css` に `slot-excluded-badge` を追加）。
- `createEntryFromSlots` は `createProcessedImages` に全スロットの `objectUrl` / `cropState` を渡す（5.1が先頭4枚への切り詰めを担う）。
- `ImageEntry.meta` / `originalBlobs` / `originalPreviews` / `sourceFileNames` は全枚数分を持つ。

### 5.3 ImageCropDialog（`src/components/image/ImageCropDialog/index.tsx`）

- `ImagePicker` からは `imageUrls.slice(0, VISUAL_IMAGE_COUNT)` と `initialCropStates.slice(0, VISUAL_IMAGE_COUNT)` のみを渡す。
- ダイアログ内の `Math.min(4, ...)` は `Math.min(VISUAL_IMAGE_COUNT, ...)` に置換する。
- ダイアログの確定結果（先頭4枚分の `SlotCropState[]`）は、`ImagePicker` 側で既存スロットの先頭4件にのみマージし、5枚目以降の `cropState` は変更しない。

### 5.4 送信（`src/components/post/ThreadComposer/submitThread.ts`）

`post.images = imageEntry.originalBlobs` / `resolveImageMetadata(imageEntry)` は枚数非依存のため、ロジック変更は無い。`thumbnailBlob`（visual）は5.1により先頭4枚由来であり、トップレベル `visual` への設定方法も変更しない。

### 5.5 既存投稿からのentry事後作成（`src/components/post/PostCard/useSkyshareEntryStatus.ts`）

`GET /v2/bsky/images` で取得する対象を、visual取得元投稿の `images.slice(0, VISUAL_IMAGE_COUNT)` のみにする（5枚目以降はフェッチもしない）。`createDefaultThumbnail(objectUrls)` へは先頭4枚分の Blob URL だけが渡る。

### 5.6 カード表示（`src/components/post/PostCard/index.tsx`）

`thumbnailImages` は、entry の `visualUrl` があれば従来どおり1枚、無い場合は `item.images` の先頭4枚（`slice(0, VISUAL_IMAGE_COUNT)`）を縦分割で表示し、5枚以上の場合は残り枚数 `+N` をサムネイル領域の右下に重ねて表示する（`index.module.css` に `thumbnail-more` を追加）。`DeletePostListItem` は既存どおり先頭4枚＋`+N`（変更なし）。

### 5.7 entry詳細・スレッド表示

`entries/[slug].astro` が呼ぶ `extractSourceImages` は4.4の共通関数により gallery も返す。`EntryDetailView` / `EntryThreadView` は渡された `sourceImages` / `post.images` を件数に依存せずループ描画する現行実装のまま、10枚分を描画する。

## 6. テスト方針

- 単体（vitest）: `embed.ts`（4枚→images型、5/10枚→gallery型、altと aspectRatio の保持、11枚で `validateImageMetadata` が throw）、`entry.ts`/`posts.ts`（images/gallery 両embedからの抽出、未知 `$type` の除外）、スキーマ（11枚で失敗、10枚で成功）、`createProcessedImages`（5枚入力で `originalBlobs` が5件、`composeThumbnailBlob` へ渡る URL が先頭4件）。
- API（`tests/pages/v2/entry.test.ts`）: 5枚投稿で `applyWrites` の record の embed が gallery、4枚で images、11枚で400。
- E2E（Playwright、`tests/e2e/`）: 投稿フォームで11枚アップロード→10枚で止まり通知が出る、5枚目以降に「Visual対象外」ラベル、クロップダイアログが4スロット、ゲストの5枚以上フィクスチャのカードに `+N`。
