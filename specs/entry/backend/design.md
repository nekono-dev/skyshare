# v2/entry API 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

対象ファイル:

- ルートハンドラ: [src/pages/v2/entry.ts](../../../src/pages/v2/entry.ts)
- スキーマ: [src/lib/api/schema/v2/entry/post.ts](../../../src/lib/api/schema/v2/entry/post.ts) / [put.ts](../../../src/lib/api/schema/v2/entry/put.ts) / [delete.ts](../../../src/lib/api/schema/v2/entry/delete.ts)
- テスト: [tests/pages/v2/entry.test.ts](../../../tests/pages/v2/entry.test.ts)

本書は、[requirements.md](requirements.md)が定める要件を満たすための具体的な設計方針（リクエスト/レスポンス形式、処理フロー、エラー分類、source解決ロジック等）を示す。

## 1. 概要

`/v2/entry` は、Bluesky投稿（テキスト/OGPリンク/画像。1件、またはスレッドとして複数件）の作成と、各投稿に紐づく skyshare entry（`dev.nekono.skyshare.entry` レコード）の作成・更新・削除を扱う統合エンドポイントである。旧 `/v2/bsky/record` はこのエンドポイントに統合され廃止された。

| メソッド | 用途                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| POST     | 新規Bluesky投稿の作成（1件/スレッド）、または既存投稿からのentry発行（from-post） |
| PUT      | skyshare entry の heading/caption 更新                                            |
| DELETE   | skyshare entry の削除（任意で紐づくBluesky投稿も削除）                            |

## 2. 共通仕様

### 2.1 認証・ヘッダ

全メソッド共通:

| 項目                                          | 内容                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ヘッダ検証                                    | `Common.CommonCookieSchema`（`cookie`ヘッダの存在）                                                      |
| 認証                                          | `locals.agent` / `locals.session` を `bskySessionRefresh` ミドルウェアが供給。両方揃わなければ未認証扱い |
| ヘッダ不正時                                  | 400                                                                                                      |
| 未認証時（ヘッダはあるがagent/session未確立） | 401                                                                                                      |

### 2.2 エラーレスポンス形式

`errorResponseFromStatus(status)` により `{ "error": string }` 形式のJSONを返す（[response.ts](../../../src/lib/api/response.ts)）。

| status        | error文言             |
| ------------- | --------------------- |
| 400           | Bad Request           |
| 401           | Unauthorized          |
| 403           | Forbidden             |
| 404           | Not Found             |
| 429           | Too Many Requests     |
| その他(500等) | Internal Server Error |

atproto呼び出しの例外は `resolveXrpcStatus` でHTTPステータスへ変換される。

| atprotoエラーコード                                  | HTTPステータス |
| ---------------------------------------------------- | -------------- |
| AuthenticationRequired / InvalidToken / ExpiredToken | 401            |
| RateLimitExceeded / DraftLimitReached                | 429            |
| BlobNotFound / RepoNotFound / RecordNotFound         | 404            |
| 上記以外・不明                                       | 500            |

## 3. POST /v2/entry

### 3.1 リクエスト形式

`multipart/form-data`。ボディは2択の `anyOf`（Zod `union`）。

| 分岐         | 必須フィールド                                                                                          | 用途                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A: from-post | `uri`（string）, `visual`（file）                                                                       | 既存の自分のBluesky投稿からskyshare entryを発行する（新規投稿は作らない） |
| B: 新規投稿  | `posts`（1〜100件の配列）, `reply`（任意）, `createEntry`（任意）, `visual`（`createEntry:true`時必須） | 新規投稿を1件、またはスレッドとして複数件、原子的に作成する               |

`RequestBodySchema.safeParse()` に失敗した場合（`uri`も`posts`も条件を満たさない等）は400。

