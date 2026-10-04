# API全体におけるlexicon（AT Protocolレコード）の扱い方 要件定義

v2 API全体に横断して適用すべき要件を整理する。

## 1. 機能要件

### FR-1: クライアント指定のat://URIは必ず所有権検証を経てから使用する

- リクエストボディ・クエリでクライアントから受け取ったat://URIを操作対象（読み取り・更新・削除・reply接続先）にする場合、必ず「期待するcollectionか」「repoが呼び出しユーザー自身か」を検証する。
- 検証をパスしないURIに対する操作は一切実行しない（400を返して終了する）。

### FR-2: 複数lexiconレコードにまたがる操作は原子性を持つ

- 1回のクライアントリクエストが複数のlexiconレコード（例: 投稿＋gate＋entry）の作成を意図する場合、それらは「全件成功」か「全件失敗」のいずれかの結果になる。部分成功状態を作らない。
- 原子性は外部PDS（AT Protocol）が提供するトランザクション保証に委ね、アプリケーション層で独自の補償処理（ロールバック等）を持たない（具体的な実現方法はdesign.md参照）。

### FR-3: Bluesky公式lexiconの複雑な型はAPI契約で簡略化してから公開する

- discriminated unionを含む等、フロントエンドでの直接的な組み立てが煩雑な公式lexicon型（threadgate/postgate等）は、Skyshare独自の簡略化されたスキーマに変換してAPI契約とする。
- 簡略スキーマ→公式lexiconレコード値への復元ロジックは、サーバ側の1箇所（該当lexiconごとのbuilder関数）に閉じ込める。

### FR-4: 同一概念（スレッド）を表す複数のAPIは制約値を共有する

- 「スレッド（reply chainで連結される投稿群）の最大セグメント数」のように、複数のAPI（下書き・新規投稿作成）が同じドメイン概念を扱う場合、その制約値は1箇所の定数として定義し、各APIのスキーマがそれを参照する。値の乖離を防ぐ。

## 2. 非機能要件

### NFR-1: エラー変換の一貫性

- atproto呼び出しが投げる例外は、lexiconの種類（公式かSkyshare独自か）によらず、共通のエラーコード→HTTPステータスマッピング（`resolveXrpcStatus`）で変換する。

### NFR-2: 複数レコードの相互参照を伴う書き込みの一貫性

- 複数レコードが互いを参照する必要がある場合（reply chain、entryのsource）、参照関係は1回の原子的な書き込みの中で完結しなければならない。個々のレコードをPDSへ書き込んだ結果を跨いで、後から参照値を補正する手順を挟まない。
- 具体的な実現方法（レコードCIDの事前計算等）はdesign.md参照。

### NFR-3: Skyshare独自lexiconも公式lexiconと同じ汎用CRUDパターンで扱う

- `dev.nekono.skyshare.*`のような独自lexiconのために専用のRPCメソッドを新設せず、`com.atproto.repo.*`（`createRecord`/`getRecord`/`putRecord`/`deleteRecord`/`applyWrites`/`listRecords`）の汎用操作で読み書きする。

## 3. 受け入れ条件（Acceptance Criteria）

- 新しいエンドポイントでat://URIを受け取る場合、所有権検証（期待するcollectionか・repoが呼び出しユーザー自身か）を経由しないコードパスが無い
- 複数レコードを作成するエンドポイントで、事前検証に1件でも失敗した場合、レコードは一切作成されない（部分的な書き込みが発生しない）
- スレッド関連の上限値（`MAX_THREAD_POST_COUNT`）が、`v2/entry`と`v2/bsky/drafts`のスキーマで同一の定数を参照している
- gate（threadgate/postgate）のAPIリクエストボディに、公式lexiconのunion型（`#mentionRule`等の`$type`）がそのまま露出していない
