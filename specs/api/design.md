# API全体におけるlexicon（AT Protocolレコード）の扱い方 設計書

`/v2/**`配下のAPI（[src/pages/v2/](../../src/pages/v2/)）が、Bluesky公式lexicon（`app.bsky.*`, `com.atproto.*`）およびSkyshare独自lexicon（`dev.nekono.skyshare.*`）をどう扱っているかを、横断的な設計パターンとして整理する。

個別エンドポイントの詳細仕様は各`specs/entry/**/design.md`（例: [specs/entry/backend/design.md](../entry/backend/design.md)）を参照。`dev.nekono.skyshare.*`自体のスキーマ定義は[specs/entry/lexicons/design.md](../entry/lexicons/design.md)を参照。

## 1. 扱っているlexicon一覧

| lexicon (NSID) | 種別 | 用途 | 主な参照箇所 |
|---|---|---|---|
| `app.bsky.feed.post` | Bluesky公式 | Bluesky投稿本体 | [src/lib/atproto/post.ts](../../src/lib/atproto/post.ts) |
| `app.bsky.feed.threadgate` | Bluesky公式 | 返信可能ユーザー設定 | [src/lib/atproto/gate.ts](../../src/lib/atproto/gate.ts) |
| `app.bsky.feed.postgate` | Bluesky公式 | 引用/embed許可設定 | [src/lib/atproto/gate.ts](../../src/lib/atproto/gate.ts) |
| `app.bsky.embed.images` / `app.bsky.embed.external` | Bluesky公式 | 投稿への画像・外部リンク埋め込み | [src/lib/atproto/embed.ts](../../src/lib/atproto/embed.ts) |
| `app.bsky.richtext.facet` | Bluesky公式 | リッチテキスト注釈（リンク・メンション・タグ） | [src/lib/atproto/facet.ts](../../src/lib/atproto/facet.ts)、[common.ts](../../src/lib/api/schema/common.ts) |
| `app.bsky.draft.*` | Bluesky公式 | 投稿の下書き | [src/lib/atproto/draft.ts](../../src/lib/atproto/draft.ts)、[src/pages/v2/bsky/drafts.ts](../../src/pages/v2/bsky/drafts.ts) |
| `com.atproto.repo.strongRef` | Bluesky公式（共通） | uri+cidによるレコード参照 | reply chain、entry.source等、複数箇所で使用 |
| `com.atproto.label.defs#selfLabels` | Bluesky公式（共通） | 自己申告ラベル（センシティブ表示等） | [src/lib/atproto/post.ts](../../src/lib/atproto/post.ts)、[src/lib/atproto/draft.ts](../../src/lib/atproto/draft.ts) |
| `dev.nekono.skyshare.entry` / `dev.nekono.skyshare.defs` | Skyshare独自 | skyshare entry（画像ギャラリー用メタデータ） | [src/lib/entry/skyshareRecord.ts](../../src/lib/entry/skyshareRecord.ts) |

Bluesky公式lexiconはAPIを経由して読み書きする（`AtpAgent`のメソッド、または`com.atproto.repo.*`の汎用CRUD）。Skyshare独自lexicon（`dev.nekono.skyshare.*`）も、専用のRPCメソッドは持たず、同じ`com.atproto.repo.*`の汎用CRUD（`createRecord`/`getRecord`/`putRecord`/`deleteRecord`/`applyWrites`）でBluesky公式lexiconと同一の扱いを受ける。

## 2. 所有権検証パターン

クライアントから送られるat://URI（`uri`、`reply.root.uri`、`reply.parent.uri`）は、いずれもサーバ側で「期待するcollectionか」「repo（DID）が呼び出しユーザー自身か」を検証してから使う。

- 実装: [src/lib/entry/url.ts](../../src/lib/entry/url.ts)の`parseOwnedAtUri(uri, expectedCollection, expectedRepo)`
- 適用箇所:
  - `PUT /v2/entry`・`DELETE /v2/entry`の`uri`（`dev.nekono.skyshare.entry`であること）
  - `POST /v2/entry`のfrom-post `uri`（`app.bsky.feed.post`であること）
  - `POST /v2/entry`の`reply.root.uri`/`reply.parent.uri`（`app.bsky.feed.post`であること、[isReplyRefOwnedBySelf](../../src/lib/atproto/post.ts)）
  - `DELETE /v2/entry`の`deleteBskyPost`指定時、entryレコードに記録された`source.uri`（クライアント指定値ではなくサーバが読み出した値を検証してから削除対象とする）

この検証パターンは、lexiconの種類（公式かSkyshare独自か）によらず一貫して適用する。新しいlexiconをAPIに追加する際も、クライアント指定のat://URIを操作対象にする箇所には必ずこのパターンを適用する。

## 3. `strongRef`パターン

