# Implementation Plan

- [x] 1. 移動の前に特性化テストを用意し、基準値を記録する
- [x] 1.1 (P) 画像の切り抜きと加工の純粋な計算を現行の値で固定する
  - 枠の割り当て（枚数ごとの枠の数と寸法）が、テストで固定されている
  - 初期の切り抜き（中央寄せ）と、横長への切り出しの代表的な入力と出力が、テストで固定されている
  - 現行コードで、このテストが全件通過する（canvas を使う処理は対象外）
  - _Boundary: ImageProcessing_
  - _Requirements: 2.2, 2.3_

- [x] 1.2 (P) プレビューのインラインスタイルの値を現行の値で固定する
  - クロップ範囲なし（既定のカバー表示）の戻り値が、テストで固定されている
  - クロップ範囲ありの位置・大きさ・拡大率の値が、テストで固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: CroppedImageStyle_
  - _Requirements: 2.2_

- [x] 1.3 (P) リッチな文言の描画を現行の値で固定する
  - プレースホルダの差し込み位置と、差し込まれない名前（そのまま残る文字列）の結果が、テストで固定されている
  - 語順の違う文言（日本語と英語）が、同じ描画の規則で処理されることが、テストで固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: SlotRenderer_
  - _Requirements: 1.3_

- [x] 1.4 現行の基準値を記録する
  - 変更の前に `npm run test:all` が全件通過し、件数（type・lexicon・imports・unit・component・route・render・e2e）が記録されている
  - 記録した件数は tasks.md の Implementation Notes に書かれている
  - _Depends: 1.1, 1.2, 1.3_
  - _Requirements: 4.2_

- [x] 2. 画像の加工の型を lib 側に持たせる
- [x] 2.1 切り抜きの範囲の型を CropArea として lib 側で定義し、react-easy-crop への依存を外す
  - 加工のモジュールが、react-easy-crop の import（型を含む）を持たず、同じ形の CropArea を使う
  - 1.1 の特性化テストが引き続き全件通過する
  - `lib/video`・`lib/entry` が、定数と既定のサムネイルの作成を、移動の前と同じ値と振る舞いで使える（`npm run test:type` が通過する）
  - `npm run test:type` が通過する（部品から lib への代入が通る）
  - _Depends: 1.4_
  - _Boundary: ImageProcessing_
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. 翻訳の入口を components/i18n へ移す
- [x] 3.1 表示言語のフックと文言の描画を components/i18n へ移し、部品の import を書き換える
  - `components/i18n` に、表示言語・翻訳関数・書式化関数のフックと、リッチな文言の描画が置かれ、`lib/i18n` の React の入口は無くなる
  - `lib/i18n` のファイルは React を import しない（判断の部分は変えない）
  - 部品の import（翻訳の入口と描画）が、すべて新しい場所を指し、`npm run test:type` が通過する
  - 1.3 の特性化テストと、既存の翻訳の単体テストが引き続き全件通過する
  - component テスト（6 件）が、表示言語の切り替えと描画の結果を変えずに通過する
  - _Depends: 2.1_
  - _Boundary: TranslationHooks, SlotRenderer_
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. 画像のプレビューの表示を components/image へ移す
- [x] 4.1 プレビューのインラインスタイルの計算を components/image へ移し、利用する部品の import を書き換える
  - `components/image` に、プレビューのインラインスタイルの計算が置かれ、`lib/image` の同じファイルは無くなる
  - 1.2 の特性化テストの import パスを移動先に書き換え、期待値は変えずに全件通過する
  - 利用する部品（ImagePicker）が新しい場所を指し、`npm run test:type` が通過する
  - _Depends: 1.2, 3.1_
  - _Boundary: CroppedImageStyle_
  - _Requirements: 2.1, 2.2, 4.3_

- [x] 5. 予約と共有設定の状態のフックを components へ移す
- [x] 5.1 予約の利用可否のフックを components/schedule へ移し、利用する部品の import を書き換える
  - `components/schedule` に予約の利用可否のフックと、認証情報の変更の通知が置かれ、`lib/schedule` の同じファイルは無くなる
  - 予約の表示（認証の戻り・予約の設定・投稿フォームのボタン）が、通知を受けて更新されることを、component テストと既存のテストが守る
  - `lib/schedule` のファイルは React を import しない
  - `npm run test:type` が通過する
  - _Depends: 4.1_
  - _Boundary: ScheduleAvailabilityHook_
  - _Requirements: 3.1, 3.3, 3.4, 4.3_

- [x] 5.2 共有系設定のフックを components/settings へ移し、利用する部品の import を書き換える
  - `components/settings` に共有系設定のフックが置かれ、`lib/settings` の同じファイルは無くなる
  - 共有系設定の保存と表示（連動の規則・初期値）が、移動の前と同じ値を示すことを、既存のテストと component テストが守る
  - `lib/settings` のファイルは React を import しない
  - `npm run test:type` が通過する
  - _Depends: 5.1_
  - _Boundary: ShareTogglesHook_
  - _Requirements: 3.1, 3.2_

- [x] 6. 検査と統合
- [x] 6.1 領域の一覧に i18n を登録し、許容リストの UI 依存の項目を 0 件にする
  - steering の領域の一覧に `i18n` が登録されている
  - 許容リストの `uiInLib` の項目が 0 件になり、他の項目は増えていない（許容 77 → 70）
  - `npm run test:imports` が、違反 0 件で通過する
  - `lib/` の中に `react`・`react-easy-crop` の import（型を含む）が無いことを、検査が確かめる
  - _Depends: 5.2_
  - _Boundary: ImportRules_
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6.2 全体の検証で、移動の前と同じ件数が全件通過することを確かめる
  - `npm run test:all` が終了コード 0 で通過する
  - 件数が 1.4 の基準以上である（特性化テストを足した分だけ増える）
  - 既存のテストの期待値が変わっていないことを、テストの差分が import パスの変更のみであることで確かめる
  - 利用者に見える画面と操作（e2e 7 件を含む）が変わっていないことを、テストが確かめる
  - _Depends: 6.1_
  - _Requirements: 4.1, 4.2, 5.2_

## Implementation Notes

- 1.4 の基準値（変更の前、`npm run test:all` の終了コード 0）: type 通過、lexicon 通過、imports「違反 0 件・許容 77 件・stale 0 件」、unit 208 件（32 ファイル）、component 6 件（3 ファイル）、route 200 件（21 ファイル）、render 2 件、e2e 7 件。
- 6.2（変更の後、`npm run test:all` 終了コード 0）: type 通過、lexicon 通過、imports 違反 0 件・許容 70 件・stale 0 件、unit 220 件（34 ファイル、基準 208 件 + 新規 12 件）、component 10 件（4 ファイル、基準 6 件 + 新規 4 件）、route 200 件、render 2 件、e2e 7 件。既存のテストファイルは変更されず、差分は新規の 3 ファイルの追加だけ。
- 1.1〜1.3 の特性化テストは現行のコードで通過する（unit 12 件・component 4 件）。1.3 のテストは `tests/component/i18n/renderSlots.test.tsx` に置き、3.1 で `renderSlots` の import を新しい場所へ書き換える。
- 移動のタスク（3.1・4.1・5.1・5.2）は、利用する部品のファイル（`ImagePicker`・`ThreadComposer`・`Settings`・`AuthorizationReturn`・`ScheduleSetting`）を共有するため、並行にしない（`(P)` を付けない）。
- `postImageProcessing.ts` は分割しない（design の判断）。分割は `src-folder-layout` の論点として残す。
