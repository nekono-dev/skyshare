# Design Document

## Overview

**Purpose**: 代表画像のために指定した切り抜きの範囲を、原本を加工せずに個別のプレビューへ反映して見せ、切り抜きの調整を画像ごとのスロットで行えるようにする。
**Users**: 代表画像の切り抜きを調整する利用者
**Impact**: 切り抜きの範囲を原本を加工せずにプレビューへ反映し、画像ごとのスロットで調整できるようにする。

### Goals

- 切り抜きの範囲を、プレビューの表示へ反映する計算。
- 画像ごとの切り抜きスロットの表示と、範囲の通知。

### Non-Goals

- 代表画像の合成と圧縮。
- 切り抜きダイアログの全体の流れ。

## Boundary Commitments

### This Spec Owns

- 切り抜きの範囲を、プレビューの表示へ反映する計算。
- 画像ごとの切り抜きスロットの表示と、範囲の通知。

### Out of Boundary

- 代表画像の合成と圧縮。
- 切り抜きダイアログの全体の流れ。

### Allowed Dependencies

- 代表画像の合成と圧縮（entry-visual）
- 切り抜きの操作ライブラリ（react-easy-crop）

### Revalidation Triggers

- プレビューの拡大率・位置の算出規則を変えるとき
- スロットの数（先頭4枚）を変えるとき（entry-visual の合成と一致が要る）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                      | 責務                                     |
| ----------------------------------------- | ---------------------------------------- |
| `src/lib/image/croppedImageStyle.ts`      | 切り抜きの範囲からプレビューの表示の算出 |
| `src/components/image/CropSlot/index.tsx` | 1枚の画像の切り抜き操作                  |

## Requirements Traceability

| Requirement | Summary            | Components |
| ----------- | ------------------ | ---------- |
| 1.1, 1.2    | プレビューへの反映 | D-1        |
| 2.1         | 画像ごとのスロット | D-2        |

## Components and Interfaces

#### D-1: プレビューの表示

**Requirements**: 1.1, 1.2

```ts
// crop は元画像のピクセル座標。未確定（null）や寸法不明のときは中央基準のカバー表示にする
export const computeCroppedImageStyle = (crop: Area | null, naturalWidth?: number, naturalHeight?: number): CSSProperties
```

| 条件                   | 表示                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 範囲または寸法が未確定 | `width: 100%; height: 100%; object-fit: cover`                                                                                                                         |
| 範囲が確定             | `position: absolute`。`left = -x / width`、`top = -y / height`、`width = naturalWidth / width`、`height = naturalHeight / height`（いずれも百分率）。`max-width: none` |

- 原本の画像は切り抜かない。切り抜きは代表画像の生成専用の情報であり、プレビューでは表示上の切り抜きだけを行う。

#### D-2: 切り抜きスロット

**Requirements**: 2.1

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

## Error Handling

| 事象                   | 処理                       |
| ---------------------- | -------------------------- |
| 切り抜きの範囲が未確定 | 中央基準のカバー表示にする |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/lib/image/croppedImageStyle.test.ts`
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/multiImage.spec.ts` ゲスト表示の投稿ページに6枚の画像を添付して切り抜きのダイアログを開く → 先頭4枚のスロットだけが表示される
- テストの名前には、対応する基準 ID を `[image-crop/<ID>]` の形で付ける（例: `[image-crop/1.1]`）
