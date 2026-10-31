# Brief: src-composer-layout

## Problem

`components/composer/ThreadComposer/` は、直下に 12 ファイルがあり、フック（`useDraftFlow.ts` など 6 件）と判断の `.ts`（`segments.ts` など 4 件。区切り・提出の組み立て・共有先の振り分け・候補の計算）と配線（`index.tsx`）が混ざっている。部品の子フォルダは 4 つ（`ComposerOptions`・`ComposerDialogs`・`PostBodyEditor`・`ThreadSegmentForm`）あり、いずれも 2 ファイル（`index.tsx` と CSS）しか持たない。読む人は、どれがフックでどれが判断かを、ファイル名から判断しにくい。部品フォルダの数も増えて、見通しが悪い。

## Current State（2026-11-01 の実測）

- 直下: `index.tsx`・`index.module.css`・`useDraftFlow.ts`・`useScheduleFlow.ts`・`useScheduleEdit.ts`・`useThreadSubmit.ts`（フック 4 件）、`useSuggest.ts`・`useKeyboardRows.ts`（フック 2 件）、`segments.ts`・`submitThread.ts`・`shareDispatch.ts`・`suggestHashtags.ts`（判断 4 件）。
- 子フォルダ: `ComposerOptions/`・`ComposerDialogs/`・`PostBodyEditor/`・`ThreadSegmentForm/`。それぞれ `index.tsx` と `index.module.css`。
- steering（`structure.md` 42 行目）: 「部品の判断は同じフォルダの `camelCase.ts` に置く（例: `ThreadComposer/segments.ts`）。フックは `useX.ts`」。この規約のままでは、フックと判断を子フォルダに置けない。

## Desired Outcome

- `ThreadComposer/` の直下は、配線（`index.tsx` と CSS）と、子フォルダの 3 つ程度だけになる。判断の子フォルダ名は `rules`（`judgement` などの技術用語は使わない）。
- フックは `hooks/` に、判断の `.ts` は `rules/` にまとまる。
- 部品の子フォルダ（`ComposerOptions`・`ComposerDialogs`・`PostBodyEditor`・`ThreadSegmentForm`）は、1 部品 1 フォルダの規約を保つ。
- steering の規約は、この構成を説明できるように改訂される（子フォルダ `hooks/`・`rules/` の規則）。

## Approach（利用者が選択: 案 C）

- 部品は保つ。フック（6 件）を `ThreadComposer/hooks/` に、判断の `.ts`（4 件）を `ThreadComposer/rules/` に移す。
- 移動に伴い、import の書き換え（`index.tsx`・部品・テスト）と、構造の検査（`tests/unit/scripts/composerSplit.test.ts`）のパスを更新する。
- steering の規約を、この構成に合わせて改訂する（同じ変更で行う）。

## Scope

- **In**: `ThreadComposer/` 内の `hooks/`・`rules/` への移動、import と構造の検査の更新、`structure.md` の部品の規約の改訂（`ThreadComposer` の子フォルダの規則）。
- **Out**: 他の composer の部品（`PostLauncher`・`PostPage`・`SuggestPopover` など）の配置、`ThreadSegmentForm` と `PostBodyEditor` の内部、画面の振る舞いと判断の仕様、リポジトリ全体の部品フォルダの原則（`src-folder-layout` が扱う）。

## Boundary Candidates

- フックの置き場所（`hooks/`）
- 判断の置き場所（`rules/`）。フォルダ名は、技術用語を避けて `rules` とする（利用者の選択）
- steering の部品の規約（ThreadComposer の子フォルダの規則）

## Out of Boundary

- 全体への適用（`src-folder-layout` の論点として残す）
- 振る舞いの変更（表示・操作・提出の結果）

## Upstream / Downstream

- **Upstream**: `src-composer-split`（実装完了。フックと判断の分割を前提にする）
- **Downstream**: `src-folder-layout`（この構成の規約を、部品フォルダ全体へ広げるかを判断する）

## Existing Spec Touchpoints

- **Extends**: `src-composer-split`（ThreadComposer の内部構造の続き）
- **Adjacent**: `src-folder-layout`（部品フォルダ全体の規約）、`src-import-style`（import の表記）

## Constraints

- 振る舞いを変えない。`npm run test:all` の件数（unit 257・component 13・route 200・render 2・e2e 7）を下回らない。
- 既存のテストファイルの期待値は変えない（import パスの変更だけ）。
- 規約の変更は、steering の改訂と同じ変更で行う（`structure.md` の「規則の変更」の節）。
