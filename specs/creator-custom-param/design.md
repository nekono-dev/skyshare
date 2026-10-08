# クリエイターモードのカスタムパラメータ 設計書

## 1. 構成

| パス                                                      | 責務                                                 |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `src/lib/postFeatures/customFields.ts`                    | 検証と入れ子のオブジェクトへの変換・レコードへの統合 |
| `src/components/postFeatures/CustomFieldsPanel/index.tsx` | 入力のパネルとツールの組み立て                       |
| `src/components/creator/creatorTools.ts`                  | ツールの登録                                         |
| `src/components/post/ThreadComposer/segments.ts`          | `customFields` のフィールド                          |
| `src/components/post/ThreadComposer/submitThread.ts`      | 投稿ごとの送信                                       |
| `src/lib/api/schema/common.ts`                            | `CommonCustomFieldsSchema`                           |
| `src/lib/api/schema/v2/entry/post.ts`                     | 投稿の `customFields`                                |
| `src/pages/v2/entry.ts`                                   | 検証とレコードへの統合                               |

## 2. 設計項目

### D-1: 検証と変換 (FR-2, FR-3, FR-4, FR-5, FR-6, NFR-1)

```ts
export type CustomFieldEntry = { id: string; key: string; value: string }
export const RESERVED_TOP_LEVEL_KEYS = new Set(["text", "facets", "reply", "embed", "langs", "labels", "tags", "createdAt", "via", "$type"])
const FORBIDDEN_KEY_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])
export const MAX_CUSTOM_FIELD_KEYS = 10
export const MAX_CUSTOM_FIELD_DEPTH = 3
export type CustomFieldsValidationError =
  | { type: "reservedKey"; key: string } | { type: "forbiddenSegment"; key: string }
  | { type: "emptyKey" } | { type: "duplicateKey"; key: string } | { type: "conflictingPath"; key: string }
  | { type: "tooManyKeys" } | { type: "tooDeep"; key: string }
export const validateCustomFieldEntries = (entries: CustomFieldEntry[]): CustomFieldsValidationError[]
// Object.create(null) で組み立てる。検証でエラーが無いことを確認してから呼ぶ
export const buildCustomFieldsObject = (entries: CustomFieldEntry[]): Record<string, unknown>
// record の既存のキーと衝突するキーは無視する（最終の防御）
export const mergeCustomFieldsIntoRecord = (record: Record<string, unknown>, fields: Record<string, unknown>): Record<string, unknown>
```

クライアントとサーバーが同じモジュールを読み込み、Node.js固有のAPIを使わない。

### D-2: パネルと送信 (FR-1, FR-7, FR-8)

| 要素           | 内容                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 状態           | `SegmentState.customFields?: CustomFieldEntry[]`                                                                                       |
| パネル         | 行の追加ボタン、各行のキー・値の入力と削除ボタン、行ごとのエラー、公式アプリで表示されない旨の説明                                     |
| ツールのボタン | エラーの件数があるときは `label` に件数を含める                                                                                        |
| 送信           | `validateCustomFieldEntries` が空でないセグメントがあれば送信しない。空なら `posts[i].customFields = buildCustomFieldsObject(entries)` |

### D-3: APIの受け付け (FR-9)

```ts
export const CommonCustomFieldsSchema = z
  .record(z.string(), z.unknown())
  .meta({ id: "CommonCustomFields" })
// EntryPostItemSchema の各分岐に customFields: CommonCustomFieldsSchema.optional() を加え、
// PostItemFieldKinds に customFields: "json" を加える
```

ハンドラは、入れ子のオブジェクトを `CustomFieldEntry[]` に平坦化して `validateCustomFieldEntries` を適用し、エラーがあれば400を返す。通過した場合は投稿のレコードの組み立て後に `mergeCustomFieldsIntoRecord` を適用する。`npm run codegen` でクライアントを生成し直す。

## 3. エラー処理

| 事象              | 処理                       |
| ----------------- | -------------------------- |
| 入力の検証エラー  | パネルに表示し、送信しない |
| APIでの検証エラー | 400                        |
