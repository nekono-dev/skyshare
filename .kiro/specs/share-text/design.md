# Design Document

## Overview

**Purpose**: 他SNSへ渡す共有文を本文とURLから組み立て、X・タイッツーの文字数上限に収まるよう本文だけを省略できるようにする。
**Users**: 他 SNS へ共有する利用者
**Impact**: 本文と URL から共有文を組み立て、X・タイッツーの文字数上限に収まるよう本文だけを省略する。

### Goals

- 本文・skyshare entryのURL・リンクカードのURLからの共有文の組み立て。
- X・タイッツー向け共有文の本文の省略。
- 宛先ごとの文字数の数え方。

### Non-Goals

- Blueskyへの投稿本文。
- 省略するかどうかの設定の保持。

## Boundary Commitments

### This Spec Owns

- 本文・skyshare entryのURL・リンクカードのURLからの共有文の組み立て。
- X・タイッツー向け共有文の本文の省略。
- 宛先ごとの文字数の数え方。

### Out of Boundary

- Blueskyへの投稿本文。
- 省略するかどうかの設定の保持。

### Allowed Dependencies

- 文字数の数え方（counted-text-input）
- 省略するかどうかの設定（share-settings）

### Revalidation Triggers

- 上限（279）や宛先ごとの数え方（X の URL 23）を変えるとき（share-counter と整合が要る）
- 共有文の連結の順序や区切りを変えるとき（link-card-priority・auto-popup・intent-share-dialog が影響を受ける）
- 省略の記号（半角ピリオド3つ）を変えるとき

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                             | 責務                             |
| -------------------------------- | -------------------------------- |
| `src/util/share/intentLength.ts` | 宛先別の文字数の数え方           |
| `src/util/share/truncateText.ts` | 末尾文字列を残した本文の省略     |
| `src/util/share/intent.ts`       | 共有文の組み立てと省略上限の決定 |

## Requirements Traceability

| Requirement                       | Summary          | Components |
| --------------------------------- | ---------------- | ---------- |
| 1.1, 1.2                          | 共有文の組み立て | D-3        |
| 2.1, 2.2                          | 文字数の数え方   | D-1        |
| 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 | 本文の省略       | D-2, D-3   |

## Components and Interfaces

#### D-1: 宛先別の文字数

**Requirements**: 2.1, 2.2

```ts
export type IntentMeasure = (text: string) => number // 半角単位
export const xIntentMeasure: IntentMeasure = text => twitterText.parseTweet(text).weightedLength
// 全角2・半角1・改行1の単純加算。異体字セレクタとゼロ幅接合子は0、絵文字は全角として数える
export const taittsuuIntentMeasure: IntentMeasure
export const resolveIntentMeasure = (target: "x" | "taittsuu"): IntentMeasure
```

`xIntentMeasure` は `parseTweet` が例外を投げた場合に `text.length * 2` を返す。

#### D-2: 本文の省略

**Requirements**: 3.3, 3.4, 3.5, 3.6, 3.7

```ts
export const INTENT_WEIGHTED_LIMIT = 280
export const INTENT_TRAILING_MARGIN = 1
export const truncateBodyWithSuffix = (params: {
  body: string
  suffix: string
  limit: number
  measure?: IntentMeasure // 省略時は xIntentMeasure
}): { text: string; truncated: boolean }
```

1. `full` を、`suffix` が空なら `body`、`body` が空なら `suffix`、それ以外は `body + "\n" + suffix` とする。`measure(full) <= limit` なら `full` を返す。
2. `body` を `Intl.Segmenter` で書記素に分割する。非対応環境では `Array.from` で分割する。
3. 書記素数を `length - 1` から1まで1ずつ減らし、`head = 先頭から count 書記素.trimEnd()` に `"..."` と、`suffix` があれば `"\n" + suffix` を続けた候補を作る。最初に `limit` 以内となった候補を `truncated: true` で返す。切り取り位置でURL判定が変わり重みが単調にならないため、二分探索ではなく線形に減らす。
4. どの候補も収まらなければ `full` を `truncated: false` で返す。

#### D-3: 共有文の組み立て

**Requirements**: 1.1, 1.2, 3.1, 3.2

```ts
export const buildIntentSuffix = (body: string, skyshareUri: string, linkCardUrl?: string): string
export const buildIntentText = (
  text: string,
  skyshareUri: string,
  linkCardUrl?: string,
  options: { truncateLimit?: number; measure?: IntentMeasure } = {},
): string
export const resolveTruncateLimit = (target: IntentTarget, truncateEnabled: boolean): number | undefined =>
  truncateEnabled && (target === "x" || target === "taittsuu")
    ? INTENT_WEIGHTED_LIMIT - INTENT_TRAILING_MARGIN
    : undefined
```

- `buildIntentSuffix` は、スキームを除いたリンクカードURLが本文に含まれない場合だけリンクカードURLを加え、skyshare entryのURLと改行で連結する。
- `buildIntentText` は本文を `trim()` し、`truncateLimit` があれば `truncateBodyWithSuffix` の結果を返す。無ければ本文と末尾文字列を改行で連結する。
- 末尾文字列の組み立ては、文字数カウンタの上限補正と共用するため `buildIntentSuffix` として公開する。

## Error Handling

| 事象               | 処理                          |
| ------------------ | ----------------------------- |
| 文字数の計測で例外 | 文字列長の2倍を文字数とみなす |
| 書記素分割が非対応 | コードポイント単位で分割する  |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/util/share/intentLength.test.ts tests/util/share/truncateText.test.ts`
  - `npx vitest run tests/util/share/intent.test.ts`
- テストの名前には、対応する基準 ID を `[share-text/<ID>]` の形で付ける（例: `[share-text/1.1]`）
