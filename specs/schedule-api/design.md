# 予約投稿API 設計書

## 1. 構成

| パス                                                       | 責務                                             |
| ---------------------------------------------------------- | ------------------------------------------------ |
| `src/pages/v2/schedules.ts`                                | 予約の作成と一覧のハンドラ                       |
| `src/pages/v2/schedules/[id].ts`                           | 予約の内容の取得・置き換え・取消・削除のハンドラ |
| `src/pages/v2/schedules/[id]/images/[index].ts`            | 予約の画像の取得のハンドラ                       |
| `src/pages/v2/schedules/limits.ts`                         | 制限値の取得のハンドラ                           |
| `src/pages/v2/schedules/credential.ts`                     | 予約用認証情報の取得・登録・削除のハンドラ       |
| `src/lib/api/schema/v2/schedules/post.ts`                  | 予約の作成の入力スキーマ                         |
| `src/lib/api/schema/v2/schedules/get.ts`                   | 予約の一覧のクエリと応答のスキーマ               |
| `src/lib/api/schema/v2/schedules/limits/get.ts`            | 制限値の応答のスキーマ                           |
| `src/lib/api/schema/v2/schedules/_id/delete.ts`            | 予約の取消のパスのスキーマ                       |
| `src/lib/api/schema/v2/schedules/_id/get.ts`               | 予約の内容の応答のスキーマ                       |
| `src/lib/api/schema/v2/schedules/_id/put.ts`               | 予約の置き換えの入力スキーマ                     |
| `src/lib/api/schema/v2/schedules/_id/images/_index/get.ts` | 予約の画像の取得のパスと応答のスキーマ           |
| `src/lib/api/schema/v2/schedules/credential/get.ts`        | 認証情報の登録状態のスキーマ                     |
| `src/lib/api/schema/v2/schedules/credential/put.ts`        | 認証情報の登録の入力スキーマ                     |
| `src/lib/api/schema/v2/schedules/credential/delete.ts`     | 認証情報の削除の応答のスキーマ                   |
| `src/lib/schedule/validateSchedule.ts`                     | 実行時刻の範囲と件数の検証、保管形式への変換     |
| `src/lib/schedule/stageSchedule.ts`                        | 作成と置き換えに共通の検証と画像の保管           |
| `src/lib/schedule/scheduleLimits.ts`                       | 実行時刻の範囲と各上限の定数、制限値の組み立て   |
| `src/lib/schedule/scheduleResponse.ts`                     | 識別子つきのエラー応答と JSON 応答の組み立て     |
| `src/lib/schedule/env.ts`                                  | D1・R2・暗号鍵のバインディングの取得             |
| `src/lib/schedule/registerCredential.ts`                   | アプリパスワードでのログインと登録前の検証       |

## 2. 関係図・ワークフロー

予約を扱うハンドラがスキーマと検証処理に依存する方向を示す。

```mermaid
flowchart LR
  schedules --> post
  schedules --> schedulesGet["schedules/get"]
  schedules --> stageSchedule
  schedules --> scheduleResponse
  schedules --> env
  stageSchedule --> validateSchedule
  stageSchedule --> ext_store["予約ストア"]
  schedules --> ext_store
  validateSchedule --> scheduleLimits
  limits --> limitsGet["limits/get"]
  limits --> validateSchedule
  id["[id]"] --> idDelete["_id/delete"]
  id --> idGet["_id/get"]
  id --> idPut["_id/put"]
  id --> stageSchedule
  id --> scheduleResponse
  id --> env
  image["[index]"] --> imageGet["_index/get"]
  image --> ext_store
  image --> scheduleResponse
```

認証情報のハンドラがスキーマと登録処理に依存する方向を示す。

```mermaid
flowchart LR
  credential --> credentialGet["credential/get"]
  credential --> credentialPut["credential/put"]
  credential --> credentialDelete["credential/delete"]
  credential --> registerCredential
  credential --> ext_store["予約ストア"]
  credential --> scheduleResponse
  credential --> env
  registerCredential --> ext_store
```

作成と置き換えの検証順序と、置き換えの競合と認証情報の登録の分岐を示す。

