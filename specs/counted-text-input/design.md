# 文字数カウンタ付きの入力欄 設計書

## 1. 構成

| パス                                                       | 責務                   |
| ---------------------------------------------------------- | ---------------------- |
| `src/util/textCount.ts`                                    | 文字数の数え方         |
| `src/components/common/CountedTextInput/autoGrowHeight.ts` | 自動伸長の高さの算出   |
| `src/components/common/CountedTextInput/index.tsx`         | 入力欄とカウンタの描画 |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: 文字数の数え方 (FR-1, FR-2, FR-3)

```ts
// Intl.Segmenter("ja-JP") の書記素。非対応の環境では文字列の長さ
export const countGraphemes = (rawText: string): number
// twitter-text の重み付きの長さを 2 で割って切り上げる。URL は固定の重み
export const countWeightedTweetLength = (rawText: string): number
// 半角単位の長さ（URL も全文字）を 2 で割って切り上げる
export const countTaittsuuLength = (rawText: string): number
```

### D-2: 自動伸長の高さ (FR-4, FR-5, FR-6, FR-7)

```ts
// "12px" → 12。数値だけ → 数値 × fontSizePx。それ以外（normal など）→ fontSizePx × 1.2
export const resolveLineHeightPx = (computedLineHeight: string, fontSizePx: number): number
export const computeAutoGrowBounds = (rows: number, maxRows: number | undefined, lineHeightPx: number, verticalExtraPx: number): { minHeightPx: number; maxHeightPx: number | undefined }
export const computeRowsFromAvailableHeight = (availableHeightPx: number, lineHeightPx: number, verticalExtraPx: number, minRows: number, maxRows: number): number
// scrollHeight を [min, max] に収める。max を超えるときだけ overflowY を auto にする
export const clampAutoGrowHeightPx = (scrollHeightPx: number, minHeightPx: number, maxHeightPx: number | undefined): { heightPx: number; overflowY: "hidden" | "auto" }
```

縦方向の余白は、上下のパディングと上下の枠線の太さの合計とする。

### D-3: 入力欄とカウンタ (FR-8, FR-9, FR-10)

```ts
export type CounterSpec = {
  key: string
  label: string
  count: (text: string) => number
  maxAssumed: number // 表示上の分母。カウンタの横幅の基準にもなる
  warnAt?: number
  errorAt?: number
  reduced?: boolean // 上限が引き下げられているとき、通知色の背景で示す
}
```

| 項目           | 内容                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| 入力欄         | `multiline` なら `<textarea>`、そうでなければ `<input type="text">`                                    |
| カウンタの表示 | `{件数}/{maxAssumed}:{label}`。横幅は桁数と、全角を2・半角を1とした表示幅から決める                    |
| カウンタの状態 | `件数 > errorAt` で誤り、`件数 > warnAt` で警告、それ以外は通常。全体は最も深刻な状態の表示を使う      |
| 自動伸長       | `multiline` かつ `autoGrow` のとき、値の変更ごとに高さを一度 `auto` に戻して `scrollHeight` から決める |

## 4. エラー処理

| 事象                         | 処理               |
| ---------------------------- | ------------------ |
| 書記素の分割に対応していない | 文字列の長さを返す |
| 重み付きの計算が例外を投げる | 文字列の長さを返す |
