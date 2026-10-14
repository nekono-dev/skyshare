# 投稿レコードの組み立てと検証 設計書

## 1. 構成

| パス                          | 責務                                         |
| ----------------------------- | -------------------------------------------- |
| `src/lib/atproto/post.ts`     | 投稿レコードの組み立てと返信先の所有者の検証 |
| `src/lib/atproto/facet.ts`    | facetの範囲の検証                            |
| `src/lib/atproto/richtext.ts` | facetからの抽出・集計と送信用facetの検出     |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: 投稿レコード (FR-1, FR-2, FR-3, FR-4)

```ts
export const BSKY_POST_COLLECTION = "app.bsky.feed.post"
export const buildBskyPostRecord = (params: {
  text: string
  facets: CommonFacetsType | undefined
  langs: string[] | undefined
  embed: any
  selfLabel: string | undefined
  reply: CommonReplyRefType | undefined
  createdAt: string
}): Record<string, unknown> => ({
  $type: BSKY_POST_COLLECTION,
  text, facets, langs, embed, reply, createdAt,
  labels: selfLabel ? { $type: "com.atproto.label.defs#selfLabels", values: [{ val: selfLabel }] } : undefined,
  via: serviceName,
})
// reply が無ければ true。root と parent の双方が自分の app.bsky.feed.post であれば true
export const isReplyRefOwnedBySelf = (reply: CommonReplyRefType | undefined, did: string): boolean
```

スレッドの最大件数 `MAX_THREAD_POST_COUNT` は `post.ts` から再公開する。

### D-2: facetの範囲 (FR-5, FR-6)

```ts
// 本文を TextEncoder で符号化したバイト長に対し、byteStart >= byteEnd または byteEnd > バイト長なら例外
export const validateFacets = (text: string, facets: CommonFacetsType | undefined): void
```

### D-3: 抽出・集計・検出 (FR-7, FR-8, FR-9, FR-10)

| 関数                        | 入力                                                    | 出力                                                      |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `extractLinkUrisFromFacets` | facet配列・feature配列・`facets` か `features` を持つ値 | link型featureのURIを重複なしで並べた配列                  |
| `extractTagsFromFacets`     | 同上                                                    | tag型featureのタグ（記号なし）を重複なしで並べた配列      |
| `countHashtagUsage`         | 投稿本文の配列                                          | `{ tag, count }[]`。大文字小文字を区別せず降順            |
| `detectFacetsForSubmission` | 本文                                                    | `RichText.detectFacets(publicAtpAgent)` が作るfacetの配列 |

- 検出できる feature は mention・link・tag の3種に限り、API のスキーマも同じ3種だけを受け付ける。
- 本文の解析に失敗した投稿は集計から除く。

## 4. エラー処理

| 事象                    | 処理                         |
| ----------------------- | ---------------------------- |
| facetの範囲が本文の外   | 例外を投げる                 |
| 返信先のURIの形式が不正 | 自分の投稿ではないとして扱う |
