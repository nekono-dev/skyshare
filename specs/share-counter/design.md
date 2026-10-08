# 共有先の文字数カウンタ 設計書

## 1. 構成

| パス                                                             | 責務                                 |
| ---------------------------------------------------------------- | ------------------------------------ |
| `src/lib/share/counterReserve.ts`                                | 表示するカウンタと減算量の決定       |
| `src/lib/entry/estimateEntryUrl.ts`                              | skyshare entryのURLの長さの予測      |
| `src/components/post/ThreadComposer/index.tsx`                   | 表示するカウンタと予測URLの算出      |
| `src/components/post/ThreadComposer/ThreadSegmentForm/index.tsx` | 先頭の投稿のカウンタへの減算量の適用 |

## 2. 設計項目

### D-1: URLの長さの予測 (FR-2, FR-3)

```ts
const FALLBACK_DID = `did:plc:${"a".repeat(24)}`
const dummyRkey = (): string => "a".repeat(TID.nextStr().length)
export const estimateSkyshareEntryUrl = (
  did: string | null | undefined,
): string => skyshareEntryUrlgen(did || FALLBACK_DID, dummyRkey())
```

`ThreadComposer` は、`!manualImageAttach` かつ画像または動画を含む投稿がある場合のみ `estimateSkyshareEntryUrl(accountDid)` を予測URLとし、それ以外は `null` とする。

### D-2: 表示するカウンタと減算量 (FR-1, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9)

```ts
export type CounterTarget = "x" | "taittsuu"
export const resolveCounterTargets = (
  autoPopupTarget: AutoPopupTarget,
  popupIntentInsteadOfWebshare: boolean,
): CounterTarget[] => {
  if (!popupIntentInsteadOfWebshare) return ["x"]
  switch (autoPopupTarget) {
    case "x":
      return ["x"]
    case "taittsuu":
      return ["taittsuu"]
    case "mastodon":
      return []
    case "ask":
      return ["x", "taittsuu"]
  }
}
export const resolveCounterReserve = (params: {
  target: CounterTarget
  body: string
  entryUrl: string | null
  linkCardUrl: string
}): number => {
  const suffix = buildIntentSuffix(
    params.body.trim(),
    params.entryUrl ?? "",
    params.linkCardUrl,
  )
  if (suffix.length === 0) return 0
  return Math.ceil(resolveIntentMeasure(params.target)(`\n${suffix}`) / 2)
}
```

`ThreadSegmentForm` は、`index === 0` のときだけ `resolveCounterReserve` の結果を減算量とし、X・タイッツーのカウンタの上限と警告閾値を `140 - 減算量` にする。Blueskyのカウンタ（上限300）は常に先頭に置き、減算しない。

## 3. エラー処理

- なし
