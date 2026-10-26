# Design Document

## Overview

**Purpose**: Blueskyの投稿とSkyshare entryのURLを、一貫した形式で生成し、AT URIを安全に分解できるようにする。
**Users**: URL を生成・解析する、skyshare の各機能の実装者
**Impact**: Bluesky の投稿と entry の URL の生成を1か所にまとめ、AT URI を安全に分解する。

### Goals

- Bluesky投稿のURLと画像のURLの生成。
- entryのパスとURLの生成。
- AT URIの分解と、所有者の検証。

### Non-Goals

- entryのNSIDの導出。
- URLの短縮。

## Boundary Commitments

### This Spec Owns

- Bluesky投稿のURLと画像のURLの生成。
- entryのパスとURLの生成。
- AT URIの分解と、所有者の検証。

### Out of Boundary

- entryのNSIDの導出。
- URLの短縮。

### Allowed Dependencies

- サイトの URL（site-config）

### Revalidation Triggers

- URL の形式（パス・クエリ）を変えるとき（共有されたリンクとの互換が要る）
- AT URI の所有者の検証の基準を変えるとき（entry-api の所有権の検証が影響を受ける）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                   | 責務                          |
| ---------------------- | ----------------------------- |
| `src/lib/entry/url.ts` | URLの生成とAT URIの分解・検証 |

## Requirements Traceability

| Requirement        | Summary             | Components |
| ------------------ | ------------------- | ---------- |
| 1.1, 1.2, 1.3, 1.4 | URL の生成          | D-1        |
| 2.1, 2.2, 2.3, 2.4 | AT URI の分解と検証 | D-2        |

## Components and Interfaces

#### D-1: URLの生成

**Requirements**: 1.1, 1.2, 1.3, 1.4

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

#### D-2: AT URIの分解と検証

**Requirements**: 2.1, 2.2, 2.3, 2.4

```ts
// at://<repo>/<collection>/<rkey>。rkey に ? と # を含めない
export const parseAtUri = (uri: string): { repo: string; collection: string; rkey: string } | undefined
// parseAtUri の結果が expectedCollection と expectedRepo の双方に一致するときだけ返す
export const parseOwnedAtUri = (uri: string, expectedCollection: string, expectedRepo: string): { repo: string; collection: string; rkey: string } | undefined
```

## Error Handling

| 事象               | 処理                        |
| ------------------ | --------------------------- |
| AT URIの形式が不正 | 分解せず `undefined` を返す |
| 所有者が一致しない | 分解せず `undefined` を返す |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/lib/entry/url.test.ts`
- テストの名前には、対応する基準 ID を `[entry-url/<ID>]` の形で付ける（例: `[entry-url/1.1]`）
