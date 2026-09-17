# entry フロントエンド設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

本書は、[requirements.md](requirements.md)が定める要件のうち、スレッド投稿に伴うentryの`source`/`visual`の扱いを満たすための具体的な設計方針を示す。投稿フォーム自体のスレッド化（セグメントのUI構成・状態管理）は[specs/threadpost/design.md](../../threadpost/design.md)の責務であり、本書の対象外とする。バックエンドAPI設計は[specs/entry/backend/design.md](../backend/design.md)（特に§3.1・§7の`createEntry`/`visual`・`source`解決関連の記述）を参照。

## 1. 概要

- スレッド投稿機能により、1回の`POST /v2/entry`で複数の投稿（segment）を原子的に作成できる（[specs/threadpost/design.md §2](../../threadpost/design.md)）。entry作成はリクエスト全体につき1回（トップレベルの`createEntry`+`visual`）のみ指定できる。この経路（新規投稿・スレッド作成）では`source`は常に`posts[0]`（スレッド先頭）であり、クライアントが選ぶ余地はない（[specs/entry/backend/requirements.md FR-1・FR-2](../backend/requirements.md#2-機能要件)）。Timeline上での事後entry作成（from-post）経路は、対象投稿の`uri`をクライアントが明示的に指定する方式であり、本書ではなく[specs/timeline/design.md §5](../../timeline/design.md#5-事後entry作成ボタンの表示条件とsourceの明示送信fr-3対応)が定める。
- 本書は、フロントエンドがどのsegmentの画像をvisualとして選び、トップレベルの`createEntry`/`visual`としてどう送信するか（送信内容の決定）と、スレッド由来entryをentry詳細ページでどう表示するかを設計する。

## 2. 前提とする既存コンポーネントの責務

単発投稿時のentry生成・表示は本書のスコープ外（[requirements.md §1](requirements.md#1-背景スコープ)）だが、以下のコンポーネントの責務を前提として本書の設計は成り立つ。

### 2.1 単発投稿時のvisual作成

- `ImagePicker`（[src/components/image/ImagePicker/index.tsx](../../../src/components/image/ImagePicker/index.tsx)）が、1投稿分の画像（最大4枚）から`ImageEntry`を生成する。`ImageEntry.thumbnailBlob`（visual）は`createProcessedImages`/`composeThumbnailBlob`（[src/lib/image/postImageProcessing.ts](../../../src/lib/image/postImageProcessing.ts)）が、各画像のクロップ状態から1枚に合成して作る。
- `submitThread.ts`（[src/components/post/ThreadComposer/submitThread.ts](../../../src/components/post/ThreadComposer/submitThread.ts)、[specs/threadpost/design.md §4.1](../../threadpost/design.md#41-コンポーネント構成)によりリネーム・一般化された旧`PostForm/submitEntry.ts`）が、`segments`配列を`posts`配列（1件なら単発投稿、複数件ならスレッド）へマッピングして`POST /v2/entry`（`createEntry`関数、OpenAPI生成クライアント）を呼び出す。画像投稿かつ`manualImageAttach`が無効なsegment（entry候補）のうち、先頭（最小index）のsegmentが見つかった場合、そのsegmentの`imageEntry.thumbnailBlob`をリクエストのトップレベル`visual`に、`createEntry: true`もトップレベルに設定する（3.1節の自動選択ロジック）。
- 既存投稿への事後付与（from-post相当）は`useSkyshareEntryStatus.ts`（[src/components/post/PostCard/useSkyshareEntryStatus.ts](../../../src/components/post/PostCard/useSkyshareEntryStatus.ts)）が担い、`ThreadComposer`由来のthumbnailを持たない投稿に対しては`createDefaultThumbnail`（`postImageProcessing.ts`の別関数）でvisualを生成する。

### 2.2 entry一覧・型

- `GET /v2/entries/skyshare`のレスポンス型`TimelineSkyshareEntry`（[src/lib/entry/posts.ts](../../../src/lib/entry/posts.ts)）は`sourceUri`/`sourceCid`を単一値として持つ。スレッド構造を表すフィールドは無い。
- SSR用の`EntryLike`型（[src/lib/entry/entry.ts](../../../src/lib/entry/entry.ts)）も同様に`source.uri`のみを持つ。

### 2.3 entry詳細ページ

- `entries/[slug].astro`（SSR、`prerender = false`）が、slugからentryレコードを`getRecord`で取得し、`source.uri`（単一のBluesky投稿）を`agent.getPosts`で1件取得して、`EntryDetailView`（[src/components/entry/EntryDetailView/index.astro](../../../src/components/entry/EntryDetailView/index.astro)）に渡す。
- `EntryDetailView`は、1つの`sourceWebUrl`・1つの`sourceText`（未使用）・`sourceImages`配列（1投稿分の画像）・`PostEngagementStats`を描画する。スレッド表示の仕組みは持たない。

## 3. スレッド投稿時の設計方針

### 3.1 visual選択（FR-1対応）

- スレッド投稿UI（[specs/threadpost](../../threadpost/design.md)側で設計されるsegment配列の状態管理）が、画像投稿segmentを2件以上持つ場合、そのうち**先頭（配列中の最小index）のsegmentを自動的に「visual元」として選ぶ**。ユーザーに選択させるUIは設けない（実装時に、必要な複雑さとのバランスを踏まえて簡略化して確定した方針。`submitThread.ts`の`entryCandidateIndex = segments.findIndex(s => s.imageEntry && !manualImageAttach)`が該当ロジック）。
- 自動選択されたsegmentの`ImageEntry`（既存の`ImagePicker`がsegmentごとに持つ）に対して、既存の`thumbnailBlob`生成ロジック（2.1節）をそのまま適用する。visual生成そのものの実装（`createProcessedImages`）は変更不要。
- 画像投稿segmentがちょうど1件の場合も、同じ`entryCandidateIndex`ロジックでそのsegmentがvisual元になる（2件以上の場合と処理を分けない）。
- スレッド下書き（[specs/threadpost/design.md §3](../../threadpost/design.md)の`posts`配列）は画像を保持しないため、visual元の判定は下書き復元時には行わない。各segmentの画像が実際に揃う送信直前（`submitThread`呼び出し時）にのみ評価する。

### 3.2 送信内容の決定（FR-2, FR-3対応）

- 画像投稿segmentが0件のスレッドでは、リクエストのトップレベルに`createEntry`・`visual`のいずれも設定しない。
- 画像投稿segmentが1件以上あり、`entryCandidateIndex`（3.1節）が決まっている場合、リクエストのトップレベルに`createEntry: true` + `visual: <選択segmentのthumbnailBlob>`を設定する（[specs/entry/backend/design.md §3.1](../backend/design.md#31-リクエスト形式)）。`posts[i]`側には`createEntry`・`entrySource`いずれも送信しない（バックエンドの`EntryPostItemSchema`から両フィールドが削除されたため）。
- `source`は常に`posts[0]`になる（[specs/entry/backend/requirements.md FR-2](../backend/requirements.md#2-機能要件)）。単発投稿（`segments.length === 1`）でもトップレベル送信の形は変わらず、`posts[0]`が投稿自身であるため結果的に自身が`source`になる。これにより既存の単発投稿のリクエスト形状（トップレベルフィールドの有無を除く実質的な内容）は変化しない（NFR-1）。
- 投稿segmentごとに個別entryを作る機能は、バックエンドAPIとしても提供されない（[specs/entry/backend/requirements.md FR-1](../backend/requirements.md#2-機能要件)）。

### 3.3 entry詳細ページのスレッド表示（FR-4対応）

- `entries/[slug].astro`が取得したentryの`source`投稿について、Bluesky公式の`app.bsky.feed.getPostThread`（`AtpAgent`経由、Node.js非依存。パラメータ`depth`は`MAX_THREAD_POST_COUNT`件を上回るスレッドでも取り漏らさない値を指定する）でreply chainを取得する。
- 取得した`ThreadViewPost`を先頭（`source`）から辿り、各ノードの`replies`のうち`post.author.did === source.author.did`（entry所有者自身）に一致する投稿を次のノードの候補とする。候補が1件ならそのまま採用し、候補が2件以上（同一投稿への複数の自己返信＝実在する分岐）の場合のみ、直前の投稿との`record.createdAt`の差が最小のものを1件選ぶ（`extractOwnedLinearReplyChain`、`specs/entry/backend/design.md §7.3.1`のスレッド全体削除・`specs/timeline/design.md §2.2`のTimelineグルーピングと共通の抽出規則。第三者の返信、および第三者の返信で分岐した先は破棄する）。探索は`MAX_THREAD_POST_COUNT`件に達するか、次のノードが見つからなくなるまで続ける。
- 抽出結果が1件（`source`投稿自身のみ、後続投稿なし）の場合は、現行の単一投稿表示（`EntryDetailView`の既存パス）にフォールバックする。
- 抽出結果が2件以上の場合、新設のスレッド表示コンポーネント（例: `EntryThreadView`、`EntryDetailView`と同じ`src/components/entry/`配下に配置）で、各投稿のテキスト・画像を投稿順に描画する。既存の`sourceImages`抽出ロジック（`extractSourceImages`、[src/lib/entry/entry.ts](../../../src/lib/entry/entry.ts)）を各投稿に対して個別に適用し、どの投稿の画像かが分かる形で並べる。
- `PostEngagementStats`（いいね・リポスト等のカウント）は、既存実装同様`source`投稿1件分を表示する（スレッド全体の集計は行わない）。スレッド内の他投稿のカウント表示要否・レイアウトは実装時に決定する（tasks.md対象）。
- `source`は、新規投稿・スレッド作成経路では常に`posts[0]`（プロトコルルート自身）になり、Timeline上の事後entry作成（from-post）経路では、クライアントが明示的に指定したメインスレッドのルート投稿になる（[specs/entry/backend/requirements.md FR-2](../backend/requirements.md#fr-2-entryのsourceの決定)、[specs/timeline/design.md §5](../../timeline/design.md#5-事後entry作成ボタンの表示条件とsourceの明示送信fr-3対応)）。いずれの経路でも`source`はサーバによって再解釈されず、クライアントが指定した投稿そのものである。本節の処理（`source`を起点とした`extractOwnedLinearReplyChain`）は、`source`がどの投稿であっても同一のロジックで正しく機能する（`source`自身が返信でなければ1件のみの結果になり、3.3節の単一投稿表示にフォールバックする）ため、この点による実装上の変更は無い。

### 3.4 entry削除時のスレッド全体削除オプション（FR-5対応）

- 削除確認UI（`EntryDeleteConfirmDialog`）は、entry所有者向けの共通コンポーネントとして実装し、複数の削除導線から同じコンポーネントを呼び出せる（`showThreadOption`/`onDeleteThread` propsで出し分け）。**実装時の決定**: `entries/[slug].astro`（公開ページ、所有者判定を持たない）に新規の所有者判定UIを追加するコストと、既存の所有者限定管理ページ`/entries`（`EntryCard`、Cookie認証済みAPIにより所有者制御が自然に効く）で同機能を提供できることを比較し、今回は`/entries`（`EntryCard`）のみに実装した。`entries/[slug].astro`・Timeline（PostCard）への追加は将来対応として見送る（Timeline側の呼び出し配置は[specs/timeline/design.md](../../timeline/design.md)が定める）。削除対象entryの`source`が実際にスレッド先頭であり、かつentry所有者自身の後続投稿が存在するかどうかは、削除ダイアログを開くタイミングで`getPostThread`（3.3節と同じ抽出ロジック、`extractOwnedLinearReplyChain`）を呼んで判定する。`EntryCard`が持つ`item.sourceUri`のrepo（DID）自体がentry所有者のDIDと一致するため、追加のセッション取得は不要。
- 判定結果が「後続の自己投稿が2件以上（`source`自身を含む）」の場合のみ、削除ダイアログに「スレッド全体を削除」の選択肢を追加表示する。1件のみ（`source`が単発投稿）の場合は、既存の「entryのみ削除」「entry＋元投稿を削除」の2択のままとする。
- 「スレッド全体を削除」が選ばれた場合、`DELETE /v2/entry`に`deleteBskyPost: true`と`deleteBskyThread: true`をあわせて送信する（[specs/entry/backend/design.md §5.1](../backend/design.md#51-リクエスト形式)）。フロントエンドは削除対象の投稿一覧を自ら組み立てて送信する必要はない（サーバが`source`から導出する。[specs/entry/backend/design.md §7.3.1](../backend/design.md#731-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)）。
- 削除確認ダイアログの文言は、「スレッド全体を削除」を選んだ場合、後続の自己投稿もすべて削除される旨・元に戻せない旨を明示する（第三者の返信は削除されず残る点も、必要に応じて注記する）。
- **最終確認の二段階化**: 「スレッド全体を削除」は他の削除方式より影響範囲が大きく取り消し不能なため、選択と同時に削除を実行せず、`EntryDeleteConfirmDialog`内部にstage（`"choice"` | `"confirmThread"`）を持たせ、選択肢提示→最終確認の2段階を経てから実行する。
  - `stage === "choice"`: 現行通り「entryのみ削除」「entry＋元投稿を削除」「スレッド全体を削除」（`showThreadOption`時のみ）の選択肢を提示する。「スレッド全体を削除」ボタンの`onClick`は削除APIを呼ばず、`stage`を`"confirmThread"`に切り替えるのみとする。
  - `stage === "confirmThread"`: 後述の`ConfirmDialog`で最終警告を表示する。確定操作でのみ実際の`onDeleteThread`（削除API呼び出し）を実行する。キャンセル（ボタン・背景クリック・Esc共通）は`stage`を`"choice"`へ戻し、削除自体は実行しない。
  - `EntryDeleteConfirmDialog`が閉じられた（`open`がfalseになった）場合は、次回開いたとき必ず`"choice"`から始まるよう`stage`をリセットする。
  - `EntryCard`・`useSkyshareEntryStatus`（`PostCard`が利用）など呼び出し側の`onDeleteThread`配線は変更しない。二段階化は`EntryDeleteConfirmDialog`内部に閉じる。
- **新規共通コンポーネント`ConfirmDialog`（`src/components/common/`）の導入**: 最終警告には「なぜ危険か」を明示する本文メッセージが必要だが、既存の`ChoiceDialog`（`src/components/common/ChoiceDialog`）はボタン列挙のみを責務とする設計であり、メッセージ本文を表示する仕組みを持たない。そのため`ChoiceDialog`を多段化・継承するのではなく、`Overlay`を直接使いタイトル・本文メッセージ・確定/キャンセルボタンを持つ新規の汎用コンポーネント`ConfirmDialog`を追加し、`stage === "confirmThread"`ではこれを描画する。`ConfirmDialog`はボタン配色を`ChoiceDialog`が定義する`DialogButtonVariant`型・色クラス変換ロジック（`ChoiceDialog`からexportして再利用）で揃え、アプリ全体のボタン配色と一貫させる。

### 3.5 entry詳細ページでの視覚的区別（FR-6対応）

- 判定条件は3.3節のスレッド取得結果（抽出結果が2件以上）と同じ「`source`がスレッド先頭であり、かつentry所有者自身の後続投稿が実際に存在する」を用いる。
- 区別表示（バッジ等）の具体的な見た目・配置は実装時に決定する（tasks.md対象）。
- Timeline（一覧）側での同様の視覚的区別は[specs/timeline/design.md](../../timeline/design.md)が定める（本書の対象外）。
