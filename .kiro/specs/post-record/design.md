# Design Document

## Overview

**Purpose**: Blueskyの投稿レコードを一定の規則で組み立て、壊れたレコードがPDSへ書き込まれることを防ぎ、投稿の本文から取り出したリンクとハッシュタグを他の機能が再利用できるようにする。
**Users**: 投稿を作成する処理と、本文のリンクやハッシュタグを再利用する機能の実装者
**Impact**: Bluesky の投稿レコードを一定の規則で組み立てて壊れたレコードの書き込みを防ぎ、本文から取り出したリンクとハッシュタグを他の機能が再利用できるようにする。

### Goals

- 投稿レコードの組み立てと、返信先の所有者の検証。
- facetの範囲の検証。
- facetからのリンクとハッシュタグの抽出、ハッシュタグの使用数の集計。
- 送信用のfacetの検出。

### Non-Goals

- 複数レコードの原子的な書き込み。
- 本文の編集中の強調表示。

## Boundary Commitments

### This Spec Owns

- 投稿レコードの組み立てと、返信先の所有者の検証。
- facetの範囲の検証。
- facetからのリンクとハッシュタグの抽出、ハッシュタグの使用数の集計。
- 送信用のfacetの検出。

### Out of Boundary

- 複数レコードの原子的な書き込み。
- 本文の編集中の強調表示。

### Allowed Dependencies

- Bluesky の投稿レコードの形式（`app.bsky.feed.post`）
- 公開の AppView（メンションの DID の解決）
- 投稿の一括書き込み（entry-api が原子的な書き込みを担う）

### Revalidation Triggers

- 投稿レコードの項目（言語・埋め込み・投稿元のサービス名）を変えるとき
- facet の範囲の判定（UTF-8 のバイト数）を変えるとき（本文の編集と色付けの位置と整合が要る）
- スレッドの上限の定数を変えるとき（entry-api と draft-api が参照する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                          | 責務                                         |
| ----------------------------- | -------------------------------------------- |
| `src/lib/atproto/post.ts`     | 投稿レコードの組み立てと返信先の所有者の検証 |
| `src/lib/atproto/facet.ts`    | facetの範囲の検証                            |
| `src/lib/atproto/richtext.ts` | facetからの抽出・集計と送信用facetの検出     |

## Requirements Traceability

| Requirement        | Summary                | Components |
| ------------------ | ---------------------- | ---------- |
| 1.1, 1.2, 1.3, 1.4 | 投稿レコードの組み立て | D-1        |
| 2.1, 2.2           | facet の範囲           | D-2        |
| 3.1, 3.2, 3.3, 3.4 | 抽出・集計・検出       | D-3        |

## Components and Interfaces

#### D-1: 投稿レコード

**Requirements**: 1.1, 1.2, 1.3, 1.4

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

#### D-2: facetの範囲

**Requirements**: 2.1, 2.2

```ts
// 本文を TextEncoder で符号化したバイト長に対し、byteStart >= byteEnd または byteEnd > バイト長なら例外
export const validateFacets = (text: string, facets: CommonFacetsType | undefined): void
```

#### D-3: 抽出・集計・検出

**Requirements**: 3.1, 3.2, 3.3, 3.4

| 関数                        | 入力                                                    | 出力                                                      |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `extractLinkUrisFromFacets` | facet配列・feature配列・`facets` か `features` を持つ値 | link型featureのURIを重複なしで並べた配列                  |
| `extractTagsFromFacets`     | 同上                                                    | tag型featureのタグ（記号なし）を重複なしで並べた配列      |
| `countHashtagUsage`         | 投稿本文の配列                                          | `{ tag, count }[]`。大文字小文字を区別せず降順            |
| `detectFacetsForSubmission` | 本文                                                    | `RichText.detectFacets(publicAtpAgent)` が作るfacetの配列 |

- 検出できる feature は mention・link・tag の3種に限り、API のスキーマも同じ3種だけを受け付ける。
- 本文の解析に失敗した投稿は集計から除く。

## Error Handling

| 事象                    | 処理                         |
| ----------------------- | ---------------------------- |
| facetの範囲が本文の外   | 例外を投げる                 |
| 返信先のURIの形式が不正 | 自分の投稿ではないとして扱う |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/lib/atproto/post.test.ts tests/lib/atproto/facet.test.ts`
  - `npx vitest run tests/lib/atproto/richtext.test.ts`
- テストの名前には、対応する基準 ID を `[post-record/<ID>]` の形で付ける（例: `[post-record/1.1]`）
