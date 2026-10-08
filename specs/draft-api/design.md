# 下書きAPI 設計書

## 1. 構成

| パス                                          | 責務                               |
| --------------------------------------------- | ---------------------------------- |
| `src/pages/v2/bsky/drafts.ts`                 | GET・POST・PUT・DELETE のハンドラ  |
| `src/lib/api/schema/v2/bsky/drafts/post.ts`   | 作成の入力スキーマ                 |
| `src/lib/api/schema/v2/bsky/drafts/put.ts`    | 更新の入力スキーマ                 |
| `src/lib/api/schema/v2/bsky/drafts/get.ts`    | 一覧のクエリと応答のスキーマ       |
| `src/lib/api/schema/v2/bsky/drafts/delete.ts` | 削除の入力スキーマ                 |
| `src/lib/atproto/draft.ts`                    | 入力と応答の検証、自己ラベルの変換 |

## 2. 設計項目

### D-1: 下書きの形式 (FR-1, FR-2, NFR-1)

```ts
export const DraftPostSchema = z.object({ text: z.string(), labels: z.array(z.string()).optional() }).strict()
// 作成
export const RequestBodySchema = z.object({ posts: z.array(DraftPostSchema).min(1).max(MAX_THREAD_POST_COUNT) }).strict()
// 更新は { id: string, posts: 同上 }、削除は { id: string }
export const parseDraftPostsInput = (value: unknown): DraftPostPayload[] | undefined // 1〜MAX_THREAD_POST_COUNT 件
export const buildSelfLabels = (labels: string[] | undefined) // ラベル値から com.atproto.label.defs#selfLabels を組み立てる
```

`MAX_THREAD_POST_COUNT` は `src/lib/atproto/threadLimit.ts` から参照する。`posts` は `app.bsky.draft#draft.posts` にそのまま対応させる。

### D-2: ハンドラ (FR-3, FR-4, FR-5, FR-6, FR-7, NFR-2)

| メソッド | 入力の検証                                             | 連携先の呼び出し                                       | 成功時                    |
| -------- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------- |
| GET      | `parseDraftQuery`（`limit` の範囲・空でない `cursor`） | `app.bsky.draft.getDrafts` → `parseDraftViewsResponse` | 200 `{ drafts, cursor? }` |
| POST     | `parseCreateDraftBody`                                 | `app.bsky.draft.createDraft`                           | 200 `{ id }`              |
| PUT      | `parseUpdateDraftBody`                                 | `app.bsky.draft.updateDraft`                           | 200（本文なし）           |
| DELETE   | `parseDeleteDraftBody`                                 | `app.bsky.draft.deleteDraft`                           | 200（本文なし）           |

- 認証が無ければ401、入力の検証に失敗すれば400を返す。
- `parseDraftViewsResponse` は各下書きを `parseDraft` で検証し、1件でも不正なら `undefined` を返す。ハンドラはこのとき500を返す。
- 連携先の例外は `resolveXrpcStatus` で変換する（`DraftLimitReached` は429）。

## 3. エラー処理

| 事象                     | 処理                                     |
| ------------------------ | ---------------------------------------- |
| 連携先の応答が不正な形式 | 500                                      |
| 連携先の呼び出しの例外   | `resolveXrpcStatus` で変換したステータス |