```mermaid
sequenceDiagram
  participant schedules
  participant id as [id]
  participant stageSchedule
  participant validateSchedule
  participant limits
  participant credential
  participant registerCredential
  participant ext_store as 予約ストア
  participant ext_pds as PDS
  schedules->>stageSchedule: stageSchedule
  id->>stageSchedule: stageSchedule
  stageSchedule->>validateSchedule: validateRunAt
  alt 範囲外または未登録
    stageSchedule-->>id: 400 または 409
  else 受け付けられる
    stageSchedule->>validateSchedule: toStoredPayload
    stageSchedule->>ext_store: putImages
    id->>ext_store: updatePendingSchedule
    alt 実行中になっていた
      id->>ext_store: 新しい画像を削除
    else 置き換えた
      id->>ext_store: 古い画像を削除
    end
  end
  schedules->>ext_store: insertSchedule
  credential->>registerCredential: registerScheduleCredential
  registerCredential->>ext_pds: createSession
  alt アプリパスワードで別アカウント
    registerCredential-->>credential: 400
  else 検証に成功
    registerCredential->>ext_store: saveCredential
  end
  credential->>ext_store: deletePendingSchedules
  limits->>validateSchedule: getScheduleLimits
```

## 3. 設計項目

### D-1: 共通の検証とエラー (NFR-1, NFR-2, NFR-3, NFR-4)

| 段階                                         | 失敗時 |
| -------------------------------------------- | ------ |
| `Common.CommonCookieSchema` によるヘッダ検証 | 400    |
| `locals.session` の存在                      | 401    |
| 入力の解析と `safeParse()`                   | 400    |
| 予約の所有者の一致（取得・置き換え・取消）   | 404    |
| 状態や件数の競合                             | 409    |
| 予約件数の上限                               | 429    |
| 想定外の例外                                 | 500    |

- すべての応答に `cache-control: no-store` を付け、エラーの本文は `{ error: string }` とする。
- `error` の値は機械可読の識別子とし、409 は `ScheduleCredentialRequired`・`ScheduleRunning` の2種を返し分ける。
- 入力スキーマは `src/lib/api/schema/v2/schedules/` 配下に定義し、ハンドラはそのスキーマを `safeParse()` に直接渡す。OpenAPI 文書は同じスキーマから生成する。
- ハンドラが静的に読み込むのは Zod・予約ストア・`fetch` のみとし、`@atproto/*` は静的にも動的にも読み込まない。ログには予約の識別子と分類コードだけを出力し、パスワードとトークンを含む値を出力しない。

### D-2: 予約の作成 (FR-1)

```ts
// POST /v2/schedules（multipart/form-data）
const RequestBodySchema = z
  .object({
    posts: z.array(SchedulePostItemSchema).min(1).max(MAX_THREAD_POST_COUNT),
    runAt: z.iso.datetime({ offset: true }),
    reply: Common.CommonReplyRefSchema.optional(),
    createEntry: z.boolean().optional(),
    visual: imageField.optional(),
    heading: headingField.optional(),
    caption: captionField.optional(),
  })
  .strict()

// 投稿の作成の入力から、動画の分岐を除いた3分岐
const SchedulePostItemSchema = z.union(EntryPostItemSchema.options.slice(0, 3))
```

- 画像・リンクカードの画像・代表画像の `Blob` は、`images` `ogImage` `visual` の順に番号を振って取り出す。
- 保管用の本文 `payload` は、`Blob` を `{ imageIndex: number }` に置き換えた JSON とする。
- 検証と画像の保管は `stageSchedule` に任せ、返った `payload` と画像のキーで `insertSchedule` を呼ぶ。

| 応答 | 本文                            |
| ---- | ------------------------------- |
| 200  | `{ id: string, runAt: string }` |

### D-3: 実行時刻と件数の検証 (FR-2, FR-3, FR-8)

