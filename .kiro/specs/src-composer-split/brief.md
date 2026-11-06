# Brief: src-composer-split

## Problem

`components/composer/ThreadComposer/index.tsx` が 1,511 行あり、`src/` で最大の部品になっている。依存先の別の階層が 26 フォルダ、fan-out が 40 件ある。純粋な判断の `.ts`（`segments.ts` 404 行、`useSuggest.ts` 371 行、`shareDispatch.ts` 352 行）と、描画の部品（`ThreadSegmentForm/index.tsx` 688 行、`PostBodyEditor` 379 行）が同じフォルダに混在し、読む人が流れを追いにくい。

## Current State

- `ThreadComposer/index.tsx`: 1,511 行、fan-out 40、別の階層を 26 フォルダ参照（`src` 内で最大）。
- `ThreadComposer/ThreadSegmentForm/index.tsx`: 688 行、fan-out 21。
- 同じフォルダに `segments.ts`・`shareDispatch.ts`・`submitThread.ts`・`suggestHashtags.ts`・`useKeyboardRows.ts`・`useSuggest.ts` がある（部品フォルダの規約から外れている）。
- `components/composer/` の部品は 6 件（`DraftListPanel`・`DraftSaveConfirmDialog`・`PostGateDialog`・`PostLauncher`・`PostPage`・`SelfLabelsSelect`・`SuggestPopover`）。

## Desired Outcome

- `ThreadComposer/index.tsx` は、部品の組み立てと描画だけを持つ（目安として数百行以内）。
- 純粋な判断（区切り・検証・提出の組み立て・候補の計算）は、React に依存しない `.ts` として、役割ごとのファイルに分かれている。
- 部品フォルダの規約（`index.tsx` と `index.module.css`、判断は同フォルダの `camelCase.ts`）に合う。

## Approach

- 描画の部分を、役割の単位（入力行・候補・キーボード操作など）の部品に分ける。
- 純粋な判断は、役割ごとに分けて `ThreadComposer/` の同フォルダに置く（規約の範囲内）。大きくなる場合は、サブフォルダの作り方を design で決める。
- 分割のたびに、既存の component テストと route テストで振る舞いを確かめる。

## Scope

- **In**: `ThreadComposer/` の分割と判断の整理、`composer/` の他の部品の import の整理（`components/common` への依存を含む）。
- **Out**: 投稿の仕様（`post-composition` の振る舞い）、投稿の原子的な書き込み（`createBskyThread`）、共有の仕様（`external-sharing`）、予約の UI（`scheduled-posting`）、フィードバック。

## Boundary Candidates

- 投稿の入力（スレッドの区切り・本文の編集）
- 候補（ハッシュタグ・メンションの提示とキー操作）
- 提出と共有の分岐（`submitThread`・`shareDispatch`）

## Out of Boundary

- 文字数・検証の規則の変更（`post-composition`）
- Bluesky レコードの組み立て（`atproto-records`）
- 共有の仕様（`external-sharing`）

## Upstream / Downstream

- **Upstream**: `src-lib-ui-boundary`（フックの移動先が決まっている必要がある）
- **Downstream**: `src-duplicates`（共有の責務の統合）、`src-folder-layout`（部品の規約の整理）

## Existing Spec Touchpoints

- **Extends**: `post-composition`（投稿フォームの所有者。振る舞いは変えない）
- **Adjacent**: `settings`（既定値）、`external-sharing`（共有の分岐）、`scheduled-posting`（予約の UI）、`media-attachments`（画像と動画）、`survey`（回答の入口）

## Constraints

- 振る舞い（入力・候補・提出の結果）は変えない。
- 検証の基準 272 件が全通過すること。
- 分割の各段階で、component テストの import パスを更新するだけにする（テストの意味は変えない）。
