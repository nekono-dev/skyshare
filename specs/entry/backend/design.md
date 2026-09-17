# v2/entry API 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

対象ファイル:

- ルートハンドラ: [src/pages/v2/entry.ts](../../../src/pages/v2/entry.ts)
- スキーマ: [src/lib/api/schema/v2/entry/post.ts](../../../src/lib/api/schema/v2/entry/post.ts) / [put.ts](../../../src/lib/api/schema/v2/entry/put.ts) / [delete.ts](../../../src/lib/api/schema/v2/entry/delete.ts)
- テスト: [tests/pages/v2/entry.test.ts](../../../tests/pages/v2/entry.test.ts)

本書は、[requirements.md](requirements.md)が定める要件を満たすための具体的な設計方針（リクエスト/レスポンス形式、処理フロー、エラー分類、sourceの決定ロジック等）を示す。

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

注記: `createEntry:true`ならリクエスト全体につき`visual`必須、という制約のみをハンドラ側（フェーズ5）で検証する。旧仕様にあった「`posts`のいずれかが画像投稿であること」という追加検証は行わない（[requirements.md FR-1](requirements.md#fr-1-新規bluesky投稿の作成単発スレッド共通)、サーバはentryの作成対象としての妥当性を判定しない）。

### 3.3 POST 処理フロー

1. ヘッダ検証 → 不正なら400
2. 認証チェック → 未認証なら401
3. Content-Typeが`multipart/form-data`でなければ400。`request.formData()`のパース失敗も400
4. `RequestBodySchema.safeParse()` → 失敗なら400
5. `uri`指定時（from-post、フェーズ4.5）: `createEntryFromExistingPost`に委譲し結果をそのまま返す（3.4節）
6. `posts`指定時:
   - トップレベル`reply`が自分自身の`app.bsky.feed.post`を指しているか検証（`isReplyRefOwnedBySelf`）→ 不正なら400
   - トップレベル`createEntry:true`の場合、`visual`が指定されているか検証 → 欠けていれば400（`posts`が画像投稿を含むかどうかは検証しない）
   - 各`posts[i]`について（フェーズ5）:
     - `validateImageMetadata`（画像枚数とメタ件数の一致）失敗なら400
     - `validateFacets`（facetsのbyteEndが本文バイト長以内）失敗なら400
     - embed組み立て: 画像が優先、次点でOGP（画像とOGP両方指定時は画像embedが優先されOGPは無視される）
     - 画像アップロード失敗、OGサムネイルアップロード失敗、embed構築失敗はそれぞれ500/500/400
   - `createEntry:true`時はvisual画像を追加アップロードし、表示名解決（`resolveDisplayName`）
   - `createBskyThread`で全投稿＋gate＋（`createEntry:true`なら）skyshare entryを1回の`applyWrites`により原子的に作成（3.5節）。失敗時は500
7. 結果を200で返却

### 3.4 from-post（`uri`指定時）の詳細（[fromPost.ts](../../../src/lib/entry/fromPost.ts)）

| ステップ | 内容                                                                                                     | 失敗時 |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| 1        | `uri`が呼び出し者自身の`app.bsky.feed.post`か検証（`parseOwnedAtUri`）                                     | 400    |
| 2        | 対象投稿を`getRecord`で取得（`postText`・`postCid`の取得のため。画像embedの有無は検証しない）              | 404    |
| 3        | `visual`（クライアントが合成したサムネイル）が指定されているか検証                                         | 400    |
| 4        | `visual`をアップロードしentryのvisualとして採用                                                            | 500    |
| 5        | `dev.nekono.skyshare.entry`レコードを`createRecord`で作成する。`source`は`uri`（ステップ1で検証済みの対象投稿）自身であり、追加の解決処理は行わない（[§7.2](#72-source決定規則)） | 500    |

成功時はBluesky投稿を新規作成せず、既存投稿のURLとトップレベルの`skyshareEntry`を返す。旧実装が行っていた「対象投稿が画像embedを持つか」の検証、および`postRecord.reply.root`を辿る`source`の自動解決（`resolveFromPostSource`・`isPostOnOwnedRootChain`）は撤廃する（[requirements.md FR-1・FR-2](requirements.md#fr-1-新規bluesky投稿の作成単発スレッド共通)）。

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
| from-post: visual未指定                                                    | 400                                                                        |
| from-post: visualアップロード失敗                                          | 500                                                                        |
| from-post: entry作成失敗                                                   | 500                                                                        |
| from-post: 成功（対象投稿の画像有無・スレッド上の位置は問わない）          | 200                                                                        |
| 新規投稿: `createEntry:true`なのに`visual`未指定                          | 400                                                                        |
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
   - `deleteBskyThread:true`: `source.uri`を起点に、呼び出し者自身が投稿した後続投稿を辿って削除対象を導出し（[§7.3.1](#731-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)参照）、1回の`applyWrites`でsource自身を含めて全件削除する。この`applyWrites`が失敗しても、既にentry削除は完了しているためリクエスト全体は成功（200）として扱う。
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
| `createEntry:true`は`visual`が指定されている場合のみ有効（`posts`が画像投稿を含むかは問わない）   | `createEntry`はトップレベルフィールドのため、ハンドラのフェーズ5は`visual`の有無のみを検証する（[requirements.md FR-1](requirements.md#fr-1-新規bluesky投稿の作成単発スレッド共通)）                                    |
| PUT/DELETEの`heading`/`caption`更新・削除は、クライアント指定のuriをそのまま信用しない            | `parseOwnedAtUri`によるcollection/repo検証。DELETEの元投稿削除も、entryレコードに記録された`source`から導出し、クライアント指定値を使わない                    |
| entry削除失敗時、Bluesky投稿削除の失敗は握りつぶす（entry削除の成功を優先）                       | DELETE フェーズ5、テスト「元投稿の削除に失敗してもentry削除自体は200を返す」                                                                                   |
| スレッド全体削除（`deleteBskyThread:true`）でも、削除対象はすべて呼び出し者自身が所有する投稿のみ | `source`から辿った各投稿についてrepo（DID）を1件ずつ検証してから削除対象に含める（[§7.3.1](#731-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)） |

## 7. sourceの決定ロジック

`dev.nekono.skyshare.entry`の`source`は汎用の`strongRef`であり、lexiconスキーマ自体（`source`が特定のcollectionに縛られないこと等）は[specs/entry/lexicons/design.md](../lexicons/design.md)を参照。本節は、entryの`source`がBlueskyのスレッド構造（reply chain）上のどの投稿を指すかを、`/v2/entry`のAPIとしてどう決定するかという設計を定める。方針の決定経緯・理由は[requirements.md FR-2](requirements.md#fr-2-entryのsourceの決定)を参照。

### 7.1 設計方針

- entryの`source`は、サーバがreply chainを辿って自動解決するものではなく、常にリクエストの内容から機械的に一意に定まる（新規投稿・スレッドなら`posts[0]`、from-postなら指定された`uri`自身）。`record.reply`を読んで別の投稿へ`source`を差し替える処理はサーバに存在しない（旧`entrySource`フィールドは廃止済み）。
- どの投稿を対象にentryを作成するのが適切か（スレッドのどの位置を指定すべきか）はクライアントの判断に委ねられており、その判断基準は[specs/timeline/requirements.md](../../timeline/requirements.md)（Timeline上でのentry作成導線）が定める。サーバはこの判断の妥当性を検証しない。

### 7.2 source決定規則

作成できるentryは1リクエストにつき常に高々1件であり、`source`は経路ごとに以下の通り機械的に一意に決まる。

| 経路                                   | `source`                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST 新規投稿・スレッド（`posts`配列） | 常にスレッド先頭（`posts[0]`）の（事前計算済み）`uri`/`cid`。単発投稿（`posts.length === 1`）では`posts[0]`が投稿自身であるため、結果として自身が`source`になる |
| POST from-post（`uri`指定）            | 指定された`uri`自身（ステップ1で所有権検証済み）の`uri`/`cid`。対象投稿がスレッドのどの位置にあるかは問わない                                                       |

新規投稿・スレッド経路では、`reply.root`同様にPDSへの実書き込みを待たずに事前計算済みの`uri`/`cid`を使うため、追加のPDS呼び出しは発生しない。from-post経路でも、`source`を決めるための追加の`getPostThread`呼び出しは発生しない（旧`resolveFromPostSource`・`isPostOnOwnedRootChain`は撤廃）。entryの`source`はスレッド内の他の投稿（root/parent等）への参照を複数持つことはない（`source`はあくまで単一の`strongRef`であり、スレッド全体を復元する手段ではない）。

他人が起点のスレッドを自分のentryの`source`にすり替えることは、いずれの経路でも所有権検証（`isReplyRefOwnedBySelf`・`parseOwnedAtUri`）により防止される。

関連ファイル: [createBskyThread.ts](../../../src/lib/entry/createBskyThread.ts)、[fromPost.ts](../../../src/lib/entry/fromPost.ts)（[§3.4](#34-from-posturi指定時の詳細frompostts)）

### 7.3 entry削除経路（DELETE）

- `deleteBskyPost:true`指定時、entryレコードの`source.uri`から元投稿を特定する（フェーズ5）。
- **既定（`deleteBskyThread`未指定またはfalse）**: `source.uri`の投稿1件のみを`deleteRecord`で削除する。削除対象の投稿がスレッドの中間に位置する場合でも、**後続の投稿（その投稿へreplyしている投稿群）に対しては一切操作を行わない**。AT Protocol自体もreply先の削除を検知して後続投稿の`reply.parent`/`reply.root`を書き換える機能を持たないため、後続投稿のreply参照は削除された投稿を指したまま残る（いわゆる「dangling reference」）。これはSkyshare固有の問題ではなく、AT Protocol / Blueskyの一般的な挙動である。Bluesky公式クライアントも、スレッド中間の投稿が削除された場合は「このポストは削除されました」のようなプレースホルダー表示で対応しており、reply chainの構造自体を修復する仕組みは持たない（変更予定なし。理由は[requirements.md §4](requirements.md#4-明示的な非対応意図的な制約)を参照）。
- **`deleteBskyThread:true`指定時**: `source.uri`を起点に、呼び出し者自身が投稿した後続投稿を辿ってすべて削除する（[§7.3.1](#731-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)）。`source`が単発投稿（後続の自己投稿が存在しない）の場合でも指定自体は禁止しないが、その場合は実質的に1件のみの削除（既定と同じ結果）になる。
- DELETE経路は[§7.1〜§7.2](#71-設計方針)のsource決定規則の対象外であり、削除時に`source`の指す先を再解釈することはない（`source`は常にentryレコードに記録済みの値をそのまま使う）。

#### 7.3.1 スレッド全体削除（`deleteBskyThread:true`）のときの削除対象の導出

- クライアントは削除対象の投稿一覧を送信しない。サーバが`source.uri`を起点に、`app.bsky.feed.getPostThread`（`AtpAgent`経由）でreply chainを取得し、削除対象を導出する（NFR-1: クライアント指定値を信用しない）。
- 削除対象に含めるのは、`source`自身、および`source`から**呼び出し者自身が投稿した後続投稿のみをたどった直線的なreply chain**である。具体的には、`source`（または直前に削除対象と判定した投稿）への返信のうち、投稿者（DID）が呼び出し者自身と一致するものすべてを次の削除対象候補とする。候補が1件ならそのまま採用し、候補が2件以上（同一投稿への複数の自己返信＝実在する分岐）の場合のみ、直前の投稿との`record.createdAt`の差が最小のものを1件選ぶ（`extractOwnedLinearReplyChain`、[src/lib/atproto/threadChain.ts](../../../src/lib/atproto/threadChain.ts)）。第三者の返信で分岐した先（その返信へのさらなる返信。仮に呼び出し者自身の投稿であっても）は削除対象に含めない。本ロジックはTimeline一覧のスレッドグルーピング（[specs/timeline/design.md §2.2](../../timeline/design.md#22-srclibatprotothreadchaints)）と共通の`extractOwnedLinearReplyChain`を用いており、これにより「スレッド全体削除」で実際に削除される投稿は常にTimeline上で表示されていた側の投稿のみになる（分岐している場合、採用されなかった側の派生ツリーは削除されない）。entry詳細ページのスレッド表示（[specs/entry/frontend/design.md §3.3](../frontend/design.md#33-entry詳細ページのスレッド表示fr-4対応)）も同じ関数を用いる。
- 導出した各投稿について、`parseOwnedAtUri`相当の所有者検証（collection種別・repo DIDの一致）を1件ずつ行ってから削除対象に含める。検証に失敗する投稿（＝呼び出し者以外が所有する投稿）が万一混入した場合は、その投稿を削除対象から除外する（サーバ側の導出ロジックが正しければ発生しないはずだが、フェイルセーフとして所有権検証を省略しない）。
- 削除対象が複数件になる場合、1回の`applyWrites`（すべて`deleteRecord`オペレーション）でまとめて削除する（NFR-2: 全件成功か全件失敗）。1件のみ（`source`が単発投稿、または後続の自己投稿が存在しない）場合は既定の1対1削除と同じ`deleteRecord`呼び出しに帰着してよい。
- スレッド探索の深さ・件数には`MAX_THREAD_POST_COUNT`（[src/lib/atproto/post.ts](../../../src/lib/atproto/post.ts)）を上限として用い、`applyWrites`の1リクエストあたりの書き込み件数を予測可能な範囲に収める。

`source`は§7.2の規則によりクライアントが指定した投稿そのものであり、それがスレッドのどの位置か（本来の起点であるか）をサーバは検証しない。そのため、クライアントが起点でない投稿（中間・末尾投稿）を`uri`に指定してentryを作成していた場合、本節の削除対象は「その投稿以降の自己投稿」に限られ、それより手前の投稿は削除対象に含まれない。これはクライアント側の運用（[specs/timeline/requirements.md](../../timeline/requirements.md)が定める、常に起点投稿を指定する責務）を前提とした挙動であり、サーバ側の導出ロジック自体は`source`がどの投稿であっても同一に機能する。

関連ファイル: [src/pages/v2/entry.ts](../../../src/pages/v2/entry.ts)（DELETEフェーズ5・6）。削除対象導出ロジックの配置は[tasks.md](tasks.md)で定める。

### 7.4 一覧表示への影響（`GET /v2/entries/skyshare`）

- entryの`source`投稿が削除済みの場合、[entries/skyshare.ts](../../../src/pages/v2/entries/skyshare.ts)の`fetchAliveSourceUris`（`app.bsky.feed.getPosts`による生存確認）が`orphaned: true`を付与する。
- この`orphaned`判定は「`source`のuriがまだ存在するか」のみを見ており、スレッド構造の欠落（reply chainの途中が消えている等）は判定材料にしていない。中間投稿が削除されてスレッドが分断されていても、削除された投稿自身のentryのみが`orphaned`になり、他の投稿（分断されたスレッドの残り部分）のentryには一切影響しない。
- `source`が常にスレッド先頭を指すようになっても、この判定ロジック自体に変更は不要（スレッド先頭投稿の生存確認になるだけで、判定方式は変わらない）。
