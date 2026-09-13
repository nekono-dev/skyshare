# entry フロントエンド設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

本書は、[requirements.md](requirements.md)が定める要件のうち、スレッド投稿に伴うentryの`source`/`visual`の扱いを満たすための具体的な設計方針を示す。投稿フォーム自体のスレッド化（セグメントのUI構成・状態管理）は[specs/threadpost/design.md](../../threadpost/design.md)の責務であり、本書の対象外とする。バックエンドAPI設計は[specs/entry/backend/design.md](../backend/design.md)（特に§7・§3.2の`entrySource`関連の記述）を参照。

## 1. 概要

- スレッド投稿機能により、1回の`POST /v2/entry`で複数の投稿（segment）を原子的に作成できる（[specs/threadpost/design.md §2](../../threadpost/design.md)）。これに伴い、entryの`source`をスレッド全体を代表する形にするか、投稿ごとに個別にするかという設計判断が生じ、バックエンドは`entrySource: "self" | "threadRoot"`という選択可能なフィールドを持つ（[specs/entry/backend/requirements.md §2 FR-7](../backend/requirements.md#2-機能要件)）。
- 本書は、フロントエンドがこの`entrySource`をどう使うか（visual選択・送信内容の決定）と、スレッド由来entryを一覧・詳細ページでどう表示するかを設計する。

## 2. 前提とする既存コンポーネントの責務

単発投稿時のentry生成・表示は本書のスコープ外（[requirements.md §1](requirements.md#1-背景スコープ)）だが、以下のコンポーネントの責務を前提として本書の設計は成り立つ。

### 2.1 単発投稿時のvisual作成

- `ImagePicker`（[src/components/image/ImagePicker/index.tsx](../../../src/components/image/ImagePicker/index.tsx)）が、1投稿分の画像（最大4枚）から`ImageEntry`を生成する。`ImageEntry.thumbnailBlob`（visual）は`createProcessedImages`/`composeThumbnailBlob`（[src/lib/image/postImageProcessing.ts](../../../src/lib/image/postImageProcessing.ts)）が、各画像のクロップ状態から1枚に合成して作る。
- `submitEntry.ts`（[src/components/post/PostForm/submitEntry.ts](../../../src/components/post/PostForm/submitEntry.ts)）が、`posts: [post]`（常に1件配列）で`POST /v2/entry`（`createEntry`関数、OpenAPI生成クライアント）を呼び出す。画像投稿かつ`manualImageAttach`が無効な場合のみ`post.ogImage = imageEntry.thumbnailBlob`・`post.createEntry = true`を設定する。
- 既存投稿への事後付与（from-post相当）は`useSkyshareEntryStatus.ts`（[src/components/post/PostCard/useSkyshareEntryStatus.ts](../../../src/components/post/PostCard/useSkyshareEntryStatus.ts)）が担い、PostForm由来のthumbnailを持たない投稿に対しては`createDefaultThumbnail`（`postImageProcessing.ts`の別関数）でvisualを生成する。

### 2.2 entry一覧・型

- `GET /v2/entries/skyshare`のレスポンス型`TimelineSkyshareEntry`（[src/lib/entry/posts.ts](../../../src/lib/entry/posts.ts)）は`sourceUri`/`sourceCid`を単一値として持つ。スレッド構造を表すフィールドは無い。
- SSR用の`EntryLike`型（[src/lib/entry/entry.ts](../../../src/lib/entry/entry.ts)）も同様に`source.uri`のみを持つ。

### 2.3 entry詳細ページ

- `entries/[slug].astro`（SSR、`prerender = false`）が、slugからentryレコードを`getRecord`で取得し、`source.uri`（単一のBluesky投稿）を`agent.getPosts`で1件取得して、`EntryDetailView`（[src/components/entry/EntryDetailView/index.astro](../../../src/components/entry/EntryDetailView/index.astro)）に渡す。
- `EntryDetailView`は、1つの`sourceWebUrl`・1つの`sourceText`（未使用）・`sourceImages`配列（1投稿分の画像）・`PostEngagementStats`を描画する。スレッド表示の仕組みは持たない。

## 3. スレッド投稿時の設計方針

### 3.1 visual選択（FR-1対応）

- スレッド投稿UI（[specs/threadpost](../../threadpost/design.md)側で設計されるsegment配列の状態管理）が、画像投稿segmentを2件以上持つ場合、そのうち1件を「visual元」として選択させるUIを設ける（具体的なUIコンポーネント配置は[specs/threadpost](../../threadpost/design.md)側のアーキテクチャに従う。本書はロジックのみを規定する）。
- 選択されたsegmentの`ImageEntry`（既存の`ImagePicker`がsegmentごとに持つ想定）に対して、既存の`thumbnailBlob`生成ロジック（2.1節）をそのまま適用する。visual生成そのものの実装（`createProcessedImages`）は変更不要。
- 画像投稿segmentがちょうど1件の場合は、そのsegmentを選択UIなしで自動的にvisual元として扱う（既存の単発投稿と同じ体験）。
- スレッド下書き（[specs/threadpost/design.md §3](../../threadpost/design.md)の`posts`配列）は画像を保持しないため、visual選択UI・visual元の決定は下書き復元時には行わない。各segmentの画像が実際に揃う送信直前のタイミングでのみ、このUIを評価・表示する。

### 3.2 送信内容の決定（FR-2, FR-3対応）

- 画像投稿segmentが0件のスレッドでは、`createEntry`をどのsegmentにも設定しない（`ogImage`も設定しない）。
- 画像投稿segmentが1件以上あり、visual元segmentが決まっている場合、そのsegmentのみ`post.createEntry = true` + `post.entrySource = "threadRoot"` + `post.ogImage = <選択segmentのthumbnailBlob>`を設定する。他のsegmentには`createEntry`を設定しない。
- 単発投稿（segmentが1件のみ）の場合は、`entrySource`を省略してよい（バックエンドのデフォルト解決により`"self"`相当になる。[specs/entry/backend/requirements.md §2 FR-7](../backend/requirements.md#2-機能要件)参照）。既存の`submitEntry.ts`の実装はこのままで良く、変更不要。
- 投稿segmentごとに個別entryを作る方針（`entrySource: "self"`を複数segmentに明示指定するUI）は設けない（[requirements.md §3 FR-3](requirements.md#3-機能要件)、本書のスコープ外）。

### 3.3 entry詳細ページのスレッド表示（FR-4対応）

- `entries/[slug].astro`が取得したentryの`source`投稿について、Bluesky公式の`app.bsky.feed.getPostThread`（`AtpAgent`経由、Node.js非依存）でreply chainを取得する。
- 取得したスレッドのうち、`source`投稿の`author.did`と一致する投稿のみを時系列順に抽出する（他者の返信は除外。FR-4）。抽出結果が1件（`source`投稿自身のみ、後続投稿なし）の場合は、現行の単一投稿表示（`EntryDetailView`の既存パス）にフォールバックする。
- 抽出結果が2件以上の場合、新設のスレッド表示コンポーネント（例: `EntryThreadView`、`EntryDetailView`と同じ`src/components/entry/`配下に配置）で、各投稿のテキスト・画像を投稿順に描画する。既存の`sourceImages`抽出ロジック（`extractSourceImages`、[src/lib/entry/entry.ts](../../../src/lib/entry/entry.ts)）を各投稿に対して個別に適用し、どの投稿の画像かが分かる形で並べる。
- `PostEngagementStats`（いいね・リポスト等のカウント）は、既存実装同様`source`投稿1件分を表示する（スレッド全体の集計は行わない）。スレッド内の他投稿のカウント表示要否・レイアウトは実装時に決定する（tasks.md対象）。

### 3.4 entry削除時のスレッド全体削除オプション（FR-5対応）

- 削除確認UI（entry所有者向け、entry詳細ページ・entry一覧いずれの削除導線でも対象）は、削除対象entryの`source`が実際にスレッド先頭であり、かつentry所有者自身の後続投稿が存在するかどうかを、削除ダイアログを開くタイミングで判定する。この判定には3.3節と同じスレッド取得結果（`getPostThread`によるreply chain取得＋所有者一致フィルタ）を利用できる。詳細ページから削除する場合は3.3節で既に取得済みのスレッド情報を再利用し、追加のAPI呼び出しを避ける。一覧ページなど事前にスレッド情報を持たない導線から削除する場合は、削除ダイアログを開いた時点で`getPostThread`を呼び出して同じ判定を行う。
- 判定結果が「後続の自己投稿が2件以上（`source`自身を含む）」の場合のみ、削除ダイアログに「スレッド全体を削除」の選択肢を追加表示する。1件のみ（`source`が単発投稿）の場合は、既存の「entryのみ削除」「entry＋元投稿を削除」の2択のままとする。
- 「スレッド全体を削除」が選ばれた場合、`DELETE /v2/entry`に`deleteBskyPost: true`と`deleteBskyThread: true`をあわせて送信する（[specs/entry/backend/design.md §5.1](../backend/design.md#51-リクエスト形式)）。フロントエンドは削除対象の投稿一覧を自ら組み立てて送信する必要はない（サーバが`source`から導出する。[specs/entry/backend/design.md §7.4.1](../backend/design.md#741-スレッド全体削除deletebskythreadtrue-のときの削除対象の導出)）。
- 削除確認ダイアログの文言は、「スレッド全体を削除」を選んだ場合、後続の自己投稿もすべて削除される旨・元に戻せない旨を明示する（第三者の返信は削除されず残る点も、必要に応じて注記する）。具体的な文言・レイアウトは実装時に決定する（tasks.md対象）。

### 3.5 entry一覧・詳細ページでの視覚的区別（FR-6対応）

- `EntryList`・`GET /v2/entries/skyshare`のレスポンス型・表示ロジックは変更不要（2.2節の通り、`sourceUri`が指す先が変わるのみ）。
- 判定条件は3.4節と同じ「`source`がスレッド先頭であり、かつentry所有者自身の後続投稿が実際に存在する」を用いる。詳細ページでは3.3節のスレッド取得結果（抽出結果が2件以上）と同じ判定に一本化する。一覧ページでは、判定に必要な情報（後続の自己投稿の有無）を得るための取得方法・タイミングは実装時に決定する（tasks.md対象）。
- 区別表示（バッジ等）の具体的な見た目・配置は実装時に決定する（tasks.md対象）。本書が定めるのは「判定条件を一覧・詳細ページで共通化すること」までとする。
