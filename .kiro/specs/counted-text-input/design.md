# Design Document

## Overview

**Purpose**: 投稿の本文や見出しのように文字数に制約がある入力で、共有先ごとの数え方での文字数と上限を示し、入力欄の高さを内容に合わせて調整できるようにする。
**Users**: 文字数に制約のある入力（投稿の本文・見出しなど）を扱う利用者
**Impact**: 共有先ごとの数え方で文字数と上限を示し、複数行の入力欄の高さを内容に合わせて調整する。

### Goals

- 文字数の数え方（書記素、Xの換算、タイッツーの換算）。
- 文字数カウンタを付けた入力欄の表示と、カウンタの状態の判定。
- 複数行の入力欄の高さの自動伸長。

### Non-Goals

- 共有文の組み立てと省略。
- 投稿本文の色付け。

## Boundary Commitments

### This Spec Owns

- 文字数の数え方（書記素、Xの換算、タイッツーの換算）。
- 文字数カウンタを付けた入力欄の表示と、カウンタの状態の判定。
- 複数行の入力欄の高さの自動伸長。

### Out of Boundary

- 共有文の組み立てと省略。
- 投稿本文の色付け。

### Allowed Dependencies

- twitter-text（X の換算の文字数）
- 入力欄の見た目の共通部品（common-ui）

### Revalidation Triggers

- 文字数の数え方（共有先の換算規則）を変えるとき
- カウンタの状態の判定（閾値と深刻度の合成）を変えるとき
- 自動伸長の高さの算出を変えるとき

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                                       | 責務                   |
| ---------------------------------------------------------- | ---------------------- |
| `src/util/textCount.ts`                                    | 文字数の数え方         |
| `src/components/common/CountedTextInput/autoGrowHeight.ts` | 自動伸長の高さの算出   |
| `src/components/common/CountedTextInput/index.tsx`         | 入力欄とカウンタの描画 |

## Requirements Traceability

| Requirement             | Summary                | Components |
| ----------------------- | ---------------------- | ---------- |
| 1.1, 1.2, 1.3           | 文字数の数え方         | D-1        |
| 2.1, 2.2, 2.3, 2.4, 2.5 | 入力欄の高さの自動伸長 | D-2        |
| 3.1, 3.2, 3.3, 3.4, 3.5 | 入力欄とカウンタの表示 | D-3        |

## Components and Interfaces

#### D-1: 文字数の数え方

**Requirements**: 1.1, 1.2, 1.3

```ts
// Intl.Segmenter("ja-JP") の書記素。非対応の環境では文字列の長さ
export const countGraphemes = (rawText: string): number
// twitter-text の重み付きの長さを 2 で割って切り上げる。URL は固定の重み
export const countWeightedTweetLength = (rawText: string): number
// 半角単位の長さ（URL も全文字）を 2 で割って切り上げる
export const countTaittsuuLength = (rawText: string): number
```

#### D-2: 自動伸長の高さ

**Requirements**: 2.1, 2.2, 2.3, 2.4, 2.5

```ts
// "12px" → 12。数値だけ → 数値 × fontSizePx。それ以外（normal など）→ fontSizePx × 1.2
export const resolveLineHeightPx = (computedLineHeight: string, fontSizePx: number): number
export const computeAutoGrowBounds = (rows: number, maxRows: number | undefined, lineHeightPx: number, verticalExtraPx: number): { minHeightPx: number; maxHeightPx: number | undefined }
export const computeRowsFromAvailableHeight = (availableHeightPx: number, lineHeightPx: number, verticalExtraPx: number, minRows: number, maxRows: number): number
// scrollHeight を [min, max] に収める。max を超えるときだけ overflowY を auto にする
export const clampAutoGrowHeightPx = (scrollHeightPx: number, minHeightPx: number, maxHeightPx: number | undefined): { heightPx: number; overflowY: "hidden" | "auto" }
```

縦方向の余白は、上下のパディングと上下の枠線の太さの合計とする。

#### D-3: 入力欄とカウンタ

**Requirements**: 3.1, 3.2, 3.3, 3.4, 3.5

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

## Error Handling

| 事象                         | 処理               |
| ---------------------------- | ------------------ |
| 書記素の分割に対応していない | 文字列の長さを返す |
| 重み付きの計算が例外を投げる | 文字列の長さを返す |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/util/textCount.test.ts`
  - `npx vitest run tests/components/common/CountedTextInput/autoGrowHeight.test.ts`
  - `npx vitest run tests/components/common/CountedTextInput/index.test.ts`
- E2E/UI Tests:
  - `tests/e2e/countedTextInput.spec.ts` ゲスト表示の設定ページを開いて1行の入力欄へ文字を入力する → 入力した値が欄に反映される
- テストの名前には、対応する基準 ID を `[counted-text-input/<ID>]` の形で付ける（例: `[counted-text-input/1.1]`）
