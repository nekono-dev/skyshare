# entry API 設計書

## 1. 構成

| パス                                    | 責務                                       |
| --------------------------------------- | ------------------------------------------ |
| `src/pages/v2/entry.ts`                 | POST・PUT・DELETE のハンドラ               |
| `src/lib/api/schema/v2/entry/post.ts`   | POST の入力スキーマ                        |
| `src/lib/api/schema/v2/entry/put.ts`    | PUT の入力スキーマ                         |
| `src/lib/api/schema/v2/entry/delete.ts` | DELETE の入力スキーマ                      |
| `src/lib/entry/createBskyThread.ts`     | 投稿・gate・entryの原子的な作成            |
| `src/lib/entry/fromPost.ts`             | 既存の投稿からのentryの作成                |
| `src/lib/entry/skyshareRecord.ts`       | entryレコードの組み立てと更新              |
| `src/lib/entry/resolveDeleteTargets.ts` | 削除対象の投稿の導出                       |
| `src/lib/atproto/threadChain.ts`        | スレッドの起点判定と自分の投稿の連鎖の抽出 |
| `src/lib/atproto/gate.ts`               | 簡略化したgate設定から公式レコードへの変換 |
| `src/lib/api/response.ts`               | エラー応答とatprotoの例外の変換            |

## 2. 設計項目

### D-1: 共通の検証とエラー (NFR-1, NFR-4, NFR-6, NFR-7)

| 段階                                                                     | 失敗時 |
| ------------------------------------------------------------------------ | ------ |
| `Common.CommonCookieSchema` によるヘッダ検証                             | 400    |
| `locals.agent` と `locals.session` の存在                                | 401    |
| 入力の Content-Type と解析                                               | 400    |
| `RequestBodySchema.safeParse()`                                          | 400    |
| `parseOwnedAtUri(uri, collection, did)` によるコレクションと所有者の検証 | 400    |

- エラー応答は `errorResponseFromStatus(status)` で `{ error: string }` と `cache-control: no-store` を返す。
- atprotoの例外は `resolveXrpcStatus` で変換する: 認証系→401、`RateLimitExceeded` `DraftLimitReached`→429、`BlobNotFound` `RepoNotFound` `RecordNotFound`→404、その他→500。
- 入力スキーマはZodで定義し、同じ定義からOpenAPIドキュメントを生成する。アプリ独自の頻度制限は持たない。

### D-2: 新規投稿の入力 (FR-1, FR-2, FR-3, FR-4)

```ts
// multipart/form-data。uri（既存の投稿から作成）か posts（新規投稿）の anyOf
type NewPostsBody = {
  posts: EntryPostItem[] // 1〜MAX_THREAD_POST_COUNT 件
  reply?: ReplyRef // スレッド全体の接続先。自分の投稿であることを isReplyRefOwnedBySelf で検証
  createEntry?: boolean
  visual?: Blob // createEntry が true のとき必須
  heading?: string // 100文字まで。サーバは生成しない
  caption?: string // 300文字まで
}
// テキストのみ・リンクカード付き・画像付きの3分岐の union（各 .strict()）
type EntryPostItem = {
  text?: string
  facets?: Facet[]
  images?: Blob[]
  imagesMeta?: { width: number; height: number; alt?: string }[]
  ogImage?: Blob
  ogMeta?: { title: string; description: string; url: string; image?: string }
  langs?: string[]
  selfLabels?: SelfLabel[]
  gate?: CommonGateSettings
}
```

- `formDataToObject` と `RequestBodyFieldKinds` で `posts[i][...]` を配列に復元する。空文字の `text` は未指定に正規化する。
- 各投稿で、画像の枚数と `imagesMeta` の件数の一致と、facets の終端が本文のバイト長以内であることを検証する。全件の検証が通るまで書き込まない。
- 埋め込みは画像を優先し、画像が1〜4枚なら `app.bsky.embed.images`、5〜10枚なら `app.bsky.embed.gallery`、画像が無くリンクカードがあれば `app.bsky.embed.external` にする。11枚以上はスキーマで400にする。
- `createEntry` が true で `visual` が無ければ400にする。投稿が画像を含むかは検証しない。
- gate は公式の union 型を露出しない簡略化した `CommonGateSettings` で受け取り、`gate.ts` の builder が threadgate・postgate のレコード値に変換する。

### D-3: 原子的な作成 (FR-5, NFR-2, NFR-5)

