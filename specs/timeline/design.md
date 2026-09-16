# Timeline コンポーネント 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

対象ファイル:

- バックエンド: [src/pages/v2/entries.ts](../../src/pages/v2/entries.ts)、[src/lib/entry/posts.ts](../../src/lib/entry/posts.ts)
- フロントエンド: [src/components/post/Timeline/index.tsx](../../src/components/post/Timeline/index.tsx)、[src/components/post/PostCard/](../../src/components/post/PostCard/)

## 1. 現状実装の整理

- `GET /v2/entries`（[src/pages/v2/entries.ts](../../src/pages/v2/entries.ts)）は`agent.getAuthorFeed({ actor: did, limit, cursor })`を呼び出し、自分の投稿のみへフィルタしながら`fetchOwnAuthorFeed`でページングする。レスポンスの`FeedViewPost`はatproto仕様上`reply`（`root`/`parent`のPostView）を持ちうるが、`normalizeTimelinePost`（[src/lib/entry/posts.ts](../../src/lib/entry/posts.ts)）はこれを読み出しておらず、`TimelinePost`型にreply chain情報は存在しない。
- `TimelinePost`型（現状）:
  ```ts
  export type TimelinePost = {
    uri: string
    cid: string
    url: string
    indexedAt: string
    author: TimelinePostAuthor
    text: string
    images: SourceImage[]
    skyshareEntry?: TimelineSkyshareEntry
  }
  ```
- `PostCard`（[src/components/post/PostCard/index.tsx](../../src/components/post/PostCard/index.tsx)）は1投稿（`TimelinePost`）のみを描画する。`useSkyshareEntryStatus.ts`が、その投稿単体を対象にした事後entry作成（from-post）・削除の状態機械を持つ。
- 本設計は、この既存実装へreply chain情報の伝搬・クライアント側グルーピング・展開UI・事後entry作成条件の拡張を追加する形で行う。既存の`PostCard`・`useSkyshareEntryStatus`のロジック自体は変更せず、複数回インスタンス化して再利用する。

## 2. バックエンド変更: `GET /v2/entries`へのreply chain情報の追加

### 2.1 `TimelinePost`型の拡張

```ts
export type TimelinePost = {
  uri: string
  cid: string
  url: string
  indexedAt: string
  author: TimelinePostAuthor
  text: string
  images: SourceImage[]
  skyshareEntry?: TimelineSkyshareEntry
  replyParentUri?: string // 追加。返信先投稿のuri（返信でない場合はundefined）
}
```

### 2.2 `normalizeTimelinePost`の変更

- `FeedViewPost.reply?.parent`が存在し、かつ`PostView`型（削除済み投稿等でないこと）であれば、その`uri`を`replyParentUri`として設定する。
- `reply.parent`の投稿者が自分自身かどうかはここでは判定しない（判定は3節のクライアント側グルーピングロジックが行う。バックエンドは値をそのまま伝搬するだけに留める）。

### 2.3 影響ファイル

- [src/lib/entry/posts.ts](../../src/lib/entry/posts.ts)（`TimelinePost`型・`normalizeTimelinePost`）
- [src/pages/v2/entries.ts](../../src/pages/v2/entries.ts)（レスポンススキーマに`replyParentUri`を追加）
- [src/lib/api/schema/v2/entries/get.ts](../../src/lib/api/schema/v2/entries/get.ts)相当のレスポンススキーマ（`ResponseBody200Schema`に`replyParentUri: z.string().optional()`を追加）

## 3. フロントエンド: クライアント側グルーピングロジック

### 3.1 データ構造

```ts
// src/components/post/Timeline/threadGroup.ts（新規）
export type ThreadGroup = {
  id: string // rootPost.uriをそのまま使う
  rootPost: TimelinePost
  replies: TimelinePost[] // 古い→新しい順。0件なら単独投稿
}
```

### 3.2 グルーピングアルゴリズム（`groupIntoThreads`）

`GET /v2/entries`の`items`は`indexedAt`降順（新しい順）で並んでいる。

