# 画像の切り抜き表示 設計書

## 1. 構成

| パス                                      | 責務                                     |
| ----------------------------------------- | ---------------------------------------- |
| `src/lib/image/croppedImageStyle.ts`      | 切り抜きの範囲からプレビューの表示の算出 |
| `src/components/image/CropSlot/index.tsx` | 1枚の画像の切り抜き操作                  |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: プレビューの表示 (FR-1, FR-2)

```ts
// crop は元画像のピクセル座標。未確定（null）や寸法不明のときは中央基準のカバー表示にする
export const computeCroppedImageStyle = (crop: Area | null, naturalWidth?: number, naturalHeight?: number): CSSProperties
```

| 条件                   | 表示                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 範囲または寸法が未確定 | `width: 100%; height: 100%; object-fit: cover`                                                                                                                         |
| 範囲が確定             | `position: absolute`。`left = -x / width`、`top = -y / height`、`width = naturalWidth / width`、`height = naturalHeight / height`（いずれも百分率）。`max-width: none` |

- 原本の画像は切り抜かない。切り抜きは代表画像の生成専用の情報であり、プレビューでは表示上の切り抜きだけを行う。

### D-2: 切り抜きスロット (FR-3)

```tsx
type CropSlotProps = {
  imageUrl: string
  aspect: number
  externalZoom?: number // 呼び出し元のズームのスライダーから渡す値
  initialCropPixels?: Area | null
  onChange: (state: SlotCropState) => void
  onMinZoomChange?: (minZoom: number) => void
}
```

- `react-easy-crop` で指定の縦横比の枠を表示し、枠の大きさの変化に合わせて最小のズームと枠を再計算する。
- 画像の読み込み直後の補正が終わるまで、範囲の通知を親へ伝えない。補正前の範囲は幅や高さが 0 になりうるため。
- ダイアログは、代表画像の対象の画像（先頭4枚まで）にスロットを1つずつ割り当てる。

## 4. エラー処理

| 事象                   | 処理                       |
| ---------------------- | -------------------------- |
| 切り抜きの範囲が未確定 | 中央基準のカバー表示にする |
