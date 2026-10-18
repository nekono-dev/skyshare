# 自分の画像blobの取得API 設計書

## 1. 構成

| パス                                       | 責務                     |
| ------------------------------------------ | ------------------------ |
| `src/pages/v2/bsky/images.ts`              | 画像blobの取得のハンドラ |
| `src/lib/api/schema/v2/bsky/images/get.ts` | クエリと応答のスキーマ   |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: 取得のハンドラ (FR-1, FR-2, FR-3, FR-4)

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

## 4. エラー処理

| 事象         | 処理                                   |
| ------------ | -------------------------------------- |
| 連携先の例外 | `resolveXrpcStatus` で変換して応答する |
