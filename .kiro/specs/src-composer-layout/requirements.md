# 要件書

## 概要

`components/composer/ThreadComposer/` の直下には、配線（`index.tsx`）、フック 6 件、判断の `.ts` 4 件が混在している。部品の子フォルダ 4 件は、それぞれ 2 ファイル（`index.tsx` と CSS）しか持たない。読む人は、直下のどのファイルがフックで、どれが判断かを、ファイル名から判断しにくい。

この spec は、フックを `hooks/`、判断の `.ts` を `rules/` にまとめ、直下を配線と子フォルダだけにする。部品は 1 部品 1 フォルダの規約のまま保つ。利用者に見える投稿フォームの振る舞いは変えない。

2026-11-01 の実測（`ThreadComposer/` の直下）:

- 配線: `index.tsx`・`index.module.css`
- フック 6 件: `useDraftFlow.ts`・`useScheduleFlow.ts`・`useScheduleEdit.ts`・`useThreadSubmit.ts`・`useSuggest.ts`・`useKeyboardRows.ts`
- 判断の `.ts` 4 件: `segments.ts`（区切り）・`submitThread.ts`（提出の組み立て）・`shareDispatch.ts`（共有先の振り分け）・`suggestHashtags.ts`（候補の計算）
- 部品の子フォルダ 4 件: `ComposerOptions/`・`ComposerDialogs/`・`PostBodyEditor/`・`ThreadSegmentForm/`（いずれも `index.tsx` と CSS の 2 ファイル）

用語:

- **フック**: React の状態と手順を持つ関数（名前が `use` で始まる）。
- **判断**: 区切りの追加・削除、提出の内容の組み立て、共有先の振り分け、候補の計算など、React に依存しない関数。
- **配線**: 部品の状態を持ち、フック・判断・部品を組み合わせる `index.tsx`。

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->

## 境界の文脈

- **対象内**: `ThreadComposer/` の中のファイルの配置（`hooks/`・`rules/` への移動）。移動に伴う import とテストのパスの更新。構造の検査（`tests/unit/scripts/composerSplit.test.ts`）の更新。`structure.md` の部品の規約のうち、子フォルダの規則の改訂。
- **対象外**: `ComposerOptions`・`ComposerDialogs`・`PostBodyEditor`・`ThreadSegmentForm` の内部。`composer/` の他の部品（`PostLauncher`・`PostPage`・`SuggestPopover` など）の配置。画面の振る舞いと判断の仕様。リポジトリ全体の部品フォルダの原則（`src-folder-layout` が扱う）。
- **隣接する期待**: `src-composer-split` で整理したフック・判断・部品の責務は変えない。`Props` と `ThreadComposerHandle` の形は変えない（参照元の `PostLauncher`・`PostPage`・`Timeline` は、変更なしで動く）。

## 要件

### 1. 直下の配置

**目的:** 開発者として、`ThreadComposer/` を開いたとき、フックと判断の場所をフォルダ名で判断したい。どこを読めばよいかを迷わないようにするため。

#### 受入基準

1. The `ThreadComposer/` shall 直下に、配線の `index.tsx` と `index.module.css` だけを、ソースのファイルとして置く。
2. The `ThreadComposer/hooks/` shall 6 件のフック（`useDraftFlow`・`useScheduleFlow`・`useScheduleEdit`・`useThreadSubmit`・`useSuggest`・`useKeyboardRows`）を置く。
3. The `ThreadComposer/rules/` shall 4 件の判断（`segments`・`submitThread`・`shareDispatch`・`suggestHashtags`）を置く。
4. The `ThreadComposer/` shall 部品の子フォルダ（`ComposerOptions`・`ComposerDialogs`・`PostBodyEditor`・`ThreadSegmentForm`）を、1 部品 1 フォルダの形（`index.tsx` と `index.module.css`）のまま保つ。

### 2. 振る舞いの不変

**目的:** 利用者として、投稿フォームの配置の整理で、投稿の操作が変わらないでほしい。今までどおり書いて投稿できるようにするため。

#### 受入基準

1. When 利用者が投稿フォームで入力・区切りの操作・提出を行ったとき, the 投稿フォーム shall 移動の前と同じ表示と結果を示す。
2. When 利用者が予約・下書き・共有の操作を行ったとき, the 投稿フォーム shall 移動の前と同じ操作の結果を示す。

### 3. 規約の改訂

**目的:** 開発者として、この構成の意図を steering で読めるようにしたい。後から同じ構成を別の部品に広げるかを判断できるようにするため。

#### 受入基準

1. The `structure.md` shall 部品フォルダの中のフックを `hooks/`、判断の `.ts` を `rules/` に置く規則を記載する。
2. The `structure.md` shall 規則の変更を、この文書の改訂と同じ変更で行うことを、従来どおり記載する。
3. When 規則の記載と実際の配置が異なるとき, the 検査（`composerSplit` の構造の検査） shall 違反として報告する。

### 4. 既存の検証と境界の不変

**目的:** 開発者として、配置の変更が安全に行われたと確かめたい。テストの件数と検査の結果が後退しないようにするため。

#### 受入基準

1. The 変更 shall 既存のテストファイルの期待値を変えず、変更は import パスと検査の対象パスだけにする。
2. The 変更 shall `npm run test:all` が終了コード 0 で通過し、件数が基準（unit 257・component 13・route 200・render 2・e2e 7）を下回らない。
3. The 検査（`npm run test:imports`） shall 違反 0 件で通過し、許容リストの項目を増やさない。
4. The 変更 shall e2e の投稿フロー（`thread-posting`・`schedule`）を、移動の前と同じ結果で通過させる。
