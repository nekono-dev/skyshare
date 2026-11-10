# Brief: entry-sharing

## Problem

Bluesky の投稿を、見出し・画像・投稿群をまとめた公開ページ（Skyshare Entry）として扱う。Entry は Bluesky の投稿と連動するため、作成・更新・削除で二つの間の整合を保つ必要がある。

## Current State

- Entry のレコードは `dev.nekono.skyshare.entry`（NSID）。組み立ては `src/lib/entry/skyshareRecord.ts`（`buildSkyshareEntryRecord`）。
- 作成（投稿から）: `POST /v2/entry` の `uri` 指定は `src/lib/entry/fromPost.ts` が担う。投稿と同時の作成（`createEntry`）は post-composition の書き込み（`createBskyThread.ts`）の中で行われる。
- 更新: `PUT /v2/entry`（`EntryEditForm` が使う）。削除: `DELETE /v2/entry`。削除の範囲は `resolveEntryDeleteScope.ts`（画面の判定）と `resolveDeleteTargets.ts`（API の対象導出）。対象は `lib/atproto/threadChain.ts` の直線的な抽出で決める。
- 一覧: `GET /v2/entries/skyshare`（`src/pages/v2/entries/skyshare.ts`）。全件を返し、元の投稿が無いものを `orphaned` とする。画面は `src/pages/entries/index.astro`・`components/entry/EntryList`・`EntryCard`。
- 詳細: `src/pages/entries/[slug].astro`（PDS から実レコードを SSR で取得）。`entryPageCache.ts` が Cache API で再利用し、`ENTRY_PAGE_CACHE_TTL_SECONDS` を持つ。表示の部品は `EntryDetailView`。
- 画像: `createPostVisual.ts`（既存投稿の画像・動画から 1200×630 の visual を作る。動画は再生時間を見出しに使う）。`VISUAL_IMAGE_COUNT` 枚まで。
- OGP の事前取得: `warmOgpCache.ts`（作成直後に OGP 抽出サービスを温める。失敗しても作成を止めない）。
- 削除の確認: `DeletePostListDialog`・`DeletePostListItem`・`EntryDeleteConfirmDialog`。
- 投稿カード上の操作: `components/entry/PostCardEntryActions/` と `useSkyshareEntryStatus.ts`（状態を一つの state にまとめる）。

## Desired Outcome

- Entry の作成（投稿から・投稿と同時）、更新、削除の規則と、Bluesky 側との連動が記録されている。
- 削除の範囲（Entry のみ・投稿とスレッドも含む）の判定規則が記録されている。
- 一覧の `orphaned` と詳細ページの表示規則が記録されている。

## Approach

Entry のレコードと、その作成・更新・削除の規則を所有する。投稿と同時の作成の書き込みは post-composition が所有する。

## Scope

- **In**: `POST`（投稿から）・`PUT`・`DELETE /v2/entry` の Entry の部分、`GET /v2/entries/skyshare`、一覧・編集・削除の画面、詳細ページ、Entry の画像、OGP の事前取得。
- **Out**: 投稿の書き込みの本体（post-composition）、タイムラインの表示（timeline-browsing）、他 SNS への共有（external-sharing）。

## Boundary Candidates

- Entry のレコードと作成・更新・削除（skyshareRecord.ts・fromPost.ts・resolveDeleteTargets.ts・resolveEntryDeleteScope.ts・entryText.ts）
- Entry の画像とページ（createPostVisual.ts・entryPageCache.ts・warmOgpCache.ts・pages/entries・EntryDetailView）
- Entry の一覧と操作（v2/entries/skyshare.ts・EntryList・EntryCard・EntryEditForm・削除ダイアログ）
- 投稿の表示の抽出（postEmbedView.ts・url.ts・estimateEntryUrl.ts）

## Out of Boundary

- 投稿の書き込み、タイムライン、他 SNS への共有

## Upstream / Downstream

- **Upstream**: media-attachments（動画の情報と画像）、atproto-records（レコードとスレッドの抽出）、session-accounts、api-contract、i18n、ui-primitives。
- **Downstream**: post-composition（`createEntry`）、external-sharing（Entry の URL と画像）、timeline-browsing（Entry の状態）、scheduled-posting（予約の実行で Entry を作る）。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: post-composition、timeline-browsing（PostCard の Entry 操作）。

## Constraints

- Entry の作成と削除は Bluesky 側の投稿と一緒に扱う。片方だけを残す失敗の扱いを記録する。
- 詳細ページは公開データだけで構成する。
- 既知の不一致: `src/lib/atproto/threadChain.ts` などの説明に旧 spec 名がある（根拠にしない）。

## 確定した判断（2026-11-03）

- `/entries/sample`（`src/pages/entries/sample.astro`）は v2 のリリース後に削除する。現時点では残す（ゲストモードの「Entry を開く」の遷移先のため）。
- `/samples/choice-question` は削除済みで、これとは別の判断。