```ts
export const groupIntoThreads = (items: TimelinePost[]): ThreadGroup[] => {
  const byUri = new Map(items.map(item => [item.uri, item]))
  const consumed = new Set<string>()
  const groups: ThreadGroup[] = []

  for (const item of items) {
    if (consumed.has(item.uri)) continue

    // itemを起点に、まだ消費されていない子（自分より新しい返信）を辿って
    // チェーンの末尾（最新側）を探す。
    let tail = item
    while (true) {
      const child = items.find(
        candidate =>
          !consumed.has(candidate.uri) && candidate.replyParentUri === tail.uri,
      )
      if (!child) break
      consumed.add(child.uri)
      tail = child
    }

    // itemからrootに向かって親を辿る（親が一覧内かつ未消費の場合のみ連結する）。
    const chain: TimelinePost[] = [item]
    let current = item
    while (
      current.replyParentUri &&
      byUri.has(current.replyParentUri) &&
      !consumed.has(current.replyParentUri)
    ) {
      const parent = byUri.get(current.replyParentUri)!
      chain.unshift(parent)
      consumed.add(parent.uri)
      current = parent
    }
    // itemとtailの間に挟まる中間ノードも辿り直して連結する（上のtail探索で
    // 消費済みにしているため、再度先頭からのwhileループで自然に組み込まれる）。

    consumed.add(item.uri)
    groups.push({
      id: chain[0].uri,
      rootPost: chain[0],
      replies: chain.slice(1),
    })
  }

  return groups
}
```

- 一覧内に存在しない投稿（ページング境界の外、または他人の投稿）への参照（`replyParentUri`が`byUri`に無い場合）は連結しない。その投稿はそのままそのグループの`rootPost`になる（要件FR-1「無理に遡って取得することはしない」に対応）。
- グルーピングは`ComponentList`が保持する`items`全体に対して、レンダリング直前に`useMemo`で計算する。ページング（無限スクロール）で`items`が追記されるたびに再計算される。

## 4. フロントエンド: UIコンポーネント構成

### 4.1 `ThreadCard`（新規、`src/components/post/ThreadCard/`）

`Timeline`の`ComponentList`の`itemComponent`を、現行の`PostCard`から新設`ThreadCard`へ差し替える（`items`は`TimelinePost[]`から`ThreadGroup[]`へ変更）。

```tsx
type Props = {
  group: ThreadGroup
  onPostDeleted: (predicate: (item: TimelinePost) => boolean) => void
  guestMode: boolean
}

const ThreadCard = ({ group, onPostDeleted, guestMode }: Props) => {
  const [expanded, setExpanded] = useState(false)
  const entryCarrier = findEntryCarrier(group) // 4.2節
  const postCreateEntryTarget = resolvePostCreateEntryTarget(group) // 5.1節

  if (group.replies.length === 0) {
    // 単独投稿: 従来通りPostCardをそのまま描画（フォールバック、FR-2）
    return <PostCard item={group.rootPost} onPostDeleted={...} guestMode={guestMode} />
  }

  return (
    <div className={styles["thread-card"]}>
      <PostCard
        item={group.rootPost}
        onPostDeleted={...}
        guestMode={guestMode}
        threadBadge={!!entryCarrier} // 6節
      />
      {!expanded ? (
        <button onClick={() => setExpanded(true)}>
          返信を表示（{group.replies.length}件）
        </button>
      ) : (
        <>
          {group.replies.map(reply => (
            <PostCard
              key={reply.uri}
              item={reply}
              onPostDeleted={...}
              guestMode={guestMode}
              postCreateEntryButton={reply.uri === postCreateEntryTarget?.uri}
            />
          ))}
          <button onClick={() => setExpanded(false)}>折りたたむ</button>
        </>
      )}
    </div>
  )
}
```

- `PostCard`本体には変更を加えず、新規propsを追加する形で拡張する（4.2節・5節）。
- 折りたたみ状態`expanded`はグループごとにローカルstate（`useState`）で保持し、永続化しない（ページ再読み込みで既定の折りたたみ状態に戻る）。

### 4.2 `PostCard`への追加props

```ts
type PostCardProps = {
  item: TimelinePost
  onPostDeleted: () => void
  guestMode: boolean
  threadBadge?: boolean // 6節: スレッド由来バッジの表示
  postCreateEntryButton?: boolean // 5節: 事後entry作成ボタンの表示
}
```

`postCreateEntryButton: true`の場合、`useSkyshareEntryStatus`が返す状態機械に関わらず、常に「entryを作成」ボタンを表示する（5.2節）。

