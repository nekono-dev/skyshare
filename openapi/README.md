# OpenAPIの目的

ATProto Clientはバックエンドとして実装される。
OpenAPIは、ATProto Clientを実行するためのWrapper APIである。

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
