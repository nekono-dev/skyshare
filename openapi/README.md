# OpenAPIの目的

ATProto Clientはバックエンドとして実装される。
OpenAPIは、ATProto Clientを実行するためのWrapper APIである。

このディレクトリ(`openapi/`)自体にはOpenAPI定義を手書きしない。人が読み書きするのは常に`src/lib/api/schema/**`側であり、このREADMEはその設計思想と書き方を説明する。

# アーキテクチャ: コードファースト

**Zodスキーマ(`src/lib/api/schema/**`)を人が直接書き、そこからOpenAPIドキュメントを自動生成する。**

```
src/lib/api/schema/**/*.ts (手書きZod。バリデーション+OpenAPIメタデータの単一の真実の源)
   │
   ├─ そのままimport ──→ src/pages/**/*.ts (APIルートハンドラが `.safeParse()` で検証)
   │
   └─ hack/build-openapi-document.ts (zod-openapiでOpenAPI 3.1ドキュメントを組み立て)
             ├─ orval.config.ts の input.target に直接渡す
             │      → src/client/openapi/client.ts, model/**(フロントエンド用fetchクライアント、gitignore対象)
             └─ openapi/generated.json へ書き出す(レビュー・デバッグ用、gitignore対象)
```

**原則: 1エンドポイントにつきスキーマは1つ。** バリデーション用とドキュメント生成用でスキーマを分けることは許容しない(後述のmultipart節を参照)。

## 開発フロー

- 新しいエンドポイントを追加する、または既存のリクエスト/レスポンス形状を変える場合は、`src/lib/api/schema/**`のZodスキーマを直接編集する。
- `npm run apigen`(`apigen:doc` → `apigen:client`)、または`npm run codegen`(`lexgen` → `apigen`)でOpenAPIドキュメントとフロントエンド用クライアントを再生成する。`npm run dev`/`npm run build`はこれを自動的に実行する。
- `src/client/openapi/**`(orval生成物)と`openapi/generated.json`はいずれもgitignore対象。コミットする必要はなく、`npm run codegen`を実行すれば常に最新化される。

# API設計思想・リソース一覧

各エンドポイントが扱うリソースのスコープを明確にするため、`v2` 名前空間を以下の3つの階層に分けている。

- **`v2/bsky/*`**: Bluesky API を bypass するだけの、skyshare を一切含まないリソース群（`session`, `drafts`, `images`, `record`）。
- **`v2/entry`（単数）・`v2/entries`（複数）**: 本アプリケーション固有の複合概念「entry」＝「Bluesky投稿と、それに紐づく（かもしれない）skyshare entry」を1つのデータとして扱うリソース。単数形は1件に対する作成・削除、複数形はその一覧を表す。
- **`v2/entries/skyshare`**: skyshare entry（`dev.nekono.skyshare.entry`）そのものだけの一覧。上記の複合概念とは別の、skyshare entry 単体の集合として扱う。

## v2 エンドポイント一覧

| Method              | Path                   | 説明                                                                                                                                                        |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                 | `/v2/entries`          | 自分の Bluesky 投稿一覧。各投稿に、紐づく skyshare entry があれば embed して返す。Timeline が使用。                                                         |
| GET                 | `/v2/entries/skyshare` | 自分の skyshare entry 一覧。`orphaned=true` クエリで、紐づく Bluesky 投稿が削除済みの「孤立 entry」のみに絞り込める。                                       |
| POST                | `/v2/entry`            | 新規 Bluesky 投稿を作成し、画像投稿の場合は併せて skyshare entry を作成する。または `uri` 指定時、既存の自分の Bluesky 投稿から skyshare entry を発行する。 |
| DELETE              | `/v2/entry`            | skyshare entry を削除する。`deleteBskyPost` 指定時は紐づく Bluesky 投稿も併せて削除する。                                                                   |
| POST                | `/v2/bsky/record`      | skyshare entry を伴わない Bluesky 投稿（テキスト投稿・OGP付き投稿）を作成する。                                                                             |
| GET/POST/PUT        | `/v2/bsky/session`     | ログインセッション・複数アカウント管理。                                                                                                                    |
| GET/POST/PUT/DELETE | `/v2/bsky/drafts`      | Bluesky ネイティブの下書き機能のラッパー。                                                                                                                  |
| GET                 | `/v2/bsky/images`      | `cdn.bsky.app` のCORS制約を回避するための画像プロキシ。                                                                                                     |

# スキーマの書き方(`src/lib/api/schema/**`)

## ディレクトリ構成

URLパスをそのままディレクトリ構造にする。パスパラメータ(`{did}`等)は`_did`のように先頭にアンダースコアを付けたディレクトリ名にする。

- `src/lib/api/schema/common.ts` — 複数エンドポイントで共有するスキーマ(`CommonErrorSchema`等)と、`errorResponses()`ヘルパー(後述)を置く。
- `src/lib/api/schema/v2/entry/post.ts` — `POST /v2/entry/`。ファイル名はHTTPメソッド(`get.ts`/`post.ts`/`put.ts`/`delete.ts`)。
- `src/lib/api/schema/v2/bsky/session/_did/delete.ts` — `DELETE /v2/bsky/session/{did}/`。
- `src/lib/api/schema/index.ts` — 全エンドポイントの`{path, method} → operation`対応表。新しいエンドポイントを追加したら必ずここにも登録する。

