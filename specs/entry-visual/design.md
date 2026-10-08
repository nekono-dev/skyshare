# entryの代表画像と見出し 設計書

## 1. 構成

| パス                                                   | 責務                             |
| ------------------------------------------------------ | -------------------------------- |
| `src/lib/image/postImageProcessing.ts`                 | 区画の定義・切り抜き・合成・圧縮 |
| `src/lib/video/videoOverlay.ts`                        | 代表画像の再生ボタンの寸法と描画 |
| `src/lib/video/formatVideoDuration.ts`                 | 再生時間の整形                   |
| `src/lib/video/fetchVideoDuration.ts`                  | 既存の動画の再生時間の取得       |
| `src/lib/entry/entryText.ts`                           | 見出しと説明文の生成             |
| `src/lib/entry/createPostVisual.ts`                    | 既存の投稿からの代表画像の生成   |
| `src/components/image/ThumbnailAdjustButton/index.tsx` | サムネ調整のボタン               |
| `src/components/image/ImageCropDialog/index.tsx`       | 切り抜きの調整の画面             |

## 2. 設計項目

### D-1: 合成 (FR-1, FR-2)

```ts
export const VISUAL_IMAGE_COUNT = 4
export const getSlotDefs = (count: number): SlotDef[] // min(4, count) 個。1:全面 2:左右 3:左1+右2 4:2×2
export type CompositeOverlay = (context: CanvasRenderingContext2D, scale: number) => void
export const createProcessedImages = async (imageUrls, cropStates) => {
  // 代表画像は先頭 VISUAL_IMAGE_COUNT 枚、投稿用の画像は全枚数を処理する
  const { thumbnailBlob } = await composeThumbnailBlob(imageUrls.slice(0, 4), cropStates.slice(0, 4))
  return { originalBlobs, thumbnailBlob }
}
export const createDefaultThumbnail = async (imageUrls: string[], overlay?: CompositeOverlay): Promise<Blob>
export const createCroppedThumbnail = async (imageUrls, cropStates, overlay?: CompositeOverlay): Promise<Blob>
```

出力は `TARGET_WIDTH` × `TARGET_HEIGHT`（1200×630）とし、容量の予算に収まるまで縮小して描き直す。`overlay` は描き直しのたびに `scale`（出力の長辺 / 1200）付きで呼ぶ。

### D-2: 再生ボタン (FR-3, FR-4, NFR-1)

```ts
export const VIDEO_OVERLAY_SPEC = {
  buttonDiameter: 59,
  buttonFill: "rgba(50, 50, 50, 0.6)",
  triangleWidth: 20,
  triangleHeight: 25,
  triangleFill: "#ffffff",
  triangleOffsetX: 2.5,
  referenceCardWidth: 506,
} as const
export const drawVideoOverlay =
  () =>
  (context: CanvasRenderingContext2D, scale: number): void => {
    const s = (TARGET_WIDTH / VIDEO_OVERLAY_SPEC.referenceCardWidth) * scale
    // 円: 中心 (width/2, height/2)、半径 buttonDiameter * s / 2
    // 三角: 外接矩形の中心を円の中心から右へ triangleOffsetX * s。頂点 (x0, y0), (x0, y0 + H), (x0 + W, y0 + H / 2)
  }
```

| 要素                          | 代表画像（1200×630）上の寸法 |
| ----------------------------- | ---------------------------- |
| 円の直径                      | 139.9px                      |
| 再生記号の幅×高さ・右へのずれ | 47.4 × 59.3px・5.9px         |

数値は、XのDPR 2のスクリーンショットの実測値を2で割ったCSS pxである。

### D-3: サムネ調整 (FR-5, FR-6, FR-7)

```ts
export type ImagePickerHandle = {
  addFiles: (files: File[]) => void | Promise<void>
  openCropDialog: () => void
}
export type VideoPickerHandle = { openCropDialog: () => void }
const onAdjustThumbnail = () =>
  segment.videoEntry
    ? videoPickerRef.current?.openCropDialog()
    : imagePickerRef.current?.openCropDialog()
// ThumbnailAdjustButton は imageEntry か videoEntry があるときだけ、動画の追加ボタンの後に描画する
// ImageCropDialog.handleConfirm:
//   overlay があれば createCroppedThumbnail(imageUrls, cropStates, overlay) だけを作り onConfirm([], blob, states)
//   無ければ createProcessedImages(imageUrls, cropStates)
```

- 画像は `imageUrls.slice(0, 4)` と先頭4件の切り抜きだけを渡し、確定結果を先頭4件にだけ反映する。
- 動画は `[posterPreview]` と `overlay={drawVideoOverlay()}` を渡す。調整の画面は overlay を描かず、確定時の生成にだけ使う。
- 動画の初期の切り抜きは `computeInitialCrop` の既定の配置とし、`createDefaultThumbnail` の結果と一致させる。

### D-4: 見出しと既存の投稿 (FR-8, FR-9, FR-10)

```ts
export const formatVideoDuration = (sec: number): string // 四捨五入、最小 0:01、1時間以上は h:mm:ss
export const buildEntryText = ({ userName, postText, videoDurationSec }) => ({
  heading: videoDurationSec !== undefined ? formatVideoDuration(videoDurationSec) : `${userName} | Skyshare`, // 100文字まで
  caption: postText.trim() || undefined, // 300文字まで
})
// マスターの最初のバリアントのメディアプレイリストの #EXTINF を合計する。取得失敗・0件は throw
export const fetchVideoDurationSec = async (playlistUrl: string): Promise<number>
export const createPostVisualBlob = async (post): Promise<{ blob: Blob; videoDurationSec?: number }>
```

既存の動画の投稿では、`thumbnail.jpg` の取得と `fetchVideoDurationSec` を並行して行い、Blobの `type` が空なら `image/jpeg` として `createDefaultThumbnail([url], drawVideoOverlay())` に渡す。どちらかが失敗したらentryの作成を失敗にし、APIを呼ばない。画像の投稿では先頭4枚だけを取得する。

## 3. エラー処理

| 事象                           | 処理                            |
| ------------------------------ | ------------------------------- |
| 素材の画像・posterの取得の失敗 | entryの作成の失敗として通知する |
| 再生時間の取得の失敗           | entryの作成の失敗として通知する |
| 切り抜きの範囲の欠落           | 例外を投げ、代表画像を作らない  |
