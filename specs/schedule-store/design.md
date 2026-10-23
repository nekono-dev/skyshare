# 予約ストア 設計書

## 1. 構成

| パス                                   | 責務                                       |
| -------------------------------------- | ------------------------------------------ |
| `src/lib/schedule/types.ts`            | 予約の型・状態・上限値の定義               |
| `src/lib/schedule/cfTypes.ts`          | D1 と R2 とバインディングの最小の型        |
| `src/lib/schedule/store.ts`            | 予約と認証情報の保管、取り出し、状態の遷移 |
| `src/lib/schedule/credentialCrypto.ts` | 認証情報の暗号化と復号                     |
| `src/lib/schedule/imageStaging.ts`     | 添付画像の一時保管と削除                   |

## 2. 関係図・ワークフロー

保管処理が型の定義と暗号化と画像の保管へ依存する方向を示す。

```mermaid
flowchart LR
  store --> types
  store --> cfTypes
  imageStaging --> cfTypes
  store --> credentialCrypto
  store --> imageStaging
  imageStaging --> types
  credentialCrypto --> ext_secret["Worker シークレット"]
  store --> ext_d1["D1"]
  imageStaging --> ext_r2["R2"]
```

予約の登録と、取り出しから終了までの流れを示す。

```mermaid
sequenceDiagram
  participant store
  participant credentialCrypto
  participant imageStaging
  participant ext_d1 as D1
  participant ext_r2 as R2
  store->>imageStaging: putImages
  imageStaging->>ext_r2: 画像の書き込み
  store->>credentialCrypto: encryptToken
  store->>ext_d1: insertSchedule
  store->>ext_d1: saveCredential
  store->>ext_d1: getCredentialStatus
  store->>ext_d1: countPending と getSchedule
  store->>ext_d1: listSchedules
  store->>ext_d1: deleteSchedule
  store->>ext_d1: updatePendingSchedule
  store->>ext_d1: deletePendingSchedules
  store->>imageStaging: getImage
  store->>ext_d1: claimDueSchedules
  alt 到来した予約がない
    ext_d1-->>store: 空の配列
  else 到来した予約がある
    ext_d1-->>store: 実行中へ遷移した予約
    store->>credentialCrypto: decryptToken
    store->>ext_d1: saveProgress
    store->>ext_d1: releaseSchedule
    store->>ext_d1: failSchedule/completeSchedule
    store->>imageStaging: removeImages
    store->>ext_d1: touchCredential
    store->>ext_d1: loadCredential
    store->>ext_d1: requeueStale
    store->>ext_d1: STALE_SECONDS
    store->>ext_d1: purgeFinished
    store->>ext_d1: FINISHED_RETENTION_SECONDS
    store->>ext_d1: purgeIdleCredentials
    store->>ext_d1: CREDENTIAL_IDLE_SECONDS
    store->>ext_d1: markCredentialReauth
    store->>ext_d1: purgeReauthMarkers
    store->>ext_d1: REAUTH_MARKER_KEEP_SECONDS
    store->>ext_d1: deleteCredential
    store->>ext_d1: purgeOAuthStates
  end
  store->>ext_d1: saveOAuthState
  store->>ext_d1: takeOAuthState
  store->>ext_d1: OAUTH_STATE_TTL_SECONDS
```

## 3. 設計項目

### D-1: 予約の型と状態 (FR-1, NFR-1)

```ts
type ScheduleStatus = "pending" | "running" | "failed"

type ScheduleRow = {
  id: string // TID
  did: string
  runAt: number // UNIX 秒
  status: ScheduleStatus
  payload: string // 投稿・entry・gate の JSON
  imageKeys: string // R2 キーの JSON 配列
  progress: string // 実行の進捗の JSON
  attempts: number
  lastError: string | null // 失敗の分類コード
  updatedAt: number
  finishedAt: number | null
}

const CLAIM_LIMIT = 5
const MAX_IMAGE_BYTES_PER_SCHEDULE = 10 * 1000 * 1000
```

