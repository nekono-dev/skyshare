# タイムライン 設計書

## 1. 構成

| パス                                                     | 責務                               |
| -------------------------------------------------------- | ---------------------------------- |
| `src/components/post/Timeline/index.tsx`                 | 一覧の取得とスレッドグループの並び |
| `src/components/post/ThreadCard/index.tsx`               | 1グループの折りたたみと展開        |
| `src/components/post/ThreadCard/entryCandidate.ts`       | 代表画像の素材の投稿の決定         |
| `src/components/post/PostCard/index.tsx`                 | 1投稿のカード                      |
| `src/components/post/PostCard/useSkyshareEntryStatus.ts` | entryの作成・削除の状態            |
| `src/lib/entry/guestDummyPosts.ts`                       | ゲスト表示のスレッドグループ       |

## 2. 関係図・ワークフロー

タイムライン表示の依存方向を示す。

```mermaid
flowchart LR
  ti["Timeline/index"] --> tci["ThreadCard/index"]
  ti --> guestDummyPosts
  tci --> entryCandidate
  tci --> pci["PostCard/index"]
  pci --> useSkyshareEntryStatus
```

グループの描画と、削除後に一覧を更新する流れを示す。

```mermaid
sequenceDiagram
  participant tci as ThreadCard/index
  participant entryCandidate
  participant pci as PostCard/index
  participant useSkyshareEntryStatus
  tci->>entryCandidate: resolveEntryVisualSourcePost
  alt 素材の投稿あり
    tci->>pci: 起点にentry作成ボタン
  else 素材なし
    tci->>pci: ボタンなし
  end
  pci->>useSkyshareEntryStatus: 作成と削除の状態
  alt 投稿ごと削除に成功
    useSkyshareEntryStatus-->>tci: onPostDeleted
  else entryのみ削除
    useSkyshareEntryStatus-->>pci: 表示を取り除く
  end
```

## 3. 設計項目

### D-1: 一覧とグループの表示 (FR-1, FR-2, FR-3, FR-8, FR-9, NFR-1)

```tsx
<ComponentList
  itemComponent={ThreadCard}
  getItemKey={thread => thread.rootPost.uri}
  getItemProps={thread => ({
    group: thread,
    onPostDeleted: removeItem,
    guestMode,
  })}
  items={items} // ThreadGroup[]。クライアントでは返信の連鎖を組み立て直さない
/>
```

| 要素                   | 表示                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `replies.length === 0` | 起点の `PostCard` だけを描画する                                                                       |
| 折りたたみボタン       | 「スレッドを展開（N件）」と「折りたたむ」。`Collapsible` と同じCSSの矢印を左に付け、開くと上向きにする |
| 返信                   | `reply-list` で囲み左マージンで段を作る。`PostCard` の `muted` にグループ単位の判定を渡す              |
| entryを開く            | フッターの `entry-link-box` に置き、container query で残り幅が4.5rem未満なら非表示にする               |

ゲスト表示では `GUEST_DUMMY_THREADS` を返す。

### D-2: 後からのentryの作成 (FR-4, FR-5, FR-6, FR-7)

```ts
export const resolveEntryVisualSourcePost = (
  group: ThreadGroup,
): TimelinePost | null => {
  if (group.replies.length === 0) return null
  if (hasEntryMedia(group.rootPost)) return group.rootPost // 画像か利用できる動画を持つ
  return group.replies.find(hasEntryMedia) ?? null
}
// ThreadCard → 起点の PostCard
//   postCreateEntryButton={!!visual} entryVisualSourcePost={visual} entrySourcePost={group.rootPost}
// 返信の PostCard は hideToolbar（下部のツールバーごと表示しない。操作は起点に対して行うため）
// useSkyshareEntryStatus: visualSource = visualSourcePost ?? item（画像取得と createDefaultThumbnail）
//                         source = sourcePost ?? item（API に送る uri）
```

entryの有無は `useSkyshareEntryStatus` の `display` だけで判定する。`group` の `skyshareEntry` は削除後に更新されず、ボタンが復帰しなくなるため参照しない。単独の投稿は `sourcePost` を渡さず、投稿自身を派生元にする。

### D-3: 削除の後の一覧 (FR-10)

```tsx
// ThreadCard は起点と返信のどちらの PostCard にも同じコールバックを渡す
<PostCard
  onPostDeleted={() =>
    onPostDeleted(g => g.rootPost.uri === group.rootPost.uri)
  }
/>
```

`useSkyshareEntryStatus` は、`deleteBskyPost: true` の削除が成功したときだけ `onPostDeleted` を呼ぶ。entryだけの削除ではカードのentryの表示だけを取り除く。

### D-4: グループ単位のコントラスト (FR-8, FR-11)

```ts
// ThreadCard: グループのどの投稿も素材とentryを持たないとき、グループ全体をグレーアウトする
const threadMuted =
  resolveEntryVisualSourcePost(group) === null &&
  findEntryCarrier(group) === null
// 起点の PostCard は自身の display（ineligible）で判定し、返信には muted={threadMuted} を渡す
// PostCard: muted 未指定なら display.kind === "ineligible" で判定する
```

`card-muted` は文字を控えめな色にし、ボタン内を含む画像・アイコンの不透明度と彩度を下げ、本文のリンクの色を文字と同じにする。

### D-5: 後続の投稿のツールバー (FR-12)

```tsx
// ThreadCard: 後続の PostCard にはツールバーを出さない
<PostCard item={reply} hideToolbar muted={threadMuted} />
```

`PostCard` は `hideToolbar` が真のとき、下部のツールバー全体（Blueskyで開く・共有・Entry関連の操作・entryを開くリンク）を描画しない。操作は起点の投稿に対して行う。

## 4. エラー処理

| 事象                   | 処理                                                    |
| ---------------------- | ------------------------------------------------------- |
| 一覧の取得の失敗       | 一覧の読み込み失敗の文言を表示する                      |
| 素材の画像の取得の失敗 | entryの作成の失敗を表示し、ボタンを再度押せる状態に戻す |
