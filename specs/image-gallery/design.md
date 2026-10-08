# 画像のサムネイルと拡大表示 設計書

## 1. 構成

| パス                                           | 責務                                     |
| ---------------------------------------------- | ---------------------------------------- |
| `src/lib/image/galleryLayout.ts`               | 枚数と縦横比からのサムネイルの配置の決定 |
| `src/components/image/ImageGallery/index.tsx`  | サムネイルの描画と拡大表示の起動         |
| `src/components/image/ImageLightbox/index.tsx` | 拡大表示と画像の切り替え                 |
| `src/components/post/PostCard/index.tsx`       | タイムラインで表示する画像の選択         |

## 2. 設計項目

### D-1: 配置の決定 (FR-1, FR-2, FR-3, FR-4)

```ts
export type GalleryLayout =
  | { kind: "grid"; count: 1 | 2 | 3 | 4; singleRatio?: number }
  | { kind: "strip" }
export const SINGLE_RATIO_MIN = 0.75
export const SINGLE_RATIO_MAX = 2
export const resolveGalleryLayout = (
  images: SourceImage[],
): GalleryLayout | null => {
  if (images.length === 0) return null
  if (images.length > 4) return { kind: "strip" }
  if (images.length === 1) {
    const r = images[0].aspectRatio
    const raw = r ? r.width / r.height : 1.5
    return {
      kind: "grid",
      count: 1,
      singleRatio: Math.min(SINGLE_RATIO_MAX, Math.max(SINGLE_RATIO_MIN, raw)),
    }
  }
  return { kind: "grid", count: images.length as 2 | 3 | 4 }
}
```

| 配置        | CSS                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| grid 1枚    | `aspect-ratio: singleRatio`                                                                                                       |
| grid 2〜4枚 | `aspect-ratio: 2 / 1; grid-template-columns: 1fr 1fr`。3枚と4枚は2行で、3枚の1枚目は `grid-row: 1 / span 2`                       |
| strip       | `display: flex; height: 10rem; overflow-x: auto`。各セルに画像の `aspect-ratio` を指定し、不明なら `width: auto; min-width: 5rem` |

画像は `object-fit: cover` とし、`<img alt={image.alt} loading="lazy" decoding="async">` で描画する。領域の比率を先に決めるため、読み込みでカードの高さが変わらない。

### D-2: サムネイルの部品 (FR-5, FR-10, NFR-2)

```ts
type Props = {
  images: SourceImage[] // 10枚を超える分は描画しない
  interactive?: boolean // 既定 true。false で拡大表示を持たない <div> にする
}
```

`interactive` のときは各サムネイルを `<button aria-label="画像{i+1}/{N}を拡大">` とし、押すと `openIndex = i` にして `ImageLightbox` を描画する。閉じたらボタンの `ref` に `focus()` を戻す。

### D-3: 拡大表示 (FR-6, FR-7, FR-8, NFR-1, NFR-2)

```ts
type Props = {
  images: SourceImage[]
  index: number
  onIndexChange: (next: number) => void
  onClose: () => void
}
```

- `Overlay` を使い、Escキー・背景クリックでの閉鎖と背面のスクロールのロックを任せる。画像は `max-height: calc(100dvh - 7rem); object-fit: contain` で表示する。
- 複数枚のときだけ前後ボタン（端では `disabled`）・位置表示・`document` の左右の矢印キーを有効にする。
- 前・現在・次の画像を `transform: translateX(calc((i - index) * 100% + dragX))` で並べ、0.3秒で遷移させる。`prefers-reduced-motion: reduce` では遷移を無効にする。
- スワイプ: 8px以上の移動でドラッグを開始して指に追従させ、離したときに50px以上で隣へ切り替える。端の方向は追従量を0.3倍にする。画像領域は `touch-action: pan-y` とする。
- マウント時に閉じるボタンへフォーカスし、Tabキーを閉じる・前・次の間で循環させる。

### D-4: タイムラインの画像の選択 (FR-9)

```ts
const entryVisualImages: SourceImage[] | undefined = activeEntry?.visualUrl
  ? [
      {
        url: activeEntry.visualUrl,
        alt: "",
        cid: activeEntry.visualUrl,
        aspectRatio: { width: TARGET_WIDTH, height: TARGET_HEIGHT },
      },
    ] // 1200×630
  : undefined
const galleryImages = entryVisualImages ?? item.images
const imagesInteractive = entryVisualImages === undefined
```

派生元が削除済みで添付画像の無いentryも、同じ規則で代表画像を表示する。

## 3. エラー処理

- なし