データベースのスキーマは次のとおりとする。適用済みの移行は書き換えないため、`status` の CHECK の `posted` と `result_uri` 列は残るが、コードは使わない（成功した予約は行ごと削除する）。

```sql
CREATE TABLE scheduled_posts (
  id TEXT PRIMARY KEY, did TEXT NOT NULL, run_at INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','posted','failed')),
  payload TEXT NOT NULL, image_keys TEXT NOT NULL DEFAULT '[]',
  progress TEXT NOT NULL DEFAULT '{}', attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, result_uri TEXT, updated_at INTEGER NOT NULL, finished_at INTEGER
);
CREATE INDEX scheduled_posts_due ON scheduled_posts (status, run_at);
CREATE INDEX scheduled_posts_owner ON scheduled_posts (did, status);
CREATE TABLE schedule_credentials (
  did TEXT PRIMARY KEY, service TEXT NOT NULL, token_enc TEXT NOT NULL, updated_at INTEGER NOT NULL,
  authorized_at INTEGER NOT NULL DEFAULT 0, reauth_required INTEGER NOT NULL DEFAULT 0 -- 0004 で追加
);
```

### D-2: 予約の保存・取得・置き換え・削除 (FR-2, FR-11, NFR-3)

```ts
export const insertSchedule = (db: D1Database, row: NewSchedule): Promise<void>
export const getSchedule = (db: D1Database, did: string, id: string): Promise<ScheduleRow | null>
export const listSchedules = (
    db: D1Database,
    did: string,
    opts: { status?: ScheduleStatus; limit: number; cursor?: string },
): Promise<{ items: ScheduleRow[]; cursor?: string }>
export const deleteSchedule = (db: D1Database, did: string, id: string): Promise<ScheduleRow | null>
export const countPending = (db: D1Database, did: string): Promise<number>
export const updatePendingSchedule = (
    db: D1Database,
    did: string,
    id: string,
    next: { runAt: number; payload: string; imageKeys: string[] },
    now: number,
): Promise<{ previousImageKeys: string[] } | null>
export const deletePendingSchedules = (db: D1Database, did: string): Promise<ScheduleRow[]>
```

- すべての問い合わせは `WHERE did = ?` を含める。
- `deleteSchedule` は `running` 以外の行だけを削除してその行を返し、呼び出し側が画像のキーを使って削除する。実行中の行は削除せず `null` を返す。
- 一覧のカーソルは最後の行の `(run_at, id)` を base64 にした値とする。
- `updatePendingSchedule` は、`getSchedule` で置き換え前の画像のキーを読み、`UPDATE ... WHERE did = ? AND id = ? AND status = 'pending'` で `run_at`・`payload`・`image_keys`・`updated_at` を置き換え、`progress` と `attempts` を初期値へ戻す。更新が0件なら `null` を返す。
- `deletePendingSchedules` は `DELETE ... WHERE did = ? AND status = 'pending' RETURNING *` の1文で削除し、削除した行を返す。画像の削除は呼び出し側が行う。

### D-3: 取り出しと進捗 (FR-3, FR-7, FR-10, NFR-1)

```ts
export const claimDueSchedules = (db: D1Database, now: number, limit: number): Promise<ScheduleRow[]>
export const saveProgress = (db: D1Database, id: string, progress: Progress, now: number, attempts?: number): Promise<boolean>
export const releaseSchedule = (db: D1Database, id: string, countAttempt: boolean, now: number): Promise<void>
export const failSchedule = (db: D1Database, id: string, lastError: string, now: number): Promise<void>
export const completeSchedule = (db: D1Database, id: string): Promise<void>

type Progress = {
    rkeys: string[] // 投稿ごとに事前採番した TID
    blobs: Record<number, unknown> // 画像の番号 -> アップロード済みの blob
    created: { uri: string; cid: string }[] // 作成済みの投稿
    gates: number // 作成済みの gate の件数
    entryDone: boolean
}
```

