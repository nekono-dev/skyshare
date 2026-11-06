# Brief: atproto-records

## Problem

投稿・threadgate・postgate・embed・facet・下書き・Entry のレコードは、Bluesky の仕様の形で作る必要がある。組み立てが各機能に散ると、同じレコードの形が違う箇所が生まれる。

## Current State

- 使われる NSID（コード内の文字列より）: `app.bsky.feed.post`（14 箇所）、`app.bsky.feed.threadgate`（6）、`app.bsky.feed.postgate`（5）、`dev.nekono.skyshare.entry`（4）、`app.bsky.embed.images`・`app.bsky.embed.video`・`app.bsky.embed.external`・`app.bsky.embed.gallery`・`app.bsky.embed.recordWithMedia`、`app.bsky.richtext.facet`、`com.atproto.repo.uploadBlob`、`com.atproto.repo.putRecord`、`dev.nekono.skyshare.defs`。
- `src/lib/atproto/post.ts`: 投稿レコードの値（`buildBskyPostRecord`）。`embed.ts`: 画像・外部リンクの埋め込み。`richtext.ts`・`facet.ts`: リンクと facet の抽出。`gate.ts`: threadgate・postgate（`PostGateValue` を平坦化）。
- `src/lib/atproto/draft.ts`: 下書きの検証と変換（`app.bsky.draft`）。
- `src/lib/atproto/nsid.ts`・`did.ts`（PDS の解決）・`blob.ts`・`repo.ts`・`agentFactory.ts`・`publicAgent.ts`・`profile.ts`。
- `src/lib/atproto/threadChain.ts`: 投稿者自身の投稿を直線的に辿る規則（`extractOwnedLinearReplyChain`）。Entry の詳細・削除・タイムラインが使う。
- `src/lib/atproto/suggest.ts`・`lists.ts`: 認証なしの公開 AppView の候補（メンション・トレンド・リスト）。
- `src/lib/atproto/threadLimit.ts`: スレッドの上限（依存のない定数）。
- `src/lib/atproto/richtext.ts`・`embed.ts`・`facet.ts` は `@/lib/api/schema/common` を**型として**読む（`api-contract` への依存）。

## Desired Outcome

- 各レコードの形（NSID・必須の項目・任意の項目）と、組み立ての規則が記録されている。
- threadgate と postgate の値の変換規則（`PostGateValue` → レコード）が記録されている。
- 直線的なスレッドの抽出規則と、その利用箇所が記録されている。

## Approach

レコードの形と、読み書きの共通部品を所有する。レコードを書く処理（原子的な書き込み）は、利用する機能の spec が所有する。

## Scope

- **In**: レコードの組み立て、embed と facet、threadgate・postgate、下書きの変換、DID・PDS・blob・agent の共通部品、公開 AppView の候補、スレッドの抽出、スレッドの上限。
- **Out**: 書き込みの流れ（post-composition・entry-sharing・scheduled-posting）、ログイン（session-accounts）、動画のサービス認証（media-attachments）。

## Boundary Candidates

- 投稿レコードと埋め込み（post.ts・embed.ts・facet.ts・richtext.ts）
- 返信と引用の制限（gate.ts）
- 下書き（draft.ts）
- 解決と読み取りの部品（did.ts・blob.ts・repo.ts・agentFactory.ts・publicAgent.ts・profile.ts・nsid.ts）
- スレッドの抽出と上限（threadChain.ts・threadLimit.ts）
- 公開の候補（suggest.ts・lists.ts）

## Out of Boundary

- 書き込みの流れ、ログイン、動画の認証

## Upstream / Downstream

- **Upstream**: api-contract（共通の型）。
- **Downstream**: session-accounts、media-attachments、entry-sharing、post-composition、timeline-browsing、scheduled-posting。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: post-composition（書き込み）、entry-sharing（Entry のレコード）。

## Constraints

- Cron の経路から使う部品（`executor.ts` が読む `post.ts`・`gate.ts`・`embed.ts`）は副作用のない純粋関数だけを使う（`executor.ts` の header の規則を、実装で確認すること）。
- 既知の不一致: `threadChain.ts` の説明に旧 spec 名の参照がある（根拠にしない）。