```
prevTid = undefined
for i in posts:
  rkey[i] = TID.next(prevTid); prevTid = rkey[i]
  record[i].reply = i == 0 ? request.reply
                            : { root: request.reply?.root ?? ref(0), parent: ref(i - 1) }
  cid[i] = cidForLex(record[i]) // 次の投稿の reply と entry の source をPDSの応答を待たずに組み立てる
  writes += create(post[i]) + gate(i)?
if createEntry: writes += create(entry { source: ref(0), manifest: { visual, heading?, caption? } })
results = applyWrites(writes) // PDSが全件成功か全件失敗を保証する
return results から組み立てた { posts: [{ url, uri, cid }], skyshareEntry? }
```

`MAX_THREAD_POST_COUNT`（100）は `src/lib/atproto/threadLimit.ts` の1か所で定義し、投稿の作成と下書きのスキーマが参照する。

### D-4: 既存の投稿からの作成 (FR-6)

| 手順 | 内容                                                    | 失敗時 |
| ---- | ------------------------------------------------------- | ------ |
| 1    | `uri` が自分の `app.bsky.feed.post` か検証する          | 400    |
| 2    | `getRecord` で投稿の本文と cid を取得する               | 404    |
| 3    | `visual` の有無を検証する                               | 400    |
| 4    | `visual` をアップロードする                             | 500    |
| 5    | `source` を `uri` 自身としてentryを `createRecord` する | 500    |

投稿の画像の有無とスレッド上の位置は検証せず、返信の連鎖をたどって派生元を差し替えない。

### D-5: 編集 (FR-7, NFR-3)

```ts
// PUT application/json: { uri: string, heading: string(max 100), caption: string(max 300) }（.strict()）
const current = await agent.com.atproto.repo.getRecord({
  repo,
  collection: ENTRY_COLLECTION,
  rkey,
})
await agent.com.atproto.repo.putRecord({
  repo,
  collection: ENTRY_COLLECTION,
  rkey,
  record: {
    ...current.value,
    manifest: { ...current.value.manifest, heading, caption },
  },
  swapRecord: current.cid, // 読み取り時から変わっていれば失敗させる
})
```

### D-6: 削除 (FR-8, FR-9, FR-10, FR-11)

```ts
// DELETE application/json: { uri: string, deleteBskyPost?: boolean }（.strict()）
export type DeleteTargetsResult =
  | { kind: "targets"; rkeys: string[] } // source 自身を先頭に時系列順
  | { kind: "sourceGone" }
  | { kind: "notThreadRoot" }
export const resolveDeleteTargets = async (
  agent,
  ownerDid,
  sourceUri,
): Promise<DeleteTargetsResult> => {
  // getPostThread({ uri: sourceUri, depth: MAX_THREAD_POST_COUNT, parentHeight: 0 })
  // NotFound の例外・isNotFoundPost → sourceGone、それ以外の例外は投げ直す
  // !isThreadRootPost(thread.post) → notThreadRoot（record.reply を持つ投稿は起点でない）
  // extractOwnedLinearReplyChain(thread, ownerDid, MAX_THREAD_POST_COUNT) の各投稿を
  //   parseOwnedAtUri で所有者検証してから rkey にする
}
```

| 段階                     | 処理                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `deleteBskyPost` が true | entryを `getRecord` して `source` を読む（失敗は404）。entryの削除より前に `resolveDeleteTargets` を呼ぶ |
| `notThreadRoot`          | 409 を返し、何も削除しない                                                                               |
| 導出の例外               | 500 を返し、何も削除しない                                                                               |
| entryの削除              | `deleteRecord`                                                                                           |
| `targets`                | 1件なら `deleteRecord`、2件以上なら1回の `applyWrites`。失敗しても200                                    |
| `deleteBskyPost` が偽    | スレッドを取得せずentryだけを削除する                                                                    |

`extractOwnedLinearReplyChain` は、直前の投稿への自分の返信を次の対象とし、自分の返信が複数ある場合は `createdAt` の差が最小のものを選ぶ。第三者の返信の先はたどらない。

## 3. エラー処理

| 事象                                         | 処理                                  |
| -------------------------------------------- | ------------------------------------- |
| 画像・代表画像・サムネイルのアップロード失敗 | 500                                   |
| リンクカードの埋め込みの組み立て失敗         | 400                                   |
| `applyWrites` の失敗                         | 500（何も作成されない）               |
| 編集時の `swapRecord` の不一致               | atprotoの例外として変換したステータス |