| 段階 | SQL の方針                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 取得 | `UPDATE ... SET status='running', updated_at=? WHERE id IN (SELECT id ... WHERE status='pending' AND run_at<=? ORDER BY run_at LIMIT ?) RETURNING *` の1文で取り出しと遷移を行う |
| 進捗 | `status='running'` の行だけを更新し、`updated_at` を更新する                                                                                                                     |
| 戻し | `status='running'` の行だけを `pending` に戻し、`countAttempt` が真のときだけ `attempts` に1を加える。`progress` は変えない                                                      |
| 失敗 | `status` を `failed` にして `last_error` と `finished_at` を設定し、`running` の行だけを更新する。内容と画像は書き戻せるよう残す                                                 |
| 完了 | `running` の行だけを削除する。成功した予約は履歴に残さない                                                                                                                       |

`limit` は `CLAIM_LIMIT` を超えた値を渡されても `CLAIM_LIMIT` に丸める。

### D-4: 停止した予約の復帰と履歴の削除 (FR-8, FR-9)

```ts
export const requeueStale = (db: D1Database, now: number, staleSeconds: number): Promise<number>
export const purgeFinished = (db: D1Database, now: number, retentionSeconds: number): Promise<ScheduleRow[]>

export const STALE_SECONDS = 600
export const FINISHED_RETENTION_SECONDS = 7 * 24 * 60 * 60
```

- `requeueStale` は `running` で `updated_at` が `now - staleSeconds` より古い行を `pending` に戻し、`attempts` に1を加える。
- `purgeFinished` は `failed` で `finished_at` が保持期間より古い行を削除し、削除した行を返す。画像の削除は、返った行の画像のキーを使って呼び出し側が行う。

### D-5: 認証情報の暗号化と保管 (FR-4, FR-5, NFR-2)

```ts
export const encryptToken = (secret: string, did: string, token: string): Promise<string>
export const decryptToken = (secret: string, did: string, encrypted: string): Promise<string>

export const saveCredential = (db: D1Database, secret: string, c: { did: string; service: string; token: string }, now: number, opts?: { authorized?: boolean }): Promise<void>
export const getCredentialStatus = (db: D1Database, did: string): Promise<CredentialStatus> // 登録ありなら reauthRequired・updatedAt・authorizedAt・latestRunAt
export const loadCredential = (db: D1Database, secret: string, did: string): Promise<{ service: string; token: string } | null>
export const touchCredential = (db: D1Database, did: string, now: number): Promise<void>
export const deleteCredential = (db: D1Database, did: string): Promise<void>
export const purgeIdleCredentials = (db: D1Database, now: number, idleSeconds: number): Promise<number>
export const markCredentialReauth = (db: D1Database, did: string): Promise<void>
export const purgeReauthMarkers = (db: D1Database, now: number, retentionSeconds: number): Promise<number>
export const saveOAuthState = (db: D1Database, secret: string, s: { state: string; did: string; data: string }, now: number): Promise<void>
export const takeOAuthState = (db: D1Database, secret: string, state: string, did: string, now: number): Promise<string | null>
export const purgeOAuthStates = (db: D1Database, now: number): Promise<number>

export const CREDENTIAL_IDLE_SECONDS = 30 * 24 * 60 * 60
export const OAUTH_STATE_TTL_SECONDS = 10 * 60
```

| 項目     | 値                                                                        |
| -------- | ------------------------------------------------------------------------- |
| 方式     | AES-GCM 256 ビット、`crypto.subtle` を使う                                |
| 鍵       | Worker のシークレット `SCHEDULE_ENC_KEY`（Base64 の 32 バイト）を取り込む |
| IV       | 暗号化のたびに 12 バイトの乱数を生成する                                  |
| AAD      | アカウントの DID（別アカウントの行への差し替えで復号に失敗させる）        |
| 保管形式 | `Base64(IV ‖ 暗号文)`                                                     |

