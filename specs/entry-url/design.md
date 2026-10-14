# 投稿とentryのURL 設計書

## 1. 構成

| パス                   | 責務                          |
| ---------------------- | ----------------------------- |
| `src/lib/entry/url.ts` | URLの生成とAT URIの分解・検証 |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: URLの生成 (FR-1, FR-2, FR-3, FR-4)

```ts
export const bskyPostUrlgen = (handle: string, rkey: string) =>
  `https://bsky.app/profile/${handle}/post/${rkey}`
export const bskyCdnUrlgen = (repoDid: string, ref: string) =>
  `https://cdn.bsky.app/img/feed_fullsize/plain/${encodeURIComponent(repoDid)}/${encodeURIComponent(ref)}`
export const skyshareEntryPath = (handle: string, rkey: string) =>
  `/entries/${handle}@${rkey}/`
export const skyshareEntryUrlgen = (handle: string, rkey: string) =>
  `${import.meta.env.SITE}${skyshareEntryPath(handle, rkey)}`
```

### D-2: AT URIの分解と検証 (FR-5, FR-6)

```ts
// at://<repo>/<collection>/<rkey>。rkey に ? と # を含めない
export const parseAtUri = (uri: string): { repo: string; collection: string; rkey: string } | undefined
// parseAtUri の結果が expectedCollection と expectedRepo の双方に一致するときだけ返す
export const parseOwnedAtUri = (uri: string, expectedCollection: string, expectedRepo: string): { repo: string; collection: string; rkey: string } | undefined
```

## 4. エラー処理

| 事象               | 処理                        |
| ------------------ | --------------------------- |
| AT URIの形式が不正 | 分解せず `undefined` を返す |
| 所有者が一致しない | 分解せず `undefined` を返す |
