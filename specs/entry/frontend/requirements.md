# entry フロントエンド要件定義

skyshare entry（`dev.nekono.skyshare.entry`）を、本アプリケーションのフロントエンド（Astro + React）がどう扱うべきかを、スレッド投稿対応を軸に要件化する。バックエンドAPI（`POST /v2/entry`）の仕様は[specs/entry/backend/requirements.md](../backend/requirements.md)、lexicon自体の仕様は[specs/entry/lexicons/requirements.md](../lexicons/requirements.md)を参照。

## 1. 背景・スコープ

- 本書は、skyshare entryのフロントエンド側の要件のうち、スレッド投稿機能（[specs/threadpost](../../threadpost/requirements.md)）に伴って新たに必要になる、entry固有の要件（`source`・`visual`の扱い）を対象とする。単発投稿におけるentryの扱いは本書の対象外とする。
- [specs/threadpost/requirements.md](../../threadpost/requirements.md)は投稿フォーム自体のスレッド化（セグメントの追加・削除・並び順・送信方式）を扱う。本書はそれと責務を分け、**スレッド投稿のうちentry（`source`・`visual`）に関わる部分だけ**を対象とする。スレッド投稿UI全体のコンポーネント構成・状態管理は本書の対象外。
- 対応するバックエンド側の要件: [specs/entry/backend/requirements.md §2 FR-7](../backend/requirements.md#2-機能要件)（`entrySource: "self" | "threadRoot"`フィールドの追加）、および削除時のスレッド全体削除オプション（[同FR-6](../backend/requirements.md#2-機能要件)）。本書はこのバックエンド設計を前提として、フロントエンドが「通常機能」としてどちらの方針をどう使うか、削除時にどう選択肢を出すかを定める。

## 2. 用語定義

| 用語 | 意味 |
|---|---|
| segment | スレッド投稿における個々の投稿単位（[specs/threadpost/requirements.md](../../threadpost/requirements.md)と同義）。 |
| visual | `dev.nekono.skyshare.defs#manifest`の`visual`。entryの代表画像（サムネイル）。クライアントサイドで画像から合成される（`ImagePicker`の`thumbnailBlob`）。 |
| 画像投稿segment | `images`（1枚以上）を持つsegment。visualの作成元になりうる。 |
| threadRoot方針 | entryの`source`をスレッド先頭投稿に向ける方針（バックエンドの`entrySource: "threadRoot"`に対応）。 |
| self方針 | entryの`source`をその投稿自身に向ける方針（バックエンドの`entrySource: "self"`に対応）。 |

## 3. 機能要件

### FR-1: スレッド投稿時のvisual選択

- ユーザーがスレッド（複数segment）を投稿しようとする際、画像投稿segmentが2件以上ある場合、そのうちどれをentryのvisual元にするかを1つ選択できる。
- visualの作成（画像の合成・クロップ結果からの`thumbnailBlob`生成）自体は、既存の単発投稿と同様にクライアントサイドの処理とする。選択されたsegmentの画像に対して、既存のvisual生成処理（[design.md §2](design.md#2-現状実装済みの整理)参照）を適用する。
- 画像投稿segmentがちょうど1件しかない場合は、選択UIを出さずそのsegmentを自動的にvisual元とする。
- スレッド下書き（[specs/threadpost/design.md §3](../../threadpost/design.md)）は画像を保持しないため、visual選択UIは下書き復元時には表示せず、送信直前（各segmentの画像が実際に揃った時点）にのみ表示する。

### FR-2: entry作成対象外になるケース（画像投稿segmentが0件）

- スレッド中に画像投稿segmentが1つも含まれない場合、そのスレッド全体を、単発投稿でテキストのみ・OGPリンクのみの投稿と同様に、skyshare entryの作成対象外とする。
- この場合、visual選択UI・entry関連の入力（heading/caption等）は一切表示しない。

### FR-3: 通常機能におけるsourceの向け先（threadRoot方針の適用）

- スレッド投稿の「通常機能」では、フロントエンドはFR-1で選択されたvisual元segmentにのみ`createEntry: true`を指定し、あわせて`entrySource: "threadRoot"`を明示送信する。他のsegment（画像投稿segmentであっても）には`createEntry`を指定しない。
- 結果として、通常機能で作成されるskyshare entryはスレッドにつき最大1件であり、その`source`は常にスレッド先頭投稿を指す。
- 投稿segmentごとに個別にentryを作る方針（self方針、バックエンドの`entrySource: "self"`）は、フロントエンドUIとして提供しない（本書のスコープ外）。バックエンドAPIとしては引き続き利用可能な選択肢として残る。

### FR-4: entry詳細ページのスレッド表示

- entry詳細ページ（`entries/[slug].astro`）で表示するentryの`source`が、複数投稿から成るスレッドの先頭投稿であった場合、そのentryの投稿はスレッド形式（先頭から後続投稿まで、時系列順）で表示する。
- `source`投稿が単発投稿（reply chainを持たない、またはentry所有者自身による後続投稿を持たない）である場合は、従来通り単一投稿として表示する（フォールバック）。
- entry所有者以外の第三者による返信は、スレッド表示に含めない（entryはあくまで投稿者自身のスレッドを再構成するものであり、Blueskyの会話全体を再現するものではない）。

### FR-5: entry削除時のスレッド全体削除オプション

- entry削除UIは、既存の「entryのみ削除」「entry＋紐づくBluesky投稿を削除」（1対1削除、[specs/entry/backend/requirements.md FR-6](../backend/requirements.md#2-機能要件)）に加えて、対象entryが**スレッド全体を代表するentry**（`source`がスレッド先頭投稿であり、かつentry所有者自身による後続投稿が実際に存在する場合）である場合に限り、「スレッド全体（`source`を起点にentry所有者自身が投稿した後続投稿すべて）を削除」する選択肢を追加で表示する。
- 対象entryの`source`が単発投稿（後続投稿を持たない）である場合、またはentryが投稿ごとの個別entry（`entrySource: "self"`相当）である場合は、この選択肢を表示せず、従来通り「entryのみ削除」「entry＋元投稿1件を削除」の2択のままとする。
- どちらの削除方式であっても、削除対象は常にentry所有者自身が投稿した投稿のみであり、第三者による返信は削除対象にならない（バックエンド側の制約、[specs/entry/backend/requirements.md FR-6](../backend/requirements.md#2-機能要件)）。
- スレッド全体削除は、Blueskyの元投稿がスレッドの一部であっても常に「その投稿1件のみ」を削除してきた従来の1対1対応を置き換えるものではない。両方の削除方式を、ユーザーが削除時に都度選択できるようにする。

### FR-6: entry一覧表示への影響とスレッド由来の視覚的区別

- `GET /v2/entries/skyshare`のレスポンス型・一覧UI（`EntryList`等）の表示ロジック（`orphaned`判定含む）は、`sourceUri`/`sourceCid`が指す先が「投稿自身」から「スレッド先頭」に変わっても、そのまま成立するものとする。
- entryの`source`が複数投稿から成るスレッドの先頭投稿であり、かつentry所有者自身による後続投稿が実際に存在する場合（FR-4のスレッド表示判定と同じ基準）、一覧・詳細ページの双方で、そのentryがスレッド由来であることを視覚的に区別できるようにする。単発投稿由来のentry（reply chainを持たない、またはentry所有者自身の後続投稿を持たない）には、この区別表示を行わない。

## 4. 非機能要件

### NFR-1: 既存の単発投稿フローへの影響最小化

- 既存の単発投稿（`ImagePicker`・`submitEntry.ts`・`PostForm`）とは、segment数が1件の場合を指す。この場合の挙動・見た目は、スレッド投稿機能の追加によって変化しないこと。`entrySource`省略時のデフォルト（`posts.length === 1`なら`self`）により、バックエンド側の応答も現状と変わらない。
- segmentが2件以上のスレッド投稿時における`PostForm`の見た目・UI構成（Bluesky公式クライアントに寄せた表示、segment間の視覚的なつながり等）は、この非機能要件が定める「変化しないこと」の対象外である。当該UIの要件は[specs/threadpost/requirements.md §6.3 FR-THREAD-FE](../../threadpost/requirements.md#63-fr-thread-fe-フロントエンド-スレッド投稿ui)が定める。

### NFR-2: バックエンド設計との接続可能性

- 本書のFR-1〜FR-3は、[specs/threadpost](../../threadpost/requirements.md)側でスレッド投稿UIのアーキテクチャ（コンポーネント構成・状態管理・送信方式）が確定した時点で、そのUIに組み込める粒度で設計しておくこと（本書はvisual選択と送信内容の決定ロジックに閉じ、UIコンポーネントの内部実装は規定しない）。

### NFR-3: 詳細ページのSSR制約

- entry詳細ページ（`entries/[slug].astro`）はCloudflare Workers上でSSRされるため、スレッド取得のための追加API呼び出し（Bluesky公式APIの`getPostThread`等）も、Node.js固有APIに依存しない実装であること（[AGENTS.md](../../../AGENTS.md)の全社方針、既存の`[slug].astro`実装と同じ制約）。

## 5. 受け入れ条件（Acceptance Criteria）

- [ ] 画像投稿segmentが2件以上あるスレッドの投稿画面で、visual元にする1件を選択できる
- [ ] 画像投稿segmentがちょうど1件のスレッドでは、選択UIなしでそのsegmentが自動的にvisual元になる
- [ ] 画像投稿segmentが0件のスレッドでは、entry関連のUI・入力が一切表示されず、`createEntry`も送信されない
- [ ] 通常機能でのスレッド投稿時、選択されたvisual元segmentにのみ`createEntry: true` + `entrySource: "threadRoot"`が送信され、他のsegmentには`createEntry`が送信されない
- [ ] スレッド由来のentry（`source`がスレッド先頭）の詳細ページで、先頭から後続投稿まで時系列順に表示される
- [ ] 単発投稿由来のentry（reply chainなし）の詳細ページは、従来通り単一投稿として表示される
- [ ] entry詳細ページのスレッド表示に、entry所有者以外の第三者による返信が含まれない
- [ ] 既存の単発投稿フロー（`ImagePicker`でのvisual作成、`submitEntry.ts`の送信内容、entry一覧・詳細ページの表示）に regression が無い
- [ ] `source`がスレッド先頭かつentry所有者自身の後続投稿が存在するentryの削除確認UIに、「entryのみ削除」「entry＋元投稿を削除」に加えて「スレッド全体を削除」の選択肢が表示される
- [ ] `source`が単発投稿（後続投稿なし）のentry、または`entrySource: "self"`相当の個別entryの削除確認UIには「スレッド全体を削除」の選択肢が表示されず、従来通り2択のままである
- [ ] 「スレッド全体を削除」を選んで削除を実行すると、`DELETE /v2/entry`に`deleteBskyPost: true`と`deleteBskyThread: true`があわせて送信される
- [ ] スレッド由来（`source`がスレッド先頭かつentry所有者自身の後続投稿が存在する）entryの一覧・詳細ページに、スレッド由来であることを示す視覚的区別が表示される
- [ ] 単発投稿由来のentryには、スレッド由来を示す視覚的区別が表示されない