```ts
// scheduleLimits.ts
const MIN_LEAD_SECONDS = 5 * 60
const MAX_LEAD_SECONDS = 14 * 24 * 60 * 60
const MAX_PENDING_PER_ACCOUNT = 5 // スレッドも1件と数える

export const validateRunAt = (runAt: string, nowSeconds: number): { ok: true; epoch: number } | { ok: false }
export const toStoredPayload = async (
    body: ScheduleRequestBody,
): Promise<{ payload: StoredPayload; images: { bytes: ArrayBuffer; mime: string }[] }>

// stageSchedule.ts
export const stageSchedule = async (
    env: ScheduleEnv,
    did: string,
    id: string,
    body: ScheduleRequestBody,
    nowSeconds: number,
    opts: { countPending: boolean }, // 作成は真、置き換えは偽
): Promise<{ ok: true; runAt: number; payload: string; imageKeys: string[] } | { ok: false; status: 400 | 409 | 429 | 500; error?: string }>
```

- `validateRunAt` は ISO 8601 の日時を UNIX 秒に変換し、`now + MIN_LEAD_SECONDS` 以上かつ `now + MAX_LEAD_SECONDS` 以下を許可する。
- `stageSchedule` の順序は、実行時刻 → 認証情報の登録（`getCredentialStatus`、未登録は `ScheduleCredentialRequired`）→ 待機中の件数（作成のときだけ）→ 画像の保管 → `touchCredential` とする。
- 待機中の件数は `countPending` が返す予約の行数で数え、投稿の件数を数えない。
- 画像は `putImages` に世代 `Date.now().toString(36)` を渡して保管する。呼び出し側の保存が失敗したときは、保管した画像を削除する。

### D-4: 予約の一覧 (FR-6)

```ts
// GET /v2/schedules?status=pending&limit=20&cursor=...
const QuerySchema = z.object({
  status: z.enum(["pending", "running", "posted", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
})

type ScheduleListItem = {
  id: string
  runAt: string
  status: "pending" | "running" | "posted" | "failed"
  postCount: number
  preview: string // 先頭の投稿の本文の先頭100文字
  lastError: string | null
  resultUri: string | null
}
```

- 応答は `{ items: ScheduleListItem[], cursor?: string }` とし、`runAt` の昇順に並べる。
- 取得は `listSchedules` に常に認証済みアカウントの DID を渡して行う。

### D-5: 予約の取消と履歴の削除 (FR-7)

| 予約の状態       | 処理                                                           | 応答 |
| ---------------- | -------------------------------------------------------------- | ---- |
| 待機中           | `deleteSchedule` で行を削除し、`removeImages` で画像を削除する | 200  |
| 投稿済み・失敗   | `deleteSchedule` で行を削除する                                | 200  |
| 実行中           | 何も変更せず `ScheduleRunning` を返す                          | 409  |
| 存在しない・他人 | 何も変更しない                                                 | 404  |

状態の確認と削除の間に実行が始まる競合を避けるため、削除は `status` が待機中・投稿済み・失敗の行に限定した条件つきの文で行う。

### D-6: 予約用認証情報の登録 (FR-4, FR-5)

```ts
// PUT /v2/schedules/credential
const RequestBodySchema = z.object({ password: z.string().min(1) }).strict()

export const registerScheduleCredential = async (
    db: D1Database,
    secret: string,
    session: { did: string; service: string },
    password: string,
): Promise<{ ok: true } | { ok: false; status: 400 | 401 | 429 | 500 }>
```

| 手順 | 処理                                                                                                                                  | 失敗時                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1    | `${service}/xrpc/com.atproto.server.createSession` へ `{ identifier: did, password }` を `fetch` で送る                               | 401・429 は同じ値、その他は 500 |
| 2    | 応答の `did` が `session.did` と一致することを確認する                                                                                | 400                             |
| 3    | `accessJwt` の本体を Base64URL で復号し、`scope` が `com.atproto.appPass` または `com.atproto.appPassPrivileged` であることを確認する | 400                             |
| 4    | `refreshJwt` を `saveCredential` で暗号化して保存する。`accessJwt` は保存せず破棄する                                                 | 500                             |

- パスワードはメモリ上でのみ扱い、保存・ログ出力・応答のいずれにも含めない。
- 登録で得たセッションは、利用者のブラウザのセッションとは独立した系統であり、ブラウザ側のトークンの更新と互いに無効化し合わない。