## 5. 事後entry作成ボタンの表示条件（FR-3対応）

### 5.1 対象投稿の判定（`resolvePostCreateEntryTarget`）

```ts
// src/components/post/ThreadCard/entryCandidate.ts（新規）
export const resolvePostCreateEntryTarget = (
  group: ThreadGroup,
): TimelinePost | null => {
  if (group.replies.length === 0) return null // 単独投稿は対象外
  const hasAnyEntry =
    !!group.rootPost.skyshareEntry ||
    group.replies.some(post => !!post.skyshareEntry)
  if (hasAnyEntry) return null // 要件FR-3-2: 既にentryがあれば対象外
  if (group.rootPost.images.length > 0) return null // 要件FR-3-3: rootが画像を持てば対象外

  return group.replies.find(post => post.images.length > 0) ?? null
  // 要件FR-3-4/5: 最初に画像を持つ後続投稿（時系列順で最も古いもの）
}
```

### 5.2 ボタン押下時の挙動

- `resolvePostCreateEntryTarget`が返した投稿の`uri`を対象に、既存の`useSkyshareEntryStatus`の`createEntryFromPost`ロジック（[specs/entry/frontend/design.md §2.1](../entry/frontend/design.md#21-単発投稿時のvisual作成)、`createDefaultThumbnail`でvisual合成→`createEntry({ uri, visual })`のfrom-post呼び出し）をそのまま再利用する。
- 対象投稿はスレッドの中間・末尾のいずれでもよく、`createEntry`のfrom-post経路は既にこれを許容している（[specs/entry/backend/requirements.md FR-4](../entry/backend/requirements.md#2-機能要件)）。バックエンドが自動的に`source`をスレッド先頭（`group.rootPost`に対応する投稿）へ解決する（[同FR-2](../entry/backend/requirements.md#2-機能要件)）ため、フロントエンドは`entrySource`等を意識する必要がない。
- 作成成功後、Timelineの再取得（`onPosted`相当、`reloadKey`更新）を行い、`group.rootPost.skyshareEntry`が反映された状態を再取得する。

## 6. スレッド由来entryの視覚的区別（FR-4対応）

### 6.1 判定ロジック（`findEntryCarrier`）

```ts
// src/components/post/ThreadCard/entryCandidate.ts
export const findEntryCarrier = (group: ThreadGroup): TimelinePost | null => {
  if (group.replies.length === 0) return null // 単独投稿は区別表示の対象外
  if (group.rootPost.skyshareEntry) return group.rootPost
  return group.replies.find(post => !!post.skyshareEntry) ?? null
}
```

- 通常機能（[specs/entry/frontend/design.md §3.2](../entry/frontend/design.md#32-送信内容の決定fr-2-fr-3対応)）では、entryは常にスレッド先頭（`rootPost`）に紐づくため、実務上`findEntryCarrier`が返すのは常に`group.rootPost`である。事後entry作成（5節）によって中間投稿から発行された場合も、`source`（＝entryが実際に紐づくBluesky投稿）はスレッド先頭になるため、`GET /v2/entries`の`groupTimelineEntriesBySourceUri`によるentry紐付け（`source.uri`一致）は`rootPost`に対して行われる。中間投稿自体に`skyshareEntry`が付与されることは無い。
- `findEntryCarrier`が非nullを返す場合、`ThreadCard`は`rootPost`の`PostCard`に`threadBadge={true}`を渡し、バッジ（例: 「スレッド」ラベル）を表示する。

## 7. Timelineコンポーネント本体の変更点

- [src/components/post/Timeline/index.tsx](../../src/components/post/Timeline/index.tsx)の`ComponentList`に渡す`items`を、`groupIntoThreads(items)`の結果（`ThreadGroup[]`）に変更する。
- `getItemKey`を`item => item.id`（`ThreadGroup.id`）に変更する。
- `itemComponent`を`ThreadCard`に差し替える。
- `getItemProps`は、`onPostDeleted`をグループ内のどの投稿のuriにもマッチしうるよう、`ThreadGroup`単位のコールバックへ変更する（`ThreadCard`内部で個別の`item.uri`へ委譲する）。

## 8. リンク・スレッド全体削除（FR-5対応）

`specs/entry/frontend/design.md §3.4`が定めるEntry削除確認ダイアログ（`EntryDeleteConfirmDialog`、「Skyshareリンクを削除」「リンク・Bluesky投稿を削除」「リンク・スレッド全体を削除」の3〜4択）は、`EntryCard`（entry一覧）で既に実装済みである。本節では、`PostCard`（Timeline一覧）にも同じ削除選択肢を追加する設計を定める。`PostCard`は既に`EntryDeleteConfirmDialog`を使って「リンクを削除」「投稿を削除」の2択を提示しているため、変更は「スレッド全体を削除」選択肢の追加のみである。

### 8.1 判定ロジックの共有化

`EntryCard`の`resolveThreadDeleteOption`（sourceUriを起点に`getPostThread`でreply chainを取得し、entry所有者自身の後続投稿が実在するかを判定する）は、entry固有のロジックではなく`sourceUri: string`のみを入力に取る純粋な判定関数であるため、`src/components/entry/EntryCard/resolveThreadDeleteOption.ts`から`src/lib/entry/resolveThreadDeleteOption.ts`へ移設し、`EntryCard`・`PostCard`の双方から共有利用する。

### 8.2 `useSkyshareEntryStatus`の拡張

- 戻り値に`isResolvingThreadOption: boolean`（判定中フラグ）・`showThreadOption: boolean`（「リンク・スレッド全体を削除」選択肢の表示要否）を追加する。
- `requestDeleteEntry`を同期関数から非同期処理を内包する関数に変更する。呼び出し時、`resolveThreadDeleteOption(entry.sourceUri)`の結果を待ってから`showThreadOption`を確定し、その後`isDeleteDialogOpen`をtrueにする（`EntryCard`の`openDeleteDialog`と同じ方針）。判定中は`isResolvingThreadOptionRef`で多重実行を防ぐ。
- `confirmDeleteEntry`の第2引数に`deleteBskyThread?: boolean`を追加し、`deleteEntry` API呼び出しへそのまま渡す。
- `options.onPostDeleted`のシグネチャを`(deletedThread?: boolean) => void`に変更する。`deleteBskyPost`成功時（`deleteBskyThread`の有無を問わず）呼び出し、`deleteBskyThread`の値をそのまま引数に伝搬する。

### 8.3 `PostCard`の変更

- `useSkyshareEntryStatus`から追加で受け取った`isResolvingThreadOption`・`showThreadOption`を、既存の`display.kind === "deleting"`時と同様の`Loading overlay`表示、および`EntryDeleteConfirmDialog`の`showThreadOption`/`onDeleteThread={() => confirmDeleteEntry(true, true)}`propへそれぞれ渡す。
- `PostCardEntryActions`の`disabled`propに`isResolvingThreadOption`を追加し（`guestMode || isResolvingThreadOption`）、判定中の連打を防ぐ。
- `PostCardProps.onPostDeleted`のシグネチャを`(deletedThread?: boolean) => void`に変更し、`useSkyshareEntryStatus`の`onPostDeleted`へそのまま渡す。

### 8.4 `ThreadCard`側の一覧除去範囲の拡張

- `ThreadCard`が`PostCard`へ渡す`onPostDeleted`コールバックを、`deletedThread`引数を受け取れる形に変更する。
- `deletedThread`が`true`の場合、`Timeline`から渡された`onPostDeleted`（`ComponentList.removeItem`相当の述語ベースコールバック）へ、`group.rootPost`と`group.replies`の全uriにマッチする述語（`matchesGroup`）を渡す。`false`／未指定の場合は従来通り、削除対象となった投稿自身のuriのみにマッチする述語を渡す。
- entryは常に`group.rootPost`（source）にのみ紐づく（design.md §6.1）ため、実務上`deletedThread=true`は`group.rootPost`の`PostCard`からのみ発生しうる。`group.replies`側の`PostCard`はentryを持たないため削除ボタン自体が表示されず、この分岐に到達しない。
- 削除対象の導出は、フロントエンドが保持する`ThreadGroup`（クライアント側グルーピング結果）の範囲に閉じる。バックエンド（`DELETE /v2/entry`の`deleteBskyThread`実装、`specs/entry/backend/design.md §7.4`）が実際に削除する後続投稿の集合と、クライアント側の`ThreadGroup.replies`は、いずれも`extractOwnedLinearReplyChain`を用いた同一ロジックで導出されるため、除去範囲は一致する。