`com.atproto.repo.strongRef`（`{uri, cid}`）は、reply chain（`reply.root`/`reply.parent`）とskyshare entryの`source`の両方で、レコードへの参照を表す共通の型として使われる。cidを含めることで、参照先レコードの内容（コンテンツハッシュ）まで固定した参照になる。

## 4. 原子的な複数レコード書き込みパターン（`com.atproto.repo.applyWrites`）

複数種のlexiconレコード（`app.bsky.feed.post` + `app.bsky.feed.threadgate`/`postgate` + `dev.nekono.skyshare.entry`）にまたがる作成を、1回の`com.atproto.repo.applyWrites`で原子的に（全件成功か全件失敗か）行う（[src/lib/entry/createBskyThread.ts](../../src/lib/entry/createBskyThread.ts)）。

手順:

1. 各レコードの`rkey`を`TID`（`@atproto/common-web`）で事前採番し、`at://{did}/{collection}/{rkey}`というURIを`applyWrites`呼び出し前に確定させる。
2. レコード値を組み立てながら、`cidForLex`（`@atproto/lex-cbor`）でCIDを事前計算する。レコードCIDは「レコード値のDAG-CBORエンコード＋SHA-256」という純粋関数であり、PDSの実行結果を待たずにサーバ側で計算できる。これにより、次のレコード（後続投稿の`reply`、同一投稿に紐づくentryの`source`）が、まだPDSに書き込まれていない前のレコードのuri/cidを参照できる。
3. 組み立てた全レコードを1回の`applyWrites`で送信する。PDS側が1トランザクションとして全件成功/全件失敗を保証する。
4. レスポンスは事前計算した値ではなく、`applyWrites`の応答（`results`）を信頼して組み立てる。

このパターンは、異なるlexicon種別のレコードが「同時に存在するか、どれも存在しないか」を保証したい場合の標準的な手法として、新しい複合操作を追加する際にも踏襲する。

## 5. Bluesky公式lexiconの簡略化されたAPI契約

Bluesky公式lexiconの一部は、フロントエンド・APIリクエストボディでそのまま扱うには複雑すぎる（discriminated unionのネスト等）ため、Skyshare独自の簡略スキーマに変換してから公式lexiconのレコード形へ復元する。

| 公式lexicon | 簡略化されたAPI契約 | 変換元→変換先 |
|---|---|---|
| `app.bsky.feed.threadgate#allow` / `app.bsky.feed.postgate#embeddingRules` | `CommonGateSettingsSchema`（`replyAudience: enum` + boolean群 + `listUris`） | [gate.ts](../../src/lib/atproto/gate.ts)の`buildThreadgateRecord`/`buildPostgateRecord`がunion配列へ復元 |
| `app.bsky.richtext.facet` | `CommonFacetsSchema`（`index`+`features`のdiscriminated union、ほぼ1:1） | サーバは検出のみ行わず、クライアント組み立て済みのものを`validateFacets`で境界検証してから受け取る |
| `com.atproto.label.defs#selfLabels` | `selfLabels: enum(...).optional()`（単一値） | [post.ts](../../src/lib/atproto/post.ts)の`buildBskyPostRecord`が`{values:[{val}]}`形へ復元 |

この方針の意図: クライアント側に公式lexiconのunion型をそのまま実装させると、Bluesky側の仕様変更（union要素の追加等）に密結合してしまう。Skyshare独自の簡略スキーマを挟むことで、フロントエンドの実装コストを下げつつ、lexiconとの対応関係をサーバ側1箇所（`gate.ts`等のbuilder関数）に閉じ込める。

## 6. 下書き（`app.bsky.draft.*`）のスレッドモデルとの対応

下書きの`posts`配列は、`POST /v2/entry`の`posts`配列と同じ「1件ならテキストのみ、複数件ならスレッド（reply chain予定）」という概念を共有する（[specs/threadpost/design.md](../threadpost/design.md)参照）。上限件数は`MAX_THREAD_POST_COUNT`（[src/lib/atproto/post.ts](../../src/lib/atproto/post.ts)）としてこの2箇所で共有し、値の乖離を防ぐ。

下書き自体は`app.bsky.feed.post`のような投稿レコードをまだ持たない（reply chain構築前の状態）ため、`applyWrites`によるCID事前計算パターン（4節）は適用されない。下書きの検証は[src/lib/atproto/draft.ts](../../src/lib/atproto/draft.ts)がAPIリクエストボディの形状チェックのみを行う。

## 7. エラー変換パターン

atproto呼び出し（`AtpAgent`経由）が投げる例外は、`resolveXrpcStatus`（[src/lib/api/response.ts](../../src/lib/api/response.ts)）でHTTPステータスへ変換する。lexiconのcollection種別によらず、atprotoエラーコード（`RecordNotFound`, `AuthenticationRequired`等）を共通のマッピングテーブルで解決する（詳細は[specs/entry/backend/design.md](../entry/backend/design.md) §2.2）。