## 1エンドポイントファイルの基本形

各ファイルは以下を`export`する(該当するもののみ。例えばパスパラメータが無ければ`PathParamsSchema`は書かない):

- `PathParamsSchema` / `QueryParamsSchema` / `RequestHeaderSchema` / `RequestBodySchema` — リクエストの各部位を検証するZodスキーマ。ハンドラ側から`.safeParse()`で直接使われる。
- `ResponseBodyNNNSchema`(`NNN`はステータスコード) — 成功レスポンス(`200`等)の形が独自のものだけ書けばよい。共通エラー形(後述)は書かない。
- `operation`(型: `ZodOpenApiOperationObject`) — 上記スキーマを束ねてOpenAPIドキュメント化するための定義。`operationId`と`summary`を必ず持たせる。

例(`src/lib/api/schema/v1/extract/get.ts`):

```ts
import { z } from "zod/v4"
import type { ZodOpenApiOperationObject } from "zod-openapi"
import * as Common from "../../common"

export const QueryParamsSchema = z.object({ url: z.string() }).strict()
export type QueryParamsType = z.infer<typeof QueryParamsSchema>

export const ResponseBody200Schema = Common.CommonOgMetaSchema
export type ResponseBody200Type = Common.CommonOgMetaType

export const operation: ZodOpenApiOperationObject = {
  operationId: "extractUrl",
  summary: "Extract OGP information from URL",
  requestParams: { query: QueryParamsSchema },
  responses: {
    "200": {
      description: "Success",
      content: { "application/json": { schema: ResponseBody200Schema } },
    },
    ...Common.errorResponses(["400"]),
  },
}
```

## 共通エラーレスポンス: `Common.errorResponses()`

`400`/`401`/`404`/`429`/`500`等のエラーレスポンスは、ほとんどのエンドポイントで同じ`CommonErrorSchema`を指すだけになる。これをエンドポイントごとに`ResponseBody400Schema = Common.CommonErrorSchema`のように再定義しない。代わりに`common.ts`の`errorResponses(statuses, schema?)`を`operation.responses`にスプレッドする。

```ts
responses: {
    "200": { /* ... */ },
    ...Common.errorResponses(["400", "401", "429", "500"]),
},
```

`schema`省略時は`CommonErrorSchema`。`v1/page/**`のように別の共通エラー形(`CommonLegacyPageErrorSchema`)を使う場合は第2引数で指定する: `Common.errorResponses(["400", "500"], Common.CommonLegacyPageErrorSchema)`。

新しいステータスコードの説明文が必要な場合は`common.ts`の`ERROR_STATUS_DESCRIPTIONS`に追記する。

## multipart/form-data + anyOf(選択式リクエストボディ)

「AまたはBのいずれかの組み合わせを要求する」("uriのみ"か"images+imagesMeta"か、等)エンドポイントは`RequestBodySchema`を`z.union([...])`で表現する。**バリデーション用とドキュメント生成用でスキーマを分けない** — この`RequestBodySchema`自体を`operation.requestBody`にもそのまま使う。

multipart/form-dataは本来すべての値が文字列またはBlobでしかないため、「デコード(FormData→プレーンオブジェクト)」と「検証(スキーマによる`.safeParse()`)」を分離する。これはJSON bodyの`request.json()` → `Schema.safeParse(json)`と同じ構造に揃えたもの。

1. スキーマファイル側は`RequestBodySchema`(`z.union`、プレーンなzod)と、フィールドごとのデコード方法を示す`RequestBodyFieldKinds`(ただのデータ、`@/util/formData`の`FormDataFieldKind`型)をexportする。

   ```ts
   export const RequestBodySchema = z.union([
       z.object({ uri: z.string(), ogImage: imageField, /* ... */ }).strict(),
       z.object({ images: z.array(imageField), imagesMeta: /* ... */, /* ... */ }).strict(),
   ])

   export const RequestBodyFieldKinds: Record<string, FormDataFieldKind> = {
       uri: "text",
       ogImage: "file",
       images: "files",
       imagesMeta: "json",
       // ...
   }
   ```

2. ルートハンドラ(`src/pages/**`)側は、`@/util/formData`の`formDataToObject()`(ドメイン非依存の汎用デコード関数)でFormDataをデコードしてから検証する。

   ```ts
   const raw = formDataToObject(formData, PostSchema.RequestBodyFieldKinds)
   const body = PostSchema.RequestBodySchema.safeParse(raw)
   ```

参考実装: `src/lib/api/schema/v2/entry/post.ts`(2択)、`src/lib/api/schema/v2/bsky/record/post.ts`(3択)。

## multipartのファイルフィールド

`z.instanceof(Blob).meta({ type: "string", format: "binary" })`という形で定義する。`z.instanceof()`はOpenAPI表現を自動判定できないため、必ず`.meta()`で`type`/`format`を明示する。

## 型のexportについて

`export type XxxType = z.infer<typeof XxxSchema>`は、他の場所から実際に参照される場合のみ書く(現状ハンドラ側は`.safeParse()`の結果型を`body.data`のように直接使うため、多くは未参照)。`Common.errorResponses()`で置き換えられる`ResponseBodyNNNSchema`/`Type`のような、内容が完全に重複するだけの型・定数は追加しない。
