# Brief: timeline-browsing

## Problem

利用者は自分の投稿を一覧で見る。Bluesky の AppView はスレッドの一部を欠落させることがあるため、タイムラインは欠けた投稿を補い、スレッドをまとめる必要がある。投稿の表示と操作の境界も曖昧になりやすい。

## Current State

- ページ: `src/pages/index.astro`。`src/components/timeline/Timeline/index.tsx` が一覧の取得（`GET /v2/entries`）と投稿ランチャーを持つ。「タイムラインを表示しない」が ON なら一覧を省き、投稿フォームだけを出す。
- API: `src/pages/v2/entries.ts`。`app.bsky.feed.getAuthorFeed` の結果に Entry を突き合わせ、`src/lib/timeline/timelineThreads.ts` でスレッドにまとめる。欠けた投稿は `getPostThread` で取り直す。表示対象は「自分起点」のスレッドの本線（`threadChain.ts`）だけ。
- 表示の部品: `components/timeline/PostCard/`（カードの本体と操作）、`PostBody/`・`PostRichText/`・`PostQuote/`・`PostLinkCard/`・`PostEngagementStats/`・`ThreadCard/`。
- 一覧の整形: `src/lib/timeline/posts.ts`（画像 URL を CDN の URL に展開し、Entry を `source.uri` で結ぶ）。
- ページング: 無限スクロール（`ComponentList`・`InfiniteScrollSentinel`）。ページ送りの方式は廃止されている（`timelineSettings.ts` の注記）。
- ゲスト: `?guest` のとき未ログインでもダミーの投稿を出す（`src/lib/timeline/guestDummyPosts.ts`、`src/lib/guestMode.ts`）。未ログインでゲストでなければ、ログイン画面へ移す。
- 投稿カードの操作: Entry の操作は entry-sharing、Web Share は external-sharing が所有する。

## Desired Outcome

- 一覧の取得規則（どの投稿を、どの順で、どうまとめるか）が記録されている。
- 欠落の補い方（再取得の条件）と、表示対象の限定規則が記録されている。
- 投稿カードの表示項目と、各操作の所有 spec への参照が記録されている。
- ゲスト表示の条件が記録されている。

## Approach

一覧の取得・まとめ・表示を所有する。Entry の操作、共有、投稿の作成は、それぞれの spec が所有する。

## Scope

- **In**: タイムラインの一覧と API、スレッドのまとめ、欠落の補い、無限スクロール、投稿カードと投稿本文の表示、ゲスト表示、表示の切替。
- **Out**: Entry の操作（entry-sharing）、共有（external-sharing）、投稿の作成（post-composition）、AppView の仕様。

## Boundary Candidates

- 一覧の API とまとめ（v2/entries.ts・timelineThreads.ts・posts.ts）
- 一覧の画面（Timeline・index.astro）
- 投稿の表示（PostCard・PostBody・PostRichText・PostQuote・PostLinkCard・PostEngagementStats・ThreadCard）
- ゲスト表示（guestDummyPosts.ts）

## Out of Boundary

- Entry の操作、共有、投稿の作成、AppView の仕様

## Upstream / Downstream

- **Upstream**: session-accounts、api-contract、settings、media-attachments（画像・動画の表示）、entry-sharing、external-sharing、atproto-records、i18n、ui-primitives、platform-runtime。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: entry-sharing（PostCard の Entry 操作）、external-sharing（PostCard の Web Share）、post-composition（投稿後の再取得）。

## Constraints

- 一覧は認証済みの利用者の投稿だけを返す。未ログインはゲスト表示かログイン画面への移動になる。
- AppView の欠落は、利用者に見えるスレッドの欠け方で検証する。
- 既知の不一致: `components/timeline/Timeline/index.tsx` の説明に、ページ送りに関する旧記述が残る可能性がある（design で確認）。