`createEntry`・`visual`（entryの代表画像）は**リクエスト全体につき1組だけ**、`posts`と同階層のトップレベルフィールドとして持つ（[requirements.md FR-1](requirements.md#fr-1-新規bluesky投稿の作成単発スレッド共通)）。投稿ごとの個別指定は行わない（旧`posts[i].createEntry`/`posts[i].entrySource`は廃止）。

FormDataのデコードは `formDataToObject` + `RequestBodyFieldKinds` で1回行う。`posts` は `{kind:"items"}` 種別として宣言されており、`posts[i][...]` というインデックス付きフィールドから配列に復元される。

補足: multipart/form-dataの空文字列 `text` はハンドラ内で未指定相当に正規化してからバリデーションする（`item.text.trim().length === 0` の場合 `delete item.text`）。

### 3.2 `posts[i]` の3分岐（`EntryPostItemSchema`）

Zodの `union`（3分岐、いずれも `.strict()`）。`createEntry`/`entrySource`は含まない（3.1節の通りトップレベルへ移動）。

| 分岐          | 必須                   | 任意                                                                                 |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| テキストのみ  | `text`（1文字以上）    | `facets`, `ogImage`, `ogMeta`, `images`, `imagesMeta`, `langs`, `selfLabels`, `gate` |
| OGPリンク付き | `ogImage`, `ogMeta`    | `text`, `facets`, `images`, `imagesMeta`, `langs`, `selfLabels`, `gate`              |
| 画像付き      | `images`, `imagesMeta` | `text`, `facets`, `ogImage`, `ogMeta`, `langs`, `selfLabels`, `gate`                 |

共通フィールド:

| フィールド   | 型                                               | 説明                                                                     |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `text`       | string(min 1)                                    | 投稿本文                                                                 |
| `facets`     | `CommonFacetsSchema`                             | リッチテキスト注釈（mention/link/tag）。サーバは自動検出しない           |
| `images`     | Blob[]                                           | 画像本体                                                                 |
| `imagesMeta` | `{width, height, alt?}[]`                        | 画像メタデータ。`images`と件数一致必須                                   |
| `ogImage`    | Blob                                             | OGPリンクカード用サムネイル（`ogMeta`とペアで使う。entry作成とは無関係） |
| `ogMeta`     | `{title, description, url, image?}`              | OGPリンクカード情報                                                      |
| `langs`      | string[]                                         | 投稿言語タグ                                                             |
| `selfLabels` | enum(`sexual`,`nudity`,`porn`,`spoiler`,`!warn`) | 自己ラベル                                                               |
| `gate`       | `CommonGateSettingsSchema`                       | 返信可否(threadgate)・引用可否(postgate)設定                             |

トップレベルフィールド（`posts`と同階層。3.1節参照）:

| フィールド    | 型      | 説明                                                                                                                 |
| ------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `createEntry` | boolean | このリクエスト（1件またはスレッド全体）にskyshare entryを1件紐づけるか                                               |
| `visual`      | Blob    | `createEntry:true`時に必須。entryの代表画像素材。リクエスト中のどの`posts[i].images`と一致するかはサーバは検証しない |

注記: 「`createEntry:true`ならリクエスト中に画像投稿（`images`を持つ`posts[i]`）が1件以上必須、かつ`visual`必須」という制約は、`posts`配列全体を見て初めて判定できるためZodスキーマでは表現されず、ハンドラ側（フェーズ5）で検証される。

### 3.3 POST 処理フロー

1. ヘッダ検証 → 不正なら400
2. 認証チェック → 未認証なら401
3. Content-Typeが`multipart/form-data`でなければ400。`request.formData()`のパース失敗も400
4. `RequestBodySchema.safeParse()` → 失敗なら400
5. `uri`指定時（from-post、フェーズ4.5）: `createEntryFromExistingPost`に委譲し結果をそのまま返す（3.4節）
6. `posts`指定時:
   - トップレベル`reply`が自分自身の`app.bsky.feed.post`を指しているか検証（`isReplyRefOwnedBySelf`）→ 不正なら400
   - トップレベル`createEntry:true`の場合、`posts`のいずれか1件以上が画像投稿（`images`を持つ）であり、かつ`visual`が指定されているか検証 → いずれか欠けていれば400
   - 各`posts[i]`について（フェーズ5）:
     - `validateImageMetadata`（画像枚数とメタ件数の一致）失敗なら400
     - `validateFacets`（facetsのbyteEndが本文バイト長以内）失敗なら400
     - embed組み立て: 画像が優先、次点でOGP（画像とOGP両方指定時は画像embedが優先されOGPは無視される）
     - 画像アップロード失敗、OGサムネイルアップロード失敗、embed構築失敗はそれぞれ500/500/400
   - `createEntry:true`時はvisual画像を追加アップロードし、表示名解決（`resolveDisplayName`）
   - `createBskyThread`で全投稿＋gate＋（`createEntry:true`なら）skyshare entryを1回の`applyWrites`により原子的に作成（3.5節）。失敗時は500
7. 結果を200で返却

### 3.4 from-post（`uri`指定時）の詳細（[fromPost.ts](../../../src/lib/entry/fromPost.ts)）

| ステップ | 内容                                                                                                                                                                                   | 失敗時 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1        | `uri`が呼び出し者自身の`app.bsky.feed.post`か検証（`parseOwnedAtUri`）                                                                                                                 | 400    |
| 2        | 対象投稿を`getRecord`で取得                                                                                                                                                            | 404    |
| 3        | 対象投稿が`app.bsky.embed.images`（1枚以上）を持つか検証                                                                                                                               | 400    |
| 4        | `visual`（クライアントが合成したサムネイル）が指定されているか検証                                                                                                                     | 400    |
| 5        | `visual`をアップロードしentryのvisualとして採用                                                                                                                                        | 500    |
| 6        | ステップ2で取得済みの`postRecord.reply.root`をもとに`source`を解決する（[§7.2](#72-source解決規則)。`root`が無い、または`root`のrepoが呼び出し者以外なら対象投稿自身を`source`にする） | -      |
| 7        | `dev.nekono.skyshare.entry`レコードを`createRecord`で作成（`source`はステップ6の解決結果）                                                                                             | 500    |

成功時はBluesky投稿を新規作成せず、既存投稿のURLとトップレベルの`skyshareEntry`を返す。

### 3.5 スレッド投稿の詳細（[createBskyThread.ts](../../../src/lib/entry/createBskyThread.ts)）

- 各投稿の`rkey`は`TID`で事前採番（`TID.next(prevTid)`で単調増加を保証）
- レコードCIDを`cidForLex`で事前計算し、次の投稿の`reply.parent`/`reply.root`、`createEntry:true`時のskyshare entryの`source`（常に`posts[0]`の事前計算済み`uri`/`cid`）をPDS応答を待たずに構築する
- `reply`の決定則:
  - 先頭(i=0)の投稿: リクエストの`reply`（未指定なら通常投稿として開始）
  - 2件目以降: `{root: 先頭投稿の(reply.rootまたは自身), parent: 直前の投稿}`
- gate（threadgate/postgate）は投稿ごとに個別指定可能。指定された投稿のrkeyに紐づけて作成される
- `createEntry:true`の場合、entryレコードは1件のみ組み立てられ`writes`に追加される。どの`posts[i]`の画像を`visual`として使うかはリクエストのトップレベル`visual`が決めるため、entry作成のために特定の`posts[i]`を選ぶ処理はサーバ側に存在しない
- 全レコード（post/gate/entry）を1回の`applyWrites`で送信し、PDS側が全件成功/全件失敗を保証する
- 戻り値は事前計算値ではなく`applyWrites`のレスポンス（`results`）を信頼して組み立てる

### 3.6 レスポンス（200）

```
{
  "posts": [
    {
      "url": string,       // https://bsky.app/profile/{handle}/post/{rkey}
      "uri": string,       // at://...(Bluesky投稿のAT URI)
      "cid": string
    }
  ],
  "skyshareEntry"?: {    // createEntry:true時、またはfrom-post時のみ存在。posts配列とは同階層（トップレベルに1つだけ）
    "uri": string,        // skyshare entryページの絶対URL(webUrl)
    "atUri": string,
    "cid": string,
    "createdAt": string,
    "sourceUri": string,
    "sourceCid": string,
    "heading"?: string,
    "caption"?: string,
    "visualUrl"?: string
  }
}
```

`posts`配列は`min(1)`。`posts[i]`はentry作成有無に関わらず`{url, uri, cid}`のみを持つ（`skyshareEntry`は個々の投稿要素には存在しない）。`skyshareEntry`はレスポンス全体で高々1件であり、entryが作成されなかった場合は省略される。

### 3.7 POSTのステータスコード対応表

| 条件                                                                       | ステータス                                                                 |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| cookieヘッダ無し                                                           | 400                                                                        |
| 未認証（agent/session未確立）                                              | 401                                                                        |
| Content-Typeがmultipartでない                                              | 400                                                                        |
| FormDataとして解釈不可                                                     | 400                                                                        |
| スキーマ不正（`uri`も`posts`も条件を満たさない）                           | 400                                                                        |
| from-post: uriの所有者不一致                                               | 400                                                                        |
| from-post: 対象投稿が見つからない                                          | 404                                                                        |
| from-post: 対象投稿に画像embedが無い                                       | 400                                                                        |
| from-post: visual未指定                                                    | 400                                                                        |
| from-post: visualアップロード失敗                                          | 500                                                                        |
| from-post: entry作成失敗                                                   | 500                                                                        |
| from-post: 成功                                                            | 200                                                                        |
| 新規投稿: `createEntry:true`なのに画像投稿を含まない、または`visual`未指定 | 400                                                                        |
| 新規投稿: 画像枚数とimagesMeta件数不一致                                   | 400                                                                        |
| 新規投稿: facetsのbyteEndが本文バイト長超過                                | 400                                                                        |
| 新規投稿: 画像アップロード失敗                                             | 500                                                                        |
| 新規投稿: visualアップロード失敗                                           | 500                                                                        |
| 新規投稿: external embed構築失敗（`ogMeta.url`欠如等）                     | 400                                                                        |
| 新規投稿: `reply`の所有者不一致                                            | 400                                                                        |
| 新規投稿: `applyWrites`失敗（gate作成失敗含む）                            | 500                                                                        |
| 新規投稿: 成功                                                             | 200                                                                        |
| スレッド: 途中の1件で検証エラー                                            | 400（`applyWrites`は呼ばれない。全件が事前検証を通過して初めて送信される） |
| スレッド: 途中の1件でアップロード失敗                                      | 500                                                                        |

## 4. PUT /v2/entry

### 4.1 リクエスト形式

`application/json`。

```
{ "uri": string, "heading": string(max 100), "caption": string(max 300) }
```

`.strict()`。上記以外のキーは拒否される。

### 4.2 処理フロー

1. ヘッダ検証 → 400
2. 認証チェック → 401
3. JSONパース失敗 → 400
4. `RequestBodySchema.safeParse()`失敗（`uri`欠落等） → 400
5. `uri`が呼び出し者自身の`dev.nekono.skyshare.entry`か検証（`parseOwnedAtUri`） → 不正なら400
6. `updateSkyshareEntry`実行:
   - 対象レコードを`getRecord`で取得（見つからない場合は`RecordNotFound`→`resolveXrpcStatus`により404）
   - `source`・`manifest.visual`・`createdAt`は既存値を維持し、`manifest.heading`/`caption`のみ差し替えて`putRecord`
   - 取得時の`cid`を`swapRecord`に指定し、他リクエストとの競合（lost update）を検出する（atprotoに部分更新はないため、レコード全体を書き直す方式）
7. 成功時は200（本文なし）

### 4.3 PUTのステータスコード対応表

| 条件                                               | ステータス      |
| -------------------------------------------------- | --------------- |
| cookieヘッダ無し                                   | 400             |
| 未認証                                             | 401             |
| JSONとして解釈不可                                 | 400             |
| スキーマ不正（`uri`欠落等）                        | 400             |
| `uri`が自分自身の`dev.nekono.skyshare.entry`でない | 400             |
| 対象entryが見つからない                            | 404             |
| 成功                                               | 200（本文なし） |

## 5. DELETE /v2/entry

### 5.1 リクエスト形式

`application/json`。

```
{ "uri": string, "deleteBskyPost"?: boolean, "deleteBskyThread"?: boolean }
```

`.strict()`。`deleteBskyThread: true`は`deleteBskyPost: true`とあわせて指定された場合にのみ意味を持つ（`deleteBskyPost`が`true`でないのに`deleteBskyThread: true`のみが指定された場合はスキーマ不正として400）。

### 5.2 処理フロー

1. ヘッダ検証 → 400
2. 認証チェック → 401
3. JSONパース失敗 → 400
4. `RequestBodySchema.safeParse()`失敗（`deleteBskyThread:true`かつ`deleteBskyPost`が`true`でない場合を含む） → 400
5. `uri`が呼び出し者自身の`dev.nekono.skyshare.entry`か検証 → 不正なら400
6. `deleteBskyPost:true`指定時のみ、削除前に対象entryレコードを`getRecord`で取得し、`source.uri`/`source.cid`（元投稿のAT URI）を読み出す。取得失敗時は404で終了（entry自体も削除しない）
7. skyshare entryレコードを`deleteRecord`
8. `deleteBskyPost:true`かつ`source.uri`が自分自身の`app.bsky.feed.post`を指す場合、Bluesky投稿の削除に進む。**この削除に失敗してもリクエスト全体は成功（200）として扱う**（entry削除自体は既に完了しているため）。
   - `deleteBskyThread`が未指定または`false`（既定の1対1挙動）: `source.uri`の投稿のみを`deleteRecord`で削除する（従来通り）。
   - `deleteBskyThread:true`: `source.uri`を起点に、呼び出し者自身が投稿した後続投稿を辿って削除対象を導出し（[§7.4.1](#741-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)参照）、1回の`applyWrites`でsource自身を含めて全件削除する。この`applyWrites`が失敗しても、既にentry削除は完了しているためリクエスト全体は成功（200）として扱う。
9. 200（本文なし）を返す

### 5.3 DELETEのステータスコード対応表

| 条件                                                                                                             | ステータス           |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| cookieヘッダ無し                                                                                                 | 400                  |
| 未認証                                                                                                           | 401                  |
| JSONとして解釈不可                                                                                               | 400                  |
| スキーマ不正（`uri`欠落、`deleteBskyPost`が`true`でないのに`deleteBskyThread:true`等）                           | 400                  |
| `uri`が自分自身の`dev.nekono.skyshare.entry`でない                                                               | 400                  |
| `deleteBskyPost:true`指定時、entryが見つからない（getRecord失敗）                                                | 404                  |
| `deleteBskyPost:true`指定時、元投稿（またはスレッド全体削除時のいずれかの投稿）の削除失敗（entry削除は成功済み） | 200                  |
| `deleteBskyPost:false`（または未指定）                                                                           | 200（entryのみ削除） |
| 成功                                                                                                             | 200（本文なし）      |

## 6. 設計上の重要な不変条件（テストが担保している性質）

| 不変条件                                                                                          | 根拠                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POSTの新規投稿は「全件成功か全件失敗」（原子性）                                                  | `createBskyThread`が1回の`applyWrites`で全レコードを送信するため。事前検証（画像枚数・facets範囲等）で1件でも失敗すれば`applyWrites`自体を呼ばない             |
| reply chainの相手先は必ず呼び出し者自身の投稿                                                     | `isReplyRefOwnedBySelf`（トップレベル`reply`）、`parseOwnedAtUri`（from-postの`uri`、PUT/DELETEの`uri`、DELETEのsource）                                       |
| 画像とOGPを同時指定した場合は画像embedが優先される                                                | フェーズ5の`if (hasImages...) ... else if (item.ogMeta && item.ogImage)`分岐                                                                                   |
| `createEntry:true`は`posts`に画像投稿が1件以上含まれる場合のみ有効                                | `createEntry`はトップレベルフィールドのため、ハンドラのフェーズ5が`posts`全体を走査し、画像投稿を1件も含まなければ400にする                                    |
| PUT/DELETEの`heading`/`caption`更新・削除は、クライアント指定のuriをそのまま信用しない            | `parseOwnedAtUri`によるcollection/repo検証。DELETEの元投稿削除も、entryレコードに記録された`source`から導出し、クライアント指定値を使わない                    |
| entry削除失敗時、Bluesky投稿削除の失敗は握りつぶす（entry削除の成功を優先）                       | DELETE フェーズ5、テスト「元投稿の削除に失敗してもentry削除自体は200を返す」                                                                                   |
| スレッド全体削除（`deleteBskyThread:true`）でも、削除対象はすべて呼び出し者自身が所有する投稿のみ | `source`から辿った各投稿についてrepo（DID）を1件ずつ検証してから削除対象に含める（[§7.4.1](#741-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)） |

## 7. sourceの解決ロジック

`dev.nekono.skyshare.entry`の`source`は汎用の`strongRef`であり、lexiconスキーマ自体（`source`が特定のcollectionに縛られないこと等）は[specs/entry/lexicons/design.md](../lexicons/design.md)を参照。本節は、entryの`source`がBlueskyのスレッド構造（reply chain）上のどの投稿を指すかを、`/v2/entry`のAPIとしてどう解決するかという設計を定める。方針の決定経緯・理由は[requirements.md FR-2](requirements.md#fr-2-entryのsourceの自動解決)を参照。

### 7.1 設計方針

- entryの`source`は常にサーバが自動的に解決し、クライアントが解決方針を選択する余地は無い（旧`entrySource`フィールドは廃止した）。
- 投稿ごとに個別のentryを作る運用（旧`entrySource: "self"`の明示選択）は提供しない。1回の投稿作成リクエスト（またはfrom-post）につき、作成できるentryは常に高々1件であり、その`source`は次節の規則で一意に決まる。

### 7.2 source解決規則

作成できるentryは1リクエストにつき常に高々1件であり、`source`の解決先は経路ごとに以下の通り一意に決まる。

| 経路                                   | `source`の解決先                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST 新規投稿・スレッド（`posts`配列） | 常にスレッド先頭（`posts[0]`）の（事前計算済み）`uri`/`cid`。単発投稿（`posts.length === 1`）では`posts[0]`が投稿自身であるため、結果として自身が`source`になる |
| POST from-post（`uri`指定）            | [§7.3](#73-from-postの場合の追加規則)参照                                                                                                                       |

新規投稿・スレッド経路では、`reply.root`同様にPDSへの実書き込みを待たずに事前計算済みの`uri`/`cid`を使うため、追加のPDS呼び出しは発生しない。entryの`source`はスレッド内の他の投稿（root/parent等）への参照を複数持つことはない（`source`はあくまで単一の`strongRef`であり、スレッド全体を復元する手段ではない）。

関連ファイル: [createBskyThread.ts](../../../src/lib/entry/createBskyThread.ts)（`source`解決ロジック）

### 7.3 from-postの場合の追加規則

検証条件は「呼び出し者自身の投稿であること」（`parseOwnedAtUri`）と「`app.bsky.embed.images`を1枚以上持つこと」（[fromPost.ts](../../../src/lib/entry/fromPost.ts)の`hasEligibleImage`判定）の2点。対象投稿がスレッドの先頭・中間・末尾のいずれであっても区別せず発行を許可する。

| 条件                                                                                 | `source`の解決先                                                                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 対象投稿の`postRecord.reply.root`が存在し、かつrepo（DID）が呼び出し者自身と一致する | `root`の`uri`/`cid`                                                                                                                |
| `reply.root`が無い、または`root`のrepoが呼び出し者以外                               | 対象投稿自身の`uri`/`cid`（他人が起点のスレッドを自分のentryの`source`にすり替えることを防ぐための安全側の規則。エラーにはしない） |

関連ファイル: [fromPost.ts](../../../src/lib/entry/fromPost.ts)（[§3.4 ステップ6](#34-from-posturi指定時の詳細frompostts)）

### 7.4 entry削除経路（DELETE）

- `deleteBskyPost:true`指定時、entryレコードの`source.uri`から元投稿を特定する（フェーズ5）。
- **既定（`deleteBskyThread`未指定またはfalse）**: `source.uri`の投稿1件のみを`deleteRecord`で削除する。削除対象の投稿がスレッドの中間に位置する場合でも、**後続の投稿（その投稿へreplyしている投稿群）に対しては一切操作を行わない**。AT Protocol自体もreply先の削除を検知して後続投稿の`reply.parent`/`reply.root`を書き換える機能を持たないため、後続投稿のreply参照は削除された投稿を指したまま残る（いわゆる「dangling reference」）。これはSkyshare固有の問題ではなく、AT Protocol / Blueskyの一般的な挙動である。Bluesky公式クライアントも、スレッド中間の投稿が削除された場合は「このポストは削除されました」のようなプレースホルダー表示で対応しており、reply chainの構造自体を修復する仕組みは持たない（変更予定なし。理由は[requirements.md §4](requirements.md#4-明示的な非対応意図的な制約)を参照）。
- **`deleteBskyThread:true`指定時**: `source.uri`を起点に、呼び出し者自身が投稿した後続投稿を辿ってすべて削除する（[§7.4.1](#741-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)）。`source`が単発投稿（後続の自己投稿が存在しない）の場合でも指定自体は禁止しないが、その場合は実質的に1件のみの削除（既定と同じ結果）になる。
- DELETE経路は[§7.1〜§7.3](#71-設計方針)のsource解決規則の対象外であり、削除時に`source`の指す先を再解釈することはない（`source`は常にentryレコードに記録済みの値をそのまま使う）。

#### 7.4.1 スレッド全体削除（`deleteBskyThread:true`）のときの削除対象の導出

- クライアントは削除対象の投稿一覧を送信しない。サーバが`source.uri`を起点に、`app.bsky.feed.getPostThread`（`AtpAgent`経由）でreply chainを取得し、削除対象を導出する（NFR-1: クライアント指定値を信用しない）。
- 削除対象に含めるのは、`source`自身、および`source`から**呼び出し者自身が投稿した後続投稿のみをたどった直線的なreply chain**である。具体的には、`source`（または直前に削除対象と判定した投稿）への返信のうち、投稿者（DID）が呼び出し者自身と一致するものを次の削除対象候補とし、以降も同じ規則で辿り続ける。第三者の返信で分岐した先（その返信へのさらなる返信。仮に呼び出し者自身の投稿であっても）は削除対象に含めない。この抽出規則は、フロントエンドのentry詳細ページのスレッド表示（[specs/entry/frontend/design.md §3.3](../frontend/design.md#33-entry詳細ページのスレッド表示fr-4対応)）が用いる「entry所有者自身の投稿のみを時系列順に抽出する」規則と整合させる。
- 導出した各投稿について、`parseOwnedAtUri`相当の所有者検証（collection種別・repo DIDの一致）を1件ずつ行ってから削除対象に含める。検証に失敗する投稿（＝呼び出し者以外が所有する投稿）が万一混入した場合は、その投稿を削除対象から除外する（サーバ側の導出ロジックが正しければ発生しないはずだが、フェイルセーフとして所有権検証を省略しない）。
- 削除対象が複数件になる場合、1回の`applyWrites`（すべて`deleteRecord`オペレーション）でまとめて削除する（NFR-2: 全件成功か全件失敗）。1件のみ（`source`が単発投稿、または後続の自己投稿が存在しない）場合は既定の1対1削除と同じ`deleteRecord`呼び出しに帰着してよい。
- スレッド探索の深さ・件数には`MAX_THREAD_POST_COUNT`（[src/lib/atproto/post.ts](../../../src/lib/atproto/post.ts)）を上限として用い、`applyWrites`の1リクエストあたりの書き込み件数を予測可能な範囲に収める。

関連ファイル: [src/pages/v2/entry.ts](../../../src/pages/v2/entry.ts)（DELETEフェーズ5・6）。削除対象導出ロジックの配置は[tasks.md](tasks.md)で定める。

### 7.5 一覧表示への影響（`GET /v2/entries/skyshare`）

- entryの`source`投稿が削除済みの場合、[entries/skyshare.ts](../../../src/pages/v2/entries/skyshare.ts)の`fetchAliveSourceUris`（`app.bsky.feed.getPosts`による生存確認）が`orphaned: true`を付与する。
- この`orphaned`判定は「`source`のuriがまだ存在するか」のみを見ており、スレッド構造の欠落（reply chainの途中が消えている等）は判定材料にしていない。中間投稿が削除されてスレッドが分断されていても、削除された投稿自身のentryのみが`orphaned`になり、他の投稿（分断されたスレッドの残り部分）のentryには一切影響しない。
- `source`が常にスレッド先頭を指すようになっても、この判定ロジック自体に変更は不要（スレッド先頭投稿の生存確認になるだけで、判定方式は変わらない）。
