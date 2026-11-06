# Brief: post-composition

## Problem

利用者は Bluesky に投稿を作る。単発だけでなくスレッド（複数投稿）も作り、本文の文字数、画像・動画、返信と引用の制限、自己ラベル、言語、下書き、候補を扱う。入力の検証と送信の規則が画面と API でずれると、途中で失敗した投稿が残る。

## Current State

- ページ: `src/pages/post.astro`（`components/composer/PostPage`）。ダイアログ版は `PostLauncher`。どちらも `ThreadComposer` を使う。
- 入力: `ThreadComposer/index.tsx`（セグメント配列と編集中の位置）、`segments.ts`（追加・削除の純粋関数。先頭は削除できない）、`ThreadSegmentForm`（本文・画像・リンクカード・返信/引用・自己ラベル・言語）。`useKeyboardRows.ts`・`useSuggest.ts`。
- 本文エディタ: `src/util/textarea/`（contentEditable のモデルと再構成、facet のハイライト、候補の起動の判定）と `ThreadComposer/PostBodyEditor/`。
- 候補: `ThreadComposer/suggestHashtags.ts`（トレンドと自分の履歴の結合）、`src/lib/atproto/suggest.ts`、`SuggestPopover`。
- 送信: `ThreadComposer/submitThread.ts` が `POST /v2/entry` に `posts[]` を送る。書き込みの本体は `src/lib/entry/createBskyThread.ts`（`applyWrites` による原子的な作成。投稿・threadgate・postgate・Entry を 1 回で作る）。
- スレッドの上限: `MAX_THREAD_POST_COUNT`（`src/lib/atproto/threadLimit.ts`）。
- 返信と引用の制限: `components/composer/PostGateDialog/`・`src/lib/atproto/gate.ts`。
- 下書き: `src/pages/v2/bsky/drafts.ts`（`GET`・`PUT`・`DELETE`・`POST`）、`src/lib/atproto/draft.ts`、`src/lib/draft/draftList.ts`、`components/composer/DraftListPanel/`、`DraftSaveConfirmDialog`。
- 文字数: `src/util/textCount.ts`・`utf8Bytes.ts`。言語: `src/lib/atproto/languageFlag.ts`、`util/emoji/countryFlag.ts`。自己ラベル: `SelfLabelsSelect`。
- リンクカード: `components/image/OgpFetchButton/`・`OgpPreview/`（OGP 抽出サービスの呼び出し）。
- 投稿後の分岐は external-sharing（`shareDispatch.ts`）を呼ぶ。

## Desired Outcome

- 投稿の入力項目、検証規則（文字数・枚数・長さ・件数）、送信の結果（全件成功か全件失敗か）が記録されている。
- 返信・引用の制限の組み合わせと、レコードへの変換の規則が記録されている。
- 下書きの保存・読み込み・削除の規則と、送信後の扱いが記録されている。
- 候補（メンション・ハッシュタグ）の取得元と、候補を出す条件が記録されている。

## Approach

投稿フォームの状態・検証・送信の規則を所有する。レコードの形は atproto-records、添付メディアの処理は media-attachments、Entry の作成の規則は entry-sharing、投稿後の共有は external-sharing、予約は scheduled-posting が所有する。

## Scope

- **In**: 投稿フォーム（単発・スレッド）、本文と候補、返信・引用の制限、自己ラベル、言語、下書き、リンクカードの取得、投稿の送信（`/v2/entry` の `posts[]`）、文字数、確認ダイアログ。
- **Out**: 画像・動画の加工、Entry の作成の規則、投稿後の共有、予約、タイムライン、レコードの形。

## Boundary Candidates

- フォームの状態（ThreadComposer・segments.ts・ThreadSegmentForm・PostLauncher・PostPage）
- 本文と候補（util/textarea/・PostBodyEditor・useSuggest・SuggestPopover・suggestHashtags.ts）
- 制限と下書き（PostGateDialog・draft の API と一覧）
- 送信（submitThread.ts・createBskyThread.ts の書き込み部分）

## Out of Boundary

- 添付メディアの加工、Entry の規則、投稿後の共有、予約、タイムライン

## Upstream / Downstream

- **Upstream**: entry-sharing、external-sharing、media-attachments、atproto-records、settings、session-accounts、api-contract、i18n、ui-primitives、platform-runtime。
- **Downstream**: scheduled-posting（フォームの状態と送信の契約を拡張する）、timeline-browsing（投稿の結果を再取得）。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: entry-sharing（`createEntry`）、external-sharing（投稿後の分岐）、media-attachments（添付）。

## Constraints

- 送信は全件成功か全件失敗かのどちらかにする（`createBskyThread.ts` の header と `applyWrites` の仕様に従う）。
- 既知の不一致: `createBskyThread.ts` は `entry-sharing` の関数（`skyshareRecord`）を使う。書き込みの所有をどちらに置くか、design で決める。
- 解消済み（2026-10-31）: `DraftListPanel` は `components/composer/` へ移した（下書きは投稿の機能）。
