# 要件書

## 概要

`src/lib/` は業務の判断を持ち、React と react-easy-crop に依存しない。現状は `lib/` の 6 ファイルが React（フックと描画）または react-easy-crop に依存している。この依存を取り除き、フックと描画は部品の側（`components/`）へ移す。判断（翻訳・切り抜きの計算・画像の加工・予約の利用可否・共有設定の判断）は `lib/` に残す。利用者に見える画面と振る舞いは変えない。

2026-11-01 の実測（`lib/` の UI 依存 6 ファイル）:

- `lib/i18n/react.ts`（フック `useLocale`・`useT`・`useFormat`）と `lib/i18n/rich.tsx`（描画 `renderSlots`）。翻訳を使う部品は約 70 件。
- `lib/image/croppedImageStyle.ts`（React の `CSSProperties` 型と react-easy-crop の `Area` 型に依存）。
- `lib/image/postImageProcessing.ts`（react-easy-crop の `Area` 型に依存。843 行で、切り抜きの計算と画像の加工を含む。`lib/video/videoOverlay.ts` と `lib/entry/createPostVisual.ts` が、この中の定数と関数を使う）。
- `lib/schedule/useScheduleAvailability.ts`（フック）と `lib/settings/useShareToggles.ts`（フック）。

用語:

- **UI 依存**: `react`・`react-easy-crop` の import（値としての import と、型だけの import の両方を含む）。
- **判断**: 翻訳の文言の選択、切り抜きの位置・大きさの計算、画像の加工の結果、予約の利用可否の判定、共有設定の値の決め方。
- **描画**: React の部品として画面に出すもの。

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->

## 境界の文脈（任意）

- **対象内**: 上の 6 ファイルの移動と分割。移動に伴う import の更新（部品の側、テストの側）。許容リストから、この spec が所有する `uiInLib` の項目を消すこと。
- **対象外**: 翻訳の文言と言語の判定（`i18n` の振る舞い）。切り抜きの結果と画像の加工の仕様（`media-attachments` の振る舞い）。設定の保存と読み出し（`settings` の振る舞い）。予約の利用可否の仕様（`scheduled-posting` の振る舞い）。`components/` 内のフックの整理（`src-composer-split` と `src-folder-layout` が扱う）。`lib/i18n/messages/*` と翻訳の型の循環（`src-cycles` が解消済み）。
- **隣接する期待**: `lib/video` と `lib/entry` は、画像の加工の定数（出力の幅と高さ）と既定のサムネイルの作成を、従来どおり使える。`src-cycles` で解消した循環は再び生じない。

## 要件

### 1. 翻訳の React 依存の分離

**目的:** 開発者として、翻訳の判断を React なしで読んで試せるようにしたい。判断と描画の読み分けが、ファイルの場所で分かるようにするため。

#### 受入基準

1. The `lib/i18n` shall React の import（値と型の両方）を含まない。
2. When 翻訳の文言が要求されたとき（部品の外から）, the 翻訳 shall 移動の前と同じ文言と言語の判定の結果を返す。
3. When リッチな文言（スロットを含む文言）が描画されたとき, the 表示 shall 移動の前と同じ内容と構造を表示する。
4. When 表示言語が変更されたとき, the 表示 shall 移動の前と同じく、表示中の全ての文言を新しい言語に切り替える。

### 2. 画像の切り抜きと加工の React 依存の分離

**目的:** 開発者として、画像の計算を React と react-easy-crop なしで試せるようにしたい。切り抜きと加工の結果が、描画と独立に確かめられるようにするため。

#### 受入基準

1. The `lib/image` shall React と react-easy-crop の import（値と型の両方）を含まない。
2. When 切り抜きの位置・大きさ・表示の値が計算されたとき, the 計算 shall 移動の前と同じ値を返す。
3. When 画像が加工されたとき（縮小・合成・サムネイルの作成）, the 加工 shall 移動の前と同じ出力を返す。
4. The `lib/video` と `lib/entry` shall 画像の加工の定数（出力の幅と高さ）と既定のサムネイルの作成を、移動の前と同じ値と振る舞いで使える。

### 3. 設定と予約のフックの分離

**目的:** 開発者として、共有設定と予約の判断を React なしで読めるようにしたい。設定と予約の判断の仕様が、描画と独立に確かめられるようにするため。

#### 受入基準

1. The `lib/settings` と `lib/schedule` shall React の import（値と型の両方）を含まない。
2. When 共有設定の切り替えが変更されたとき, the 設定 shall 移動の前と同じ値を保存し、画面の表示も同じ値を示す。
3. When 予約の利用可否が判定されたとき, the 判定 shall 移動の前と同じ結果を返す。
4. When 認証情報の変更が通知されたとき, the 予約の表示 shall 移動の前と同じく、変更を受け取って表示を更新する。

### 4. 振る舞いと既存の検証の不変

**目的:** 利用者として、部品の移動で画面や操作が変わらないでほしい。機能が壊れていないと分かるようにするため。

#### 受入基準

1. The 変更 shall 利用者に見える画面と操作の振る舞いを変えない。
2. The 既存のテストスイート（type・unit・component・route・render・e2e） shall 変更の前と同じ件数が全て通過する。
3. When 移動に伴いテストの import パスが変わったとき, the 変更 shall テストの期待値と検証の意味を変えない。

### 5. 許容リストと検査への反映

**目的:** 開発者として、UI 依存の違反が検査の結果に現れてほしい。移動が完了したことと、新しい違反が増えていないことを、検査で確かめられるようにするため。

#### 受入基準

1. When 移動が完了したとき, the 許容リスト shall この spec が所有する `uiInLib` の項目を 0 件にする。
2. The 検査（`npm run test:imports`） shall 移動の後に、違反 0 件で通過する。
3. While 移動の途中の段階である, the 許容リスト shall 移動の前より項目を増やさない。
