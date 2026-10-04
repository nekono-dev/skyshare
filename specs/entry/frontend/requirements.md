# entry フロントエンド要件定義

skyshare entry（`dev.nekono.skyshare.entry`）を、本アプリケーションのフロントエンド（Astro + React）がどう扱うべきかを、スレッド投稿対応を軸に要件化する。バックエンドAPI（`POST /v2/entry`）の仕様は[specs/entry/backend/requirements.md](../backend/requirements.md)、lexicon自体の仕様は[specs/entry/lexicons/requirements.md](../lexicons/requirements.md)を参照。

## 1. 背景・スコープ

- 本書は、skyshare entryのフロントエンド側の要件のうち、スレッド投稿機能（[specs/threadpost](../../threadpost/requirements.md)）に伴って新たに必要になる、entry固有の要件（`source`・`visual`の扱い、entry詳細ページのスレッド表示、entry削除時のBluesky投稿削除の確認と制限）を対象とする。単発投稿におけるentryの扱いは本書の対象外とする。
- [specs/threadpost/requirements.md](../../threadpost/requirements.md)は投稿フォーム自体のスレッド化（セグメントの追加・削除・並び順・送信方式）を扱う。本書はそれと責務を分け、**スレッド投稿のうちentry（`source`・`visual`）に関わる部分だけ**を対象とする。スレッド投稿UI全体のコンポーネント構成・状態管理は本書の対象外。
- Timeline（投稿一覧、`/`）でのスレッド展開表示・事後entry作成ボタン・スレッド由来entryの一覧上の視覚的区別は[specs/timeline/requirements.md](../../timeline/requirements.md)の対象であり、本書の対象外とする（本書が扱うのはentry詳細ページ`entries/[slug].astro`と、投稿フォーム送信時のvisual/source決定ロジックのみ）。
- 対応するバックエンド側の要件: [specs/entry/backend/requirements.md FR-1・FR-2](../backend/requirements.md#2-機能要件)（entry作成はリクエスト全体につき1回のみ、`source`は常にサーバが自動解決し個別選択はできない）、および削除時のBluesky投稿削除（[同FR-6](../backend/requirements.md#2-機能要件)）。本書はこのバックエンド設計を前提として、フロントエンドが送信内容をどう決定するか、削除時にどう選択肢を出すかを定める。

## 2. 用語定義

| 用語            | 意味                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| segment         | スレッド投稿における個々の投稿単位（[specs/threadpost/requirements.md](../../threadpost/requirements.md)と同義）。                                       |
| visual          | `dev.nekono.skyshare.defs#manifest`の`visual`。entryの代表画像（サムネイル）。クライアントサイドで画像から合成される（`ImagePicker`の`thumbnailBlob`）。 |
| 画像投稿segment | `images`（1枚以上）を持つsegment。visualの作成元になりうる。                                                                                             |

## 3. 機能要件

### FR-1: スレッド投稿時のvisual選択

- ユーザーがスレッド（複数segment）を投稿しようとする際、画像投稿segmentが2件以上ある場合、そのうち**先頭（最小index）のsegmentが自動的にentryのvisual元として選ばれる**。ユーザーが手動で選択するUIは設けない（実装時に、必要な複雑さとのバランスを踏まえて簡略化して確定した方針）。
- visualの作成（画像の合成・クロップ結果からの`thumbnailBlob`生成）自体は、既存の単発投稿と同様にクライアントサイドの処理とする。自動選択されたsegmentの画像に対して、既存のvisual生成処理（[design.md §2](design.md#2-前提とする既存コンポーネントの責務)参照）を適用する。
- 画像投稿segmentがちょうど1件しかない場合も、同じ自動選択ロジックによりそのsegmentがvisual元になる（2件以上の場合と処理を分けない）。
- スレッド下書き（[specs/threadpost/design.md §3](../../threadpost/design.md)）は画像を保持しないため、visual元の判定・選択は下書き復元時には行わず、送信直前（各segmentの画像が実際に揃った時点）にのみ評価する。

### FR-2: entry作成対象外になるケース（画像投稿segmentが0件）

- スレッド中に画像投稿segmentが1つも含まれない場合、そのスレッド全体を、単発投稿でテキストのみ・OGPリンクのみの投稿と同様に、skyshare entryの作成対象外とする。
- この場合、visual選択UI・entry関連の入力（heading/caption等）は一切表示しない。

### FR-3: entry作成リクエストの送信内容

- フロントエンドは、FR-1で選択されたvisual元segmentの画像を、リクエストのトップレベル`createEntry: true` + `visual`として送信する（[specs/entry/backend/requirements.md FR-1](../backend/requirements.md#2-機能要件)）。`posts[i]`側には送信しない（バックエンドがトップレベルフィールドとして受け取る設計に統一されたため）。
- `source`の解決はバックエンドが自動的に行う（[同FR-2](../backend/requirements.md#2-機能要件)）。フロントエンドが`source`の解決方針を選択・送信する手段は存在しない。
- 投稿segmentごとに個別にentryを作る方針は、バックエンドAPIとしても提供されない（[specs/entry/backend/requirements.md FR-1](../backend/requirements.md#2-機能要件)）。

### FR-4: entry詳細ページのスレッド表示

- entry詳細ページ（`entries/[slug].astro`）は、表示するentryの`source`投稿を起点に、後続のBluesky投稿（reply chain）を追加で読み込む。`source`が複数投稿から成るスレッドの先頭投稿であった場合、そのentryはスレッド全体（先頭から後続投稿まで、時系列順）として表示する。
- スレッドとして扱うのは、`source`から**entry所有者自身が投稿した後続投稿のみを辿った直線的なreply chain**に限る。第三者による返信、および第三者の返信で分岐した先（それが仮にentry所有者自身の投稿であっても）は、スレッド表示に含めない（entryはあくまで投稿者自身のスレッドを再構成するものであり、Blueskyの会話全体を再現するものではない）。この抽出規則は、[specs/entry/backend/design.md §7.3.1](../backend/design.md#731-bluesky投稿削除deletebskyposttrueの削除対象の導出)がBluesky投稿削除の対象導出に用いる規則と一致させる。
- `source`投稿が単発投稿（reply chainを持たない、またはentry所有者自身による後続投稿を持たない）である場合は、従来通り単一投稿として表示する（フォールバック）。
- 後続投稿の探索件数には、投稿作成時と同じ上限（[specs/entry/backend/requirements.md NFR-7](../backend/requirements.md#3-非機能要件)の`MAX_THREAD_POST_COUNT`）を用いる。

### FR-5: entry削除時のBluesky投稿削除の確認と制限

- entry削除UIは、「Skyshareリンクを削除」（entryのみ削除。Bluesky投稿は残す）と「リンク・Bluesky投稿を削除」の2つの削除方式を提示する（[specs/entry/backend/requirements.md FR-6](../backend/requirements.md#2-機能要件)）。「Skyshareリンクを削除」の仕様は従来から変更しない。
- 「リンク・Bluesky投稿を削除」は、entryの`source`を起点にentry所有者自身が投稿した投稿すべてを削除する。`source`が単発投稿であれば1件、スレッドであればスレッド全体が削除される。削除範囲を利用者が選び分ける選択肢は設けない。第三者による返信は削除対象にならない。
- 「リンク・Bluesky投稿を削除」は、単発投稿でもスレッドでも、取り消し不能であり、Skyshareの外（Bluesky上）の投稿が失われる操作である。誤操作による実行を防ぐため、選択した直後には実行せず、実行前に元に戻せない旨を明示する最終確認を常に要求する。最終確認では、削除されるのが単発の投稿か複数件のスレッドか（複数件の場合はその件数）、および第三者の返信は削除されず残ることを示す。あわせて、削除予定のBluesky投稿の一覧を表示する（FR-5-1）。
- 旧実装で作成されたentry（`source`がスレッドの起点でなく、他の投稿への返信であるentry）では、「リンク・Bluesky投稿を削除」を実行できない。このとき、ボタンの文言は変えずに配色をグレーにして選択不可とし、削除確認UI内に実行できない理由と取り得る手段（「Skyshareリンクを削除」、またはBluesky上での直接削除）を表示する。
- `source`投稿の状態を確認できず削除範囲を確定できない場合も、「リンク・Bluesky投稿を削除」を同じ方法で選択不可とし、確認できなかった旨を理由として表示する。
- 紐づくBluesky投稿が既に存在しないentry（orphaned）の削除確認は、従来通りBluesky投稿の削除を提示しないentryのみの削除確認とする。
- 削除をサーバが拒否した場合、削除は行われず、その旨のエラーを表示する。

### FR-5-1: 削除予定のBluesky投稿一覧の表示

- 「リンク・Bluesky投稿を削除」の最終確認では、実際に削除されるBluesky投稿を利用者が事前に確認できるよう、削除予定の投稿の一覧を表示する。
- 一覧は単発投稿（1件）でもスレッド（複数件）でも表示し、表示形式を分けない。
- 一覧には削除されるすべての投稿を、投稿順（古い→新しい）に過不足なく含める。第三者の返信など削除対象にならない投稿は含めない。一覧の内容は、実際に削除される対象と一致していなければならない（[specs/entry/backend/requirements.md FR-6](../backend/requirements.md#2-機能要件)）。
- 各投稿には、本文・投稿日時・添付画像のサムネイルを表示する。本文が長い場合は省略表示とし、画像が無い投稿はサムネイル欄を設けない。本文が空の投稿は本文が無い旨を示す。
- 一覧の件数が多く画面に収まらない場合でも、確定・キャンセルの操作が常に画面内で行える。
- 一覧は最終確認の中で提示し、最初の選択肢（「Skyshareリンクを削除」「リンク・Bluesky投稿を削除」「キャンセル」）には表示しない。
- 一覧の取得は、最終確認を開くまでに追加の通信を要しない（削除範囲の確認時点で取得済みである）。
- 最終確認はこの一覧を備えた専用の確認UIとし、汎用の確認ダイアログ（本文メッセージのみを持つもの）では代用しない。

### FR-6: entry詳細ページでのスレッド由来の視覚的区別

- entryの`source`が複数投稿から成るスレッドの先頭投稿であり、かつentry所有者自身による後続投稿が実際に存在する場合（FR-4のスレッド表示判定と同じ基準）、entry詳細ページで、そのentryがスレッド由来であることを視覚的に区別できるようにする。単発投稿由来のentry（reply chainを持たない、またはentry所有者自身の後続投稿を持たない）には、この区別表示を行わない。
- Timeline（投稿一覧、`/`）における同様の視覚的区別、および`GET /v2/entries/skyshare`のレスポンス型・一覧UIの表示ロジックは、[specs/timeline/requirements.md](../../timeline/requirements.md)が扱う（本書の対象外）。

## 4. 非機能要件

### NFR-1: 既存の単発投稿フローへの影響最小化

- 既存の単発投稿（`ImagePicker`・`submitThread.ts`・`ThreadComposer`）とは、segment数が1件の場合を指す。この場合の挙動・見た目は、スレッド投稿機能の追加によって変化しないこと。単発投稿では`source`が自身の投稿になる（[specs/entry/backend/requirements.md FR-2](../backend/requirements.md#2-機能要件)）ため、バックエンド側の応答も現状と変わらない。
- segmentが2件以上のスレッド投稿時における`PostForm`の見た目・UI構成（Bluesky公式クライアントに寄せた表示、segment間の視覚的なつながり等）は、この非機能要件が定める「変化しないこと」の対象外である。当該UIの要件は[specs/threadpost/requirements.md §6.3 FR-THREAD-FE](../../threadpost/requirements.md#63-fr-thread-fe-フロントエンド-スレッド投稿ui)が定める。

### NFR-2: バックエンド設計との接続可能性

- 本書のFR-1〜FR-3は、[specs/threadpost](../../threadpost/requirements.md)側でスレッド投稿UIのアーキテクチャ（コンポーネント構成・状態管理・送信方式）が確定した時点で、そのUIに組み込める粒度で設計しておくこと（本書はvisual選択と送信内容の決定ロジックに閉じ、UIコンポーネントの内部実装は規定しない）。

### NFR-3: 詳細ページのSSR制約

- entry詳細ページ（`entries/[slug].astro`）はCloudflare Workers上でSSRされるため、スレッド取得のための追加API呼び出し（Bluesky公式APIの`getPostThread`等）も、Node.js固有APIに依存しない実装であること（[AGENTS.md](../../../AGENTS.md)の全社方針、既存の`[slug].astro`実装と同じ制約）。

## 5. 受け入れ条件（Acceptance Criteria）

- [ ] 画像投稿segmentが2件以上あるスレッドの投稿画面で、先頭のsegmentが自動的にvisual元として選ばれる（手動選択UIは設けない）
- [ ] 画像投稿segmentがちょうど1件のスレッドでは、そのsegmentが自動的にvisual元になる
- [ ] 画像投稿segmentが0件のスレッドでは、`createEntry`が送信されない
- [ ] 通常機能でのスレッド投稿時、自動選択されたvisual元segmentの画像がトップレベルの`createEntry: true` + `visual`として送信され、`posts[i]`側には`createEntry`/`entrySource`が一切送信されない
- [ ] スレッド由来のentry（`source`がスレッド先頭）の詳細ページで、先頭から後続投稿まで時系列順に表示される（FR-4）
- [ ] 単発投稿由来のentry（reply chainなし）の詳細ページは、従来通り単一投稿として表示される（FR-4）
- [ ] entry詳細ページのスレッド表示に、entry所有者以外の第三者による返信、および第三者の返信で分岐した先が含まれない（FR-4）
- [ ] 既存の単発投稿フロー（`ImagePicker`でのvisual作成、`submitThread.ts`の送信内容、entry詳細ページの表示）に regression が無い
- [ ] 削除確認UIに「Skyshareリンクを削除」「リンク・Bluesky投稿を削除」「キャンセル」が表示され、「スレッド全体を削除」に相当する独立した選択肢は表示されない
- [ ] 単発投稿由来のentryで「リンク・Bluesky投稿を削除」を選ぶと、直後には削除が実行されず、元に戻せない旨と単発の投稿が削除される旨を示す最終確認が表示される
- [ ] スレッド由来のentryで「リンク・Bluesky投稿を削除」を選ぶと、直後には削除が実行されず、元に戻せない旨・削除される投稿の件数・第三者の返信が残る旨を示す最終確認が表示される
- [ ] 最終確認に、削除予定のBluesky投稿の一覧が表示される。単発投稿由来entryでは1件、スレッド由来entryでは削除件数と同数の投稿が古い順に並ぶ
- [ ] 一覧の各投稿に、本文・投稿日時が表示され、画像を持つ投稿にはサムネイルが表示される。画像の無い投稿にはサムネイルが表示されない
- [ ] 長い本文は省略表示され、投稿が多数でも一覧がスクロールでき、確定・キャンセルのボタンが画面内に残る
- [ ] 一覧は最初の選択肢表示には表示されない。最終確認でキャンセルして選択肢表示へ戻り、再度最終確認を開くと一覧が再表示される
- [ ] 最終確認で確定操作を行った場合にのみ、`DELETE /v2/entry`に`deleteBskyPost: true`が送信され削除が実行される（`deleteBskyThread`は送信されない）
- [ ] 最終確認でキャンセルした場合、削除は実行されず、削除確認UIの選択肢表示に戻る
- [ ] 「Skyshareリンクを削除」を選ぶと、従来通りBluesky投稿を残したままentryのみが削除される（最終確認は挟まない）
- [ ] `source`が返信投稿である旧実装のentryでは、「リンク・Bluesky投稿を削除」が文言そのままグレー表示で選択できず、実行できない理由が削除確認UI内に表示される。「Skyshareリンクを削除」は選択できる
- [ ] 削除範囲の確認に失敗した場合も、「リンク・Bluesky投稿を削除」がグレー表示で選択できず、確認できなかった旨の理由が表示される。「Skyshareリンクを削除」は選択できる
- [ ] orphaned entryの削除確認は従来通り（entryのみ削除の単純確認）である
- [ ] スレッド由来（`source`がスレッド先頭かつentry所有者自身の後続投稿が存在する）entryの詳細ページに、スレッド由来であることを示す視覚的区別が表示される
- [ ] 単発投稿由来のentryには、スレッド由来を示す視覚的区別が表示されない