### D-7: 認証情報の状態確認と削除 (FR-9)

```ts
// GET /v2/schedules/credential -> { registered: boolean, updatedAt?: string }
// DELETE /v2/schedules/credential -> 200 { cancelled: number } | 409
const CredentialStatusSchema = z.object({
  registered: z.boolean(),
  updatedAt: z.iso.datetime().optional(),
})
const DeleteResponseSchema = z.object({ cancelled: z.number().int() })
```

| 手順 | 処理                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| 1    | `listSchedules` に `status: "running"` を渡し、1件以上なら `ScheduleRunning` の 409 |
| 2    | `deletePendingSchedules` で待機中の予約を削除し、各行の画像を `removeImages` で削除 |
| 3    | `deleteCredential` で認証情報を削除し、取り消した件数を `cancelled` で返す          |

### D-8: 制限値の提供 (FR-10)

```ts
// GET /v2/schedules/limits
type ScheduleLimits = {
    minLeadSeconds: number // MIN_LEAD_SECONDS
    maxLeadSeconds: number // MAX_LEAD_SECONDS
    maxPending: number // MAX_PENDING_PER_ACCOUNT
    maxImageBytes: number // 保管の上限の定数
    maxPosts: number // スレッドの投稿数の上限の定数
}
export const getScheduleLimits = (): ScheduleLimits
```

- 返す値は、作成の検証が参照する定数そのものとし、別の値を持たない。
- 値は実行環境が変わらない限り変化しないため、応答は認証を要する以外に状態を持たない。

### D-9: 予約の内容と画像の取得 (FR-11)

```ts
// GET /v2/schedules/{id}
type ScheduleDetail = {
  id: string
  runAt: string
  posts: {
    text?: string
    langs?: string[]
    selfLabels?: string
    gate?: CommonGateSettingsType
    ogMeta?: CommonOgMetaType
    imagesMeta?: CommonImagesMetaType
    images?: number[] // 画像の番号
    ogImage?: number
  }[]
  reply?: CommonReplyRefType
  createEntry?: boolean
  visual?: number
  heading?: string
  caption?: string
}
// GET /v2/schedules/{id}/images/{index} -> 画像のバイト列（content-type は保管時の値）
```

| 予約の状態       | 内容と画像の応答         |
| ---------------- | ------------------------ |
| 待機中           | 200                      |
| 実行中           | `ScheduleRunning` の 409 |
| 投稿済み・失敗   | 404                      |
| 存在しない・他人 | 404                      |

- 内容は保管した `payload` をそのまま返し、`facets` は含めない。画像は `getImage` に行の `imageKeys` を渡して読む。

### D-10: 予約の置き換え (FR-12)

```ts
// PUT /v2/schedules/{id}（multipart/form-data）。入力は作成と同じ RequestBodySchema
const RequestBodySchema = CreateScheduleRequestBodySchema
// 200 { id: string, runAt: string }
```

| 手順 | 処理                                                    | 失敗時                |
| ---- | ------------------------------------------------------- | --------------------- |
| 1    | `getSchedule` で所有と状態を確かめる                    | 404・409              |
| 2    | `stageSchedule` を `countPending: false` で呼ぶ         | 400・409・500         |
| 3    | `updatePendingSchedule` で置き換える                    | 新しい画像を消して409 |
| 4    | 返った `previousImageKeys` を `removeImages` で削除する | 記録だけする          |

- 置き換えは進捗と再試行の回数を初期値へ戻す。

## 4. エラー処理

| 事象                                       | 処理                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| 画像の保管に失敗                           | 保管済みの画像を削除して 500 を返す                        |
| 予約の保存に失敗                           | 保管した画像を削除して 500 を返す                          |
| 暗号鍵が未設定                             | 認証情報の登録と予約の作成を 500 で拒否する                |
| 登録時のログイン先が応答しない             | 500 を返し、何も保存しない                                 |
| 認証情報の行が予約の作成の直後に削除された | 実行側が失敗として記録し、一覧に失敗の分類コードを表示する |
| 置き換え前の画像の削除に失敗               | 記録だけし、ライフサイクルの削除に任せる                   |