- 認証情報の行の `updated_at` を最後の使用の時刻とする。使用は、登録（`saveCredential`）・予約の作成と置き換え（`touchCredential`）・実行でのトークンの更新（`saveCredential`）の3つとする。
- `purgeIdleCredentials` は、`updated_at` が `now - idleSeconds` より古く、同じ DID の `pending` と `running` の予約が無い行を1文で印（`token_enc` を空、`reauth_required = 1`）に替え、件数を返す。
- `markCredentialReauth` は失効が分かった行を印に替える。印の行は `loadCredential` で返さず、`getCredentialStatus` では登録ありで返す。
- `purgeReauthMarkers` は、`updated_at` が `now - retentionSeconds`（180日）より古く予約の無い印の行を削除する。
- `saveCredential` は印を外す。`authorized` が真のときだけ `authorized_at` を `now` にし、トークンの回転では保つ。
- `deleteCredential` は、予約の有無によらず行を削除する。
- 認証情報の `token` には、OAuth の更新用トークン・DPoP の鍵・認可サーバーの端点・クライアントの識別子をまとめた JSON の文字列を入れ、`service` には PDS の URL を入れる。
- 認可の途中の状態は `schedule_oauth_states`（`state`・`did`・`data_enc`・`created_at`）に、認証情報と同じ方式で暗号化して保管する。`takeOAuthState` は `DELETE ... RETURNING` の1文で取り出して消し、別の DID と `OAUTH_STATE_TTL_SECONDS` を過ぎた行は null にする。`purgeOAuthStates` は定期実行の後片付けで期限を過ぎた行を消す。

### D-6: 添付画像の一時保管 (FR-6, FR-12, NFR-1, NFR-4)

```ts
export const putImages = (
    bucket: R2Bucket,
    did: string,
    id: string,
    generation: string, // 保存のたびに変える世代。Date.now() の36進数
    images: { bytes: ArrayBuffer; mime: string }[],
): Promise<string[]>
export const removeImages = (bucket: R2Bucket, keys: string[]): Promise<void>
export const getImage = (
    bucket: R2Bucket,
    did: string,
    keys: string[],
    index: number,
): Promise<{ bytes: ArrayBuffer; mime: string } | null>
```

- キーは `schedules/{did}/{id}/{世代}/{番号}` とする。置き換えで新しい画像を書いてから古い画像を消すため、世代で同じ予約の新旧のキーを分ける。
- 画像の合計バイト数が `MAX_IMAGE_BYTES_PER_SCHEDULE` を超えるときは、書き込まずに例外を投げる。
- 途中で書き込みに失敗したときは、書き込み済みのキーを削除してから例外を投げる。
- `getImage` は、`keys[index]` が `schedules/{did}/` で始まるときだけ読み出し、範囲外の番号・別アカウントのキー・存在しないオブジェクトでは `null` を返す。
- バケットには、保管から15日を過ぎたオブジェクトを削除するライフサイクルルール（`--expire-days 15`）を設定し、削除漏れの保管を残さない。予約は14日後までのため、置き換えのたびに画像を書き直す限り、待機中の予約の画像はルールで消えない。

## 4. エラー処理

| 事象                           | 処理                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| 暗号鍵が未設定または不正な長さ | 例外を投げ、認証情報を保管も復号もしない                       |
| 復号に失敗                     | 例外を投げる。呼び出し側は予約を失敗として扱う                 |
| 画像の合計が上限を超過         | 何も書き込まず例外を投げる                                     |
| 画像の削除に失敗               | 例外を握りつぶさずに記録し、ライフサイクルルールの削除に任せる |
| 進捗の保存で行が実行中でない   | 更新0件として扱い、呼び出し側へ実行の中止を知らせる            |
