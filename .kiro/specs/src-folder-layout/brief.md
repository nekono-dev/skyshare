# Brief: src-folder-layout

## Problem

部品フォルダの外に置かれたファイルがあり、どこに何があるかを読む人が推測しなければならない。また、利用されていないサンプル画面とデッドコードが本番のソースに残っている。`guestDummyPosts.ts` は、データと判断が 1 ファイルに混ざっている。

## Current State（2026-11-01 の実測。訂正を反映）

- **部品フォルダ外のファイル 10 件**（規約違反）:
  - 領域の直下: `share/useWebShareCrosspost.ts`、`help/helpEntries.tsx`、`privacy/PolicyCards.tsx`
  - layout: `layout/AnalyticsTag.astro`（render テストが直接 import）、`layout/Metadatas.astro`、`layout/nav/NavIcon.astro`、`layout/nav/` の `.ts` 4 件（`navItems`・`syncAccountAvatar`・`syncActiveState`・`syncGuestModeQuery`）
- **規約どおりのファイル**: 部品フォルダ内の `camelCase.ts` 9 件（`ThreadComposer/*.ts` など）と、単一ファイルの部品フォルダ 15 件は違反ではない。
- **サンプル画面**: `pages/samples/choice-question.astro` と `components/common/ChoiceQuestionSample/`。参照元は、このページだけ。`common/README.md` の参照先 `docs/features/choice-question` は存在しない。
- **デッドコード**: `components/common/PaginationModeSelect/` は、自身と README・`dead.md` 以外から参照されていない。`components/dead.md` はこの部品を記録したメモ。
- **`lib/timeline/guestDummyPosts.ts`（790 行）**: ダミーのデータ（投稿・Entry・動画）と、判断の関数（`resolveGuestDeleteScope`）が同居している。`Timeline`・`EntryList`・`EntryCard`・`useSkyshareEntryStatus` の 4 部品が使う。
- **ステアリングの領域**: `lib/` の `account`・`codegen`・`image`・`privacy`・`site`・`video` と `lib/guestMode.ts` が `structure.md` に記載されていない。
- **古いコメント**: `pages/entries/sample.astro` と `pages/samples/choice-question.astro` のコメントが指す e2e（`entryThreadDetail.spec.ts` など）は存在しない。

## Desired Outcome

- `components/` の部品フォルダ外のファイルが 0 件になる。
- サンプル画面と `ChoiceQuestionSample` が消え、`common/README.md` の参照が消える。
- `PaginationModeSelect` と `dead.md` が消え、`timelineSettings.ts` の `PaginationMode` 型の扱いが整理される。
- `guestDummyPosts.ts` のデータは `lib/timeline/guest/` に、判断の関数は `lib/guestMode.ts` にある。
- `structure.md` の領域一覧が、実装の領域と一致する。

## Approach（決定済み）

- **部品フォルダ外の 10 件**: 所有する部品のフォルダへ移す。`layout/nav/` は部品フォルダにまとめる（移動先の部品は design で確定する）。
- **サンプル画面**: `pages/samples/choice-question.astro` と `ChoiceQuestionSample` を削除する。`pages/entries/sample.astro` は残す（ゲストモードの「Entryを開く」の遷移先）。コメントは実態に合わせて直す。
- **デッドコード**: `PaginationModeSelect` と `components/dead.md` を削除する。`Timeline` の `paginationMode` の固定値（`"infinite" as PaginationMode`）は、型を含めて整理する。経緯は git 履歴に任せる。
- **`guestDummyPosts.ts`**: ダミーのデータを `lib/timeline/guest/` へ移す。判断の関数（`resolveGuestDeleteScope` など）は既存の `lib/guestMode.ts` へ移す。4 部品の import を付け替える。
- **steering**: 領域の一覧に不足を登録する（steering を正とする方針）。

## Scope

- **In**: 部品フォルダ外の 10 件の移動、サンプル画面と `ChoiceQuestionSample` の削除、`PaginationModeSelect` と `dead.md` の削除、`guestDummyPosts.ts` の分割、`structure.md` の領域一覧の更新、古いコメントの修正。
- **Out**: 部品の振る舞い（表示・操作）、ゲストモードの振る舞い、`lib` の業務の判断、import の表記（`src-import-style`）。

## Boundary Candidates

- 部品フォルダの規約（`components/` の配置）
- サンプル画面とデッドコードの削除
- ゲストのダミーデータと判断の分割
- steering の領域一覧

## Out of Boundary

- 画面の内容と振る舞い（各機能の spec）
- import の表記（`src-import-style`）
- 運用ツールの配置（Phase 2 の `ops-tooling-layout`）
- `ComponentList`（汎用のリスト部品。分割の要否は `src-composer-split` か本 spec の design で決める）

## Upstream / Downstream

- **Upstream**: `src-composer-split`（`ThreadComposer` の分割後に規約を当てる）、`src-duplicates`（共有の配置が決まってから）
- **Downstream**: `src-import-style`

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `ui-primitives`（共通部品の配置）、`timeline-browsing`（`PostCard`・`ThreadCard`・`guestDummyPosts`）、`help-privacy`（`helpEntries`・`PolicyCards`）、`settings`（`timelineSettings.ts` の型）、`platform-runtime`（ゲストモード）、`entry-sharing`（`EntryCard` と `entries/sample.astro`）

## Constraints

- 利用者に見える変化を作らない。サンプル画面の削除は、本番の URL（`/samples/choice-question`）が 404 になる変化を伴うため、削除の前に利用者の了承を得た決定として扱う（決定済み: 2026-11-01）。
- ゲストモードの「Entryを開く」は `entries/sample.astro` に遷移し続けること（e2e の `entry.spec.ts` などで確かめる）。
- 検証の基準 272 件が全通過すること。
- 移動のたびに `src-import-rules` の許容リストから該当項目を減らす。
