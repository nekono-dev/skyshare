# 共有文の組み立てと省略 設計書

## 1. 構成

| パス                             | 責務                             |
| -------------------------------- | -------------------------------- |
| `src/util/share/intentLength.ts` | 宛先別の文字数の数え方           |
| `src/util/share/truncateText.ts` | 末尾文字列を残した本文の省略     |
| `src/util/share/intent.ts`       | 共有文の組み立てと省略上限の決定 |

## 2. 設計項目

### D-1: 宛先別の文字数 (FR-5, FR-6)

```ts
export type IntentMeasure = (text: string) => number // 半角単位
export const xIntentMeasure: IntentMeasure = text => twitterText.parseTweet(text).weightedLength
// 全角2・半角1・改行1の単純加算。異体字セレクタとゼロ幅接合子は0、絵文字は全角として数える
export const taittsuuIntentMeasure: IntentMeasure
export const resolveIntentMeasure = (target: "x" | "taittsuu"): IntentMeasure
```

`xIntentMeasure` は `parseTweet` が例外を投げた場合に `text.length * 2` を返す。

### D-2: 本文の省略 (FR-7, FR-8, FR-9, FR-10, FR-11)

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

### D-3: 共有文の組み立て (FR-1, FR-2, FR-3, FR-4)

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

## 3. エラー処理

| 事象               | 処理                          |
| ------------------ | ----------------------------- |
| 文字数の計測で例外 | 文字列長の2倍を文字数とみなす |
| 書記素分割が非対応 | コードポイント単位で分割する  |
