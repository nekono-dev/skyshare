# entry フロントエンド設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

本書は、[requirements.md](requirements.md)が定める要件のうち、スレッド投稿に伴うentryの`source`/`visual`の扱いを満たすための具体的な設計方針を示す。投稿フォーム自体のスレッド化（セグメントのUI構成・状態管理）は[specs/threadpost/design.md](../../threadpost/design.md)の責務であり、本書の対象外とする。バックエンドAPI設計は[specs/entry/backend/design.md](../backend/design.md)（特に§3.1・§7の`createEntry`/`visual`・`source`解決関連の記述）を参照。

## 1. 概要

- スレッド投稿機能により、1回の`POST /v2/entry`で複数の投稿（segment）を原子的に作成できる（[specs/threadpost/design.md §2](../../threadpost/design.md)）。entry作成はリクエスト全体につき1回（トップレベルの`createEntry`+`visual`）のみ指定できる。この経路（新規投稿・スレッド作成）では`source`は常に`posts[0]`（スレッド先頭）であり、クライアントが選ぶ余地はない（[specs/entry/backend/requirements.md FR-1・FR-2](../backend/requirements.md#2-機能要件)）。Timeline上での事後entry作成（from-post）経路は、対象投稿の`uri`をクライアントが明示的に指定する方式であり、本書ではなく[specs/timeline/design.md §5](../../timeline/design.md#5-事後entry作成ボタンの表示条件とsourceの明示送信fr-3対応)が定める。
- 本書は、フロントエンドがどのsegmentの画像をvisualとして選び、トップレベルの`createEntry`/`visual`としてどう送信するか（送信内容の決定）と、スレッド由来entryをentry詳細ページでどう表示するかを設計する。

## 2. 前提とする既存コンポーネントの責務

単発投稿時のentry生成・表示は本書のスコープ外（[requirements.md §1](requirements.md#1-背景スコープ)）だが、以下のコンポーネントの責務を前提として本書の設計は成り立つ。

### 2.1 単発投稿時のvisual作成

- `ImagePicker`（[src/components/image/ImagePicker/index.tsx](../../../src/components/image/ImagePicker/index.tsx)）が、1投稿分の画像（最大10枚、[specs/multiimage](../../multiimage/design.md)）から`ImageEntry`を生成する。`ImageEntry.thumbnailBlob`（visual）は`createProcessedImages`/`composeThumbnailBlob`（[src/lib/image/postImageProcessing.ts](../../../src/lib/image/postImageProcessing.ts)）が、先頭4枚のクロップ状態から1枚に合成して作る（5枚目以降はvisualに使わない）。
- `submitThread.ts`（[src/components/post/ThreadComposer/submitThread.ts](../../../src/components/post/ThreadComposer/submitThread.ts)、[specs/threadpost/design.md §4.1](../../threadpost/design.md#41-コンポーネント構成)によりリネーム・一般化された旧`PostForm/submitEntry.ts`）が、`segments`配列を`posts`配列（1件なら単発投稿、複数件ならスレッド）へマッピングして`POST /v2/entry`（`createEntry`関数、OpenAPI生成クライアント）を呼び出す。画像投稿かつ`manualImageAttach`が無効なsegment（entry候補）のうち、先頭（最小index）のsegmentが見つかった場合、そのsegmentの`imageEntry.thumbnailBlob`をリクエストのトップレベル`visual`に、`createEntry: true`もトップレベルに設定する（3.1節の自動選択ロジック）。
- 既存投稿への事後付与（from-post相当）は`useSkyshareEntryStatus.ts`（[src/components/post/PostCard/useSkyshareEntryStatus.ts](../../../src/components/post/PostCard/useSkyshareEntryStatus.ts)）が担い、`ThreadComposer`由来のthumbnailを持たない投稿に対しては`createDefaultThumbnail`（`postImageProcessing.ts`の別関数）でvisualを生成する。

### 2.2 entry一覧・型

- `GET /v2/entries/skyshare`のレスポンス型`TimelineSkyshareEntry`（[src/lib/entry/posts.ts](../../../src/lib/entry/posts.ts)）は`sourceUri`/`sourceCid`を単一値として持つ。スレッド構造を表すフィールドは無い。
- SSR用の`EntryLike`型（[src/lib/entry/entry.ts](../../../src/lib/entry/entry.ts)）も同様に`source.uri`のみを持つ。

### 2.3 entry詳細ページ

- `entries/[slug].astro`（SSR、`prerender = false`）が、slugからentryレコードを`getRecord`で取得し、`source.uri`（単一のBluesky投稿）を`agent.getPosts`で1件取得して、`EntryDetailView`（[src/components/entry/EntryDetailView/index.astro](../../../src/components/entry/EntryDetailView/index.astro)）に渡す。

> **注記**: Entry詳細ページの表示構成（`EntryDetailView`・`EntryThreadView`・`PostEngagementStats`の扱い）は [specs/postcardlayout/design.md](../../postcardlayout/design.md) §3.5 に置き換えられた。以下は置き換え前の記述である。

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
- 取得した`ThreadViewPost`を先頭（`source`）から辿り、各ノードの`replies`のうち`post.author.did === source.author.did`（entry所有者自身）に一致する投稿を次のノードの候補とする。候補が1件ならそのまま採用し、候補が2件以上（同一投稿への複数の自己返信＝実在する分岐）の場合のみ、直前の投稿との`record.createdAt`の差が最小のものを1件選ぶ（`extractOwnedLinearReplyChain`、`specs/entry/backend/design.md §7.3.1`のBluesky投稿削除・`specs/timeline/design.md §2.2`のTimelineグルーピングと共通の抽出規則。第三者の返信、および第三者の返信で分岐した先は破棄する）。探索は`MAX_THREAD_POST_COUNT`件に達するか、次のノードが見つからなくなるまで続ける。
- 抽出結果が1件（`source`投稿自身のみ、後続投稿なし）の場合は、現行の単一投稿表示（`EntryDetailView`の既存パス）にフォールバックする。
- 抽出結果が2件以上の場合、新設のスレッド表示コンポーネント（例: `EntryThreadView`、`EntryDetailView`と同じ`src/components/entry/`配下に配置）で、各投稿のテキスト・画像を投稿順に描画する。既存の`sourceImages`抽出ロジック（`extractSourceImages`、[src/lib/entry/entry.ts](../../../src/lib/entry/entry.ts)）を各投稿に対して個別に適用し、どの投稿の画像かが分かる形で並べる。
- `PostEngagementStats`（いいね・リポスト等のカウント）は、既存実装同様`source`投稿1件分を表示する（スレッド全体の集計は行わない）。スレッド内の他投稿のカウント表示要否・レイアウトは実装時に決定する（tasks.md対象）。
- `source`は、新規投稿・スレッド作成経路では常に`posts[0]`（プロトコルルート自身）になり、Timeline上の事後entry作成（from-post）経路では、クライアントが明示的に指定したメインスレッドのルート投稿になる（[specs/entry/backend/requirements.md FR-2](../backend/requirements.md#fr-2-entryのsourceの決定)、[specs/timeline/design.md §5](../../timeline/design.md#5-事後entry作成ボタンの表示条件とsourceの明示送信fr-3対応)）。いずれの経路でも`source`はサーバによって再解釈されず、クライアントが指定した投稿そのものである。本節の処理（`source`を起点とした`extractOwnedLinearReplyChain`）は、`source`がどの投稿であっても同一のロジックで正しく機能する（`source`自身が返信でなければ1件のみの結果になり、3.3節の単一投稿表示にフォールバックする）ため、この点による実装上の変更は無い。

### 3.4 entry削除時のBluesky投稿削除の範囲確認と無効化（FR-5対応）

削除確認UI（`EntryDeleteConfirmDialog`）は、entry所有者向けの共通コンポーネントとして`EntryCard`（`/entries`）・`PostCard`（Timeline、[specs/timeline/design.md §7](../../timeline/design.md#7-リンクbluesky投稿削除fr-5対応)）の双方から呼び出される。`entries/[slug].astro`（所有者判定を持たない公開ページ）には追加しない（既存の決定を維持）。

#### 3.4.1 削除範囲の判定（`resolveEntryDeleteScope`）

`src/lib/entry/resolveEntryDeleteScope.ts`（旧`resolveThreadDeleteOption.ts`を置き換える。ファイル・テストとも改名）が、ダイアログを開く直前に`source`の状態を判定する。`sourceUri`のrepo（DID）自体がentry所有者のDIDと一致するため、追加のセッション取得は不要。

```ts
export type EntryDeleteScope =
  | { kind: "deletable"; posts: TimelinePost[] } // sourceが起点。削除される自己投稿（古い→新しい順、単発は1件。件数は`posts.length`）
  | { kind: "legacy" } // sourceが返信投稿（旧実装で作成されたentry）
  | { kind: "unknown" } // 判定不能

export const resolveEntryDeleteScope = async (
  sourceUri: string,
): Promise<EntryDeleteScope> => {
  const parsed = parseAtUri(sourceUri)
  if (!parsed) return { kind: "unknown" }
  try {
    const res = await publicAtpAgent.app.bsky.feed.getPostThread({
      uri: sourceUri,
      depth: MAX_THREAD_POST_COUNT,
      parentHeight: 0,
    })
    if (!AppBskyFeedDefs.isThreadViewPost(res.data.thread))
      return { kind: "unknown" }
    if (!isThreadRootPost(res.data.thread.post)) return { kind: "legacy" }
    const chain = extractOwnedLinearReplyChain(
      res.data.thread,
      parsed.repo,
      MAX_THREAD_POST_COUNT,
    )
    // 一覧表示用に変換する。変換不能な投稿（最小要件不足）があれば、サーバの削除対象と
    // 一覧がずれるため、安全側で判定不能にする。
    const posts = chain.map(post => normalizePostViewToTimelinePost(post))
    if (posts.some(post => post === undefined)) return { kind: "unknown" }
    return { kind: "deletable", posts: posts as TimelinePost[] }
  } catch (err) {
    console.error("resolveEntryDeleteScope: failed", err)
    return { kind: "unknown" }
  }
}
```

- 起点判定の`isThreadRootPost`・後続投稿の抽出`extractOwnedLinearReplyChain`は、サーバ（[specs/entry/backend/design.md §7.3.1](../backend/design.md#731-bluesky投稿削除deletebskyposttrueの削除対象の導出)）と同一の関数を用いる。これにより、ダイアログが提示する削除件数・可否とサーバの実際の挙動が一致する。
- 削除予定投稿の一覧（FR-5-1）は、この判定で取得済みの`chain`（`PostView`）を`normalizePostViewToTimelinePost`（`@/lib/entry/posts`）で`TimelinePost`（本文`text`・`indexedAt`・画像`images`を持つ）へ変換して`posts`に保持する。最終確認を開く際の追加通信は無く、サーバの削除対象導出と同一の`chain`から作るため、一覧と実際の削除対象が一致する。
- 判定不能（`source`が取得できない・取得失敗）は`unknown`とし、安全側（Bluesky投稿の削除を無効化）に倒す。

#### 3.4.2 `EntryDeleteConfirmDialog`

```ts
type Props = {
  open: boolean
  isDeleting?: boolean
  deleteScope: EntryDeleteScope // 削除範囲の判定結果（呼び出し側がダイアログを開く前に確定させる）
  onDeleteLink: () => void | Promise<void>
  onDeletePost: () => void | Promise<void> // 最終確認の確定時のみ呼ばれる
  onCancel: () => void
}
```

旧`showThreadOption`・`onDeleteThread`は廃止する（後方互換のpropsは残さない）。内部stageは`"choice"` | `"confirmPost"`の2つ。

- `stage === "choice"`（`ChoiceDialog`）:

  | key           | label                     | variant                                                       | 動作                                                                 |
  | ------------- | ------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
  | `delete-link` | Skyshareリンクを削除      | `black`                                                       | `onDeleteLink`（従来通り。最終確認なし）                             |
  | `delete-post` | リンク・Bluesky投稿を削除 | `deleteScope.kind === "deletable"`なら`red`、それ以外は`gray` | `deletable`のみ`setStage("confirmPost")`。それ以外は`disabled: true` |
  | `cancel`      | キャンセル                | `gray`                                                        | `onCancel`                                                           |

  `isDeleting`中は全ボタン`disabled`。「リンク・Bluesky投稿を削除」の文言は`deleteScope`によらず変えない。

- 無効化の理由表示: `ChoiceDialog`に任意prop`description?: string`を追加し、指定時はボタン列の上に`ConfirmDialog`の本文と同じ`ui["dialog-body"]`で表示する。`EntryDeleteConfirmDialog`は`deleteScope.kind`に応じて次を渡す（`deletable`では渡さない）。
  - `legacy`: 「このEntryは旧仕様で作成されており、Bluesky投稿を含めて削除できません。Skyshareリンクのみ削除するか、Bluesky上で直接投稿を削除してください。」
  - `unknown`: 「Bluesky投稿の状態を確認できないため、投稿を含めた削除は実行できません。時間をおいて再度お試しください。」
- `stage === "confirmPost"`（`DeletePostListDialog`、`deleteScope.kind === "deletable"`のときのみ到達）: 3.4.5節の専用ダイアログに`posts={deleteScope.posts}`・`isDeleting`・`onConfirm={onDeletePost}`・`onCancel={() => setStage("choice")}`を渡す。キャンセル（ボタン・背景クリック・Esc共通）は`stage`を`"choice"`へ戻し、削除は実行しない。
- `open`がfalseになったら`stage`を`"choice"`へリセットする（既存の`useEffect`を維持）。
- 最終確認に`ConfirmDialog`（`src/components/common/`）は用いない。`ConfirmDialog`は本文メッセージのみを持つ汎用部品であり、投稿一覧のようなドメイン固有の内容は持たせない。`ConfirmDialog`自体は変更しない（`ChoiceDialog`への`description`追加は維持）。

#### 3.4.3 呼び出し側の配線

- `EntryCard`（`/entries`）: `showThreadOption` stateを`deleteScope: EntryDeleteScope | null`へ置き換える。`openDeleteDialog`は非orphanedの場合に`await resolveEntryDeleteScope(item.sourceUri)`の結果を`setDeleteScope`し、ダイアログを開く（判定中は削除ボタンを無効化し「削除内容を確認中...」を表示する既存挙動を維持）。`onDeletePost={() => confirmDelete(true)}`とし、`confirmDelete(deleteBskyPost?: boolean)`から`deleteBskyThread`引数を削除する。orphaned entryは従来通り`ChoiceDialog`による単純確認で、`resolveEntryDeleteScope`も呼ばない。
- `useSkyshareEntryStatus`（`PostCard`が利用）: `isResolvingThreadOption`→`isResolvingDeleteScope`、`showThreadOption`→`deleteScope: EntryDeleteScope | null`へ改名・置換する。`confirmDeleteEntry(deleteBskyPost: boolean)`の第2引数を削除する。
- 削除APIの送信ボディは`{ uri, deleteBskyPost }`のみ（`deleteBskyThread`は送らない）。
- 409応答（判定後にサーバ側で起点判定が覆った場合など）・その他の失敗は、削除を行わずに既存の削除エラー表示（`deleteError`）へ流す。409のメッセージは「このEntryはBluesky投稿を含めて削除できません。」とする。

#### 3.4.4 ゲスト表示での模擬動作（mock）

ゲスト表示（`?guest`、`@/lib/guestMode`）では、実Blueskyへの書き込みを避けつつ削除フローを確認できるよう、削除ボタンを有効にし、削除範囲の判定と削除の実行をアプリ内で模擬する。ネットワーク通信（`getPostThread`・`DELETE /v2/entry`）は一切行わない。編集ボタンなど他の操作のゲスト無効化は変更しない。

- **削除範囲の判定**: `src/lib/entry/guestDummyPosts.ts`に、`GUEST_DUMMY_POSTS`から該当`TimelinePost`を引く`guestPost(id)`を用意し（一覧表示用の本文・日時・画像のダミーはこのデータをそのまま使う）、ダミーentryの`sourceUri`から`EntryDeleteScope`を引くテーブルを持つ。テーブルにないentryは`{ kind: "unknown" }`とする。

  ```ts
  export const GUEST_DELETE_SCOPES: Record<string, EntryDeleteScope> = {
    "at://did:plc:guestdemo/app.bsky.feed.post/guest2": {
      kind: "deletable",
      posts: [guestPost("guest2")], // 画像付き単発投稿
    },
    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root": {
      kind: "deletable",
      posts: [
        guestPost("guest-thread-b-root"),
        guestPost("guest-thread-b-tail"),
      ],
    },
    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid": {
      kind: "legacy",
    },
    "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown": {
      kind: "unknown",
    },
  }
  export const resolveGuestDeleteScope = (
    sourceUri: string,
  ): EntryDeleteScope => GUEST_DELETE_SCOPES[sourceUri] ?? { kind: "unknown" }
  ```

- **ダミーデータの追加**（`GUEST_DUMMY_POSTS`・`GUEST_DUMMY_THREADS`）: 旧実装のentryを再現するスレッドD（ルート`guest-thread-d-root`＋返信`guest-thread-d-mid`。entryは返信側にのみ付き、`sourceUri`は`guest-thread-d-mid`）と、判定不能を再現するentry付き単独投稿`guest-unknown`を追加する。ルートにentryが無くrepliesにentryがあるスレッドとなるため、ルートが画像を持たない構成にして事後entry作成ボタンの表示条件（[specs/timeline/design.md §5](../../timeline/design.md#5-事後entry作成ボタンの表示条件とsourceの明示送信fr-3対応)）に影響しないようにする。
- **判定の差し替え**: `EntryCard.openDeleteDialog`・`useSkyshareEntryStatus.requestDeleteEntry`は、`guestMode`のとき`resolveEntryDeleteScope`の代わりに`resolveGuestDeleteScope`を呼ぶ（`await`の有無による挙動差を避けるため、同じ`Promise<EntryDeleteScope>`形で扱う）。
- **削除の模擬**: `confirmDelete`/`confirmDeleteEntry`は、`guestMode`のとき`deleteEntry`を呼ばず、成功時と同じ状態遷移（`EntryCard`は`onDeleted`、`PostCard`はentry表示の除去と、`deleteBskyPost:true`の場合の`onPostDeleted`）だけを実行する。ゲスト表示のダミーデータはメモリ上のため、リロードで元に戻る。
- **案内文**: Timeline・entry一覧のゲスト案内文に、削除は画面上の模擬動作で実際のデータには影響しない旨を加える。
- `PostCardEntryActions`の`disabled`は削除ボタンにも掛かるため、削除ボタン専用の`deleteDisabled?: boolean`を追加する。`PostCard`は`deleteDisabled={isResolvingDeleteScope}`を渡し、`disabled`（作成・共有ボタン用）は従来通り`guestMode || isResolvingDeleteScope`とする。

#### 3.4.5 `DeletePostListDialog`（削除予定投稿の一覧付き最終確認、FR-5-1対応）

`src/components/entry/DeletePostListDialog/`（`index.tsx`・`index.module.css`）。`Overlay`と`ui.module.css`のダイアログ共通クラス（`dialog-card`/`dialog-body`/`dialog-actions`/`dialog-actions-row`）、`ChoiceDialog`の`variantClassName`を直接用いる（`ConfirmDialog`と同じ構成。`ConfirmDialog`の継承・拡張はしない）。entry固有の部品のため`components/entry/`に置く。

```ts
type Props = {
  open: boolean
  posts: TimelinePost[] // 削除予定の投稿（古い→新しい順。1件以上）
  isDeleting?: boolean
  onConfirm: () => void | Promise<void> // 「全て削除」押下時のみ
  onCancel: () => void // キャンセルボタン・背景クリック・Esc
}
```

構造（`role="dialog"`、`aria-label="Bluesky投稿削除の最終確認"`、幅は`ui["width-md"]`）:

```
<h2>本当にBluesky投稿を削除しますか？</h2>
<p>{summary} この操作は取り消せません。第三者からの返信は削除されず残ります。</p>
<div role="region" aria-label="削除予定のBluesky投稿一覧">   ← スレッド(2件以上)のみ固定高さ＋縦スクロール
  <ComponentList items={posts} itemComponent={DeletePostListItem} getItemKey={(post) => post.uri} />
</div>
<div class="dialog-actions dialog-actions-row">キャンセル / 全て削除</div>
```

- `summary`: `posts.length === 1`なら「Blueskyの投稿1件を削除します。」、`>= 2`なら`Blueskyのスレッド（${posts.length}件の投稿）を削除します。`。
- 一覧の描画は共通の`ComponentList`（`@/components/common/ComponentList`）を用い、1行は新設の`DeletePostListItem`（`src/components/entry/DeletePostListItem/`、`index.tsx`・`index.module.css`、`{ item: TimelinePost }`を受ける`article`）が担う。
- `DeletePostListItem`: 投稿日時は`PostCard`と同じ整形（`new Date(post.indexedAt).toLocaleString("ja-JP", ...)`）。本文は`post.text`をプレーンテキストで表示し（facetsの装飾はしない）、CSSの`-webkit-line-clamp: 3`で省略する。`text`が空なら「（本文なし）」を弱い文字色で表示する。サムネイルは`post.images`の先頭4枚を`<img src={url} alt={alt} loading="lazy">`（一辺56px、`object-fit: cover`）で並べ、5枚以上なら末尾に「+N」を表示する。`images`が空ならサムネイル欄自体を描画しない。動画投稿（`video`、利用不可の`unsupportedVideo`も含む）は、画像の代わりに`thumbnailUrl`の poster を同じ一辺56pxで1枚表示し、中央に小さな再生マーク（直径24pxの半透明の円＋白い三角、CSSのみ）を重ねる。
- 一覧領域のサイズ: `posts.length >= 2`（スレッド）のときだけ、一覧を包む`div`に`.post-list-fixed`（`height: min(40vh, 360px); overflow-y: auto; flex-shrink: 0`）を付け、高さを固定してスクロールさせる。件数が増えても行が潰れず、ボタンが画面内に残る。スクロール領域自体はflexにせず、行の縮みは起こさない（行の`article`に`margin-bottom`で間隔を確保）。1件のときは内容の高さに合わせる。固定高さのときはキーボードでスクロールできるよう`tabIndex=0`を付ける。
- `isDeleting`中は`Loading overlay`（「削除中...」）を表示し、両ボタンを`disabled`にする。確定ボタン（「全て削除」）は`red-strong`、キャンセルは`gray`。

### 3.5 entry詳細ページでの視覚的区別（FR-6対応）

- 判定条件は3.3節のスレッド取得結果（抽出結果が2件以上）と同じ「`source`がスレッド先頭であり、かつentry所有者自身の後続投稿が実際に存在する」を用いる。
- 区別表示（バッジ等）の具体的な見た目・配置は実装時に決定する（tasks.md対象）。
- Timeline（一覧）側での同様の視覚的区別は[specs/timeline/design.md](../../timeline/design.md)が定める（本書の対象外）。
