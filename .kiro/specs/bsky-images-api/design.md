# Design Document

## Overview

**Purpose**: ブラウザから、自分が投稿した画像のblobを、CORSの制約を受けずに取得できるようにする。
**Users**: 自分が投稿した画像をブラウザで表示・加工する利用者の画面
**Impact**: ブラウザから直接取得できない自分の PDS の画像 blob を、サーバー経由で返す。

### Goals

- 自分のPDSからの画像blobの取得と、そのまま返す応答。

### Non-Goals

- 画像の加工と圧縮。
- 他人のリポジトリの画像の取得。

## Boundary Commitments

### This Spec Owns

- 自分のPDSからの画像blobの取得と、そのまま返す応答。

### Out of Boundary

- 画像の加工と圧縮。
- 他人のリポジトリの画像の取得。

### Allowed Dependencies

- 自分の PDS（認証済みのエージェント）
- API の認証の再開（account-session）

### Revalidation Triggers

- 取得対象を自分以外のリポジトリへ広げるとき
- 応答の内容種別の扱いを変えるとき

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                       | 責務                     |
| ------------------------------------------ | ------------------------ |
| `src/pages/v2/bsky/images.ts`              | 画像blobの取得のハンドラ |
| `src/lib/api/schema/v2/bsky/images/get.ts` | クエリと応答のスキーマ   |

## Requirements Traceability

| Requirement        | Summary          | Components |
| ------------------ | ---------------- | ---------- |
| 1.1, 1.2, 1.3, 1.4 | 画像 blob の取得 | D-1        |

## Components and Interfaces

#### D-1: 取得のハンドラ

**Requirements**: 1.1, 1.2, 1.3, 1.4

```ts
// GET /v2/bsky/images?cid=<cid>
// 1. locals.agent / locals.session が無ければ 401
// 2. cid が無い・空白だけなら 400
// 3. agent.com.atproto.sync.getBlob({ did: session.did, cid }) の結果をそのまま返す
const body = new Uint8Array(blobRes.data)
const contentType =
  blobRes.headers["content-type"] ?? "application/octet-stream"
```

| 事象                   | 応答                                     |
| ---------------------- | ---------------------------------------- |
| 未認証                 | 401                                      |
| `cid` が無い・空       | 400                                      |
| blobが見つからない場合 | `resolveXrpcStatus` で変換したステータス |

- 取得先は常にログイン中のアカウントのリポジトリとし、他人の DID は受け付けない。
- Bluesky の CDN は CORS のヘッダを返さないため、同一オリジンのこの API が代わりに blob を返す。
- クライアントは、このパスの応答を JSON として解釈せず `Blob` のまま受け取る。

## Error Handling

| 事象         | 処理                                   |
| ------------ | -------------------------------------- |
| 連携先の例外 | `resolveXrpcStatus` で変換して応答する |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/pages/v2/bsky/images.test.ts`
- テストの名前には、対応する基準 ID を `[bsky-images-api/<ID>]` の形で付ける（例: `[bsky-images-api/1.1]`）
