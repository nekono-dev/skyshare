# 要件書

## 概要

`src/components/composer/ThreadComposer/index.tsx`（1,511 行）は、投稿フォームの描画と部品の組み立てに加えて、区切り・検証・提出の組み立て・候補の計算を持っている。同じフォルダに、純粋な判断の `.ts`（`segments.ts`・`shareDispatch.ts`・`submitThread.ts`・`suggestHashtags.ts`・`useSuggest.ts`・`useKeyboardRows.ts`）と描画の部品（`PostBodyEditor`・`ThreadSegmentForm`）が混在し、読む人が流れを追いにくい。

この spec は、投稿フォームの描画を役割ごとの部品に分け、判断を役割ごとの `.ts` に分けて整理する。利用者に見える投稿フォームの振る舞い（入力・候補・提出の結果）は変えない。

2026-11-01 の実測（`ThreadComposer/` の構成）:

- `index.tsx` 1,511 行。
- `ThreadSegmentForm/index.tsx` 688 行、`PostBodyEditor/index.tsx` 379 行。
- 判断の `.ts` は 6 ファイル（計 1,700 行超）で、同じフォルダに置かれている。

用語:

- **判断**: 区切りの追加・削除、投稿可否の検証、提出の内容の組み立て、候補の計算、共有先への送信の分岐。
- **描画**: React の部品として画面に出すもの（入力欄・候補の表示・ボタン）。

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->

## 境界の文脈

- **対象内**: `ThreadComposer/` フォルダ内の部品の分割と、判断の `.ts` の整理。`composer/` の他の部品の import の整理（`components/common` への依存を含む）。
- **対象外**: 投稿の仕様（文字数・検証の規則。`post-composition` の振る舞い）、Bluesky のレコードの組み立て（`atproto-records`）、共有の仕様（`external-sharing`）、予約の UI（`scheduled-posting`）、画像と動画の扱い（`media-attachments`）、アンケートの入口（`survey`）。
- **隣接する期待**: 投稿の提出の結果（作成された投稿・失敗の表示・予約の受付）は、分割の前と同じ内容を示す。`lib/` の判断は変えない（`src-lib-ui-boundary` で整理済みの移動先を使う）。

## 要件

### 1. 投稿フォームの振る舞いの不変

**目的:** 利用者として、フォームの分割で投稿の操作が変わらないでほしい。投稿を失うことなく、今までどおり書けるようにするため。

#### 受入基準

1. When 利用者がスレッドの投稿フォームで入力・区切りの追加・区切りの削除を行ったとき, the 投稿フォーム shall 分割の前と同じ入力内容と表示を示す。
2. If 利用者が先頭の区切りを削除しようとしたとき, the 投稿フォーム shall 先頭の区切りを削除せず、残りの区切りの内容を変えない。
3. When 利用者が投稿を提出したとき, the 投稿フォーム shall 分割の前と同じ内容・同じ順序の投稿を作成する。
4. When 提出が失敗したとき, the 投稿フォーム shall 分割の前と同じ失敗の表示を示し、入力中の内容を保持する。
5. When 利用者が共有先を指定して提出したとき, the 投稿フォーム shall 分割の前と同じ共有先へ、同じ順序で送信する。

### 2. 候補とキー操作の振る舞いの不変

**目的:** 利用者として、ハッシュタグやメンションの候補の操作が変わらないでほしい。入力の速さを保つため。

#### 受入基準

1. While 利用者がハッシュタグまたはメンションを入力している間, the 投稿フォーム shall 分割の前と同じ候補の一覧を示す。
2. When 利用者が候補のキー操作（上下・確定・取り消し）を行ったとき, the 投稿フォーム shall 分割の前と同じ選択と確定の結果を示す。
3. When 利用者がハッシュタグの候補を受け取る（履歴・トレンド）とき, the 投稿フォーム shall 分割の前と同じ順序と出所の表示で候補を示す。

### 3. 判断と描画の所在

**目的:** 開発者として、投稿フォームの判断を描画と分けて読みたい。判断の仕様を、画面と独立に確かめられるようにするため。

#### 受入基準

1. The `ThreadComposer/index.tsx` shall 部品の組み立てと描画の責務だけを持ち、750 行以下である（改定: 利用者の承認により 500 行から 750 行へ改めた。移動だけで 500 行以下にするには、フォーム本体の大きな props の受け渡しが要るため）。
2. The 区切り・検証・提出の組み立て・候補の計算の `.ts` shall React を import しない。
3. The `ThreadComposer/` の判断の `.ts` shall 部品フォルダの規約（判断は同じフォルダの `camelCase.ts`、フックは `useX.ts`）に従って、役割ごとのファイルに分けて置かれる。
4. Where 描画の部品が役割の単位（入力行・候補・キー操作）で分かれているとき, the 描画の部品 shall 同じフォルダの `index.tsx` と `index.module.css` の規約に従う。

### 4. 既存の検証と境界の不変

**目的:** 開発者として、分割が安全に行われたと確かめたい。テストの件数と検査の結果が後退しないようにするため。

#### 受入基準

1. The 変更 shall 既存のテスト（type・unit・component・route・render・e2e）の期待値を変えず、移動の前と同じ件数以上が全件通過する。
2. When テストの import パスが変わったとき, the 変更 shall テストの期待値と検証の意味を変えない。
3. The 検査（`npm run test:imports`） shall 違反 0 件で通過する。
4. While 分割の途中の段階である, the 許容リスト shall 分割の前より項目を増やさない。
5. When 分割が完了したとき, the 変更 shall `composer/` の他の部品（`PostLauncher`・`SuggestPopover` など）の利用者に見える振る舞いを変えない（e2e の投稿フローが通過する）。
