# Implementation Plan

- [x] 1. 特性化テストを先に用意する
- [x] 1.1 (P) 翻訳の出力を現行の値で固定する
  - 日本語と英語で、プレースホルダを含む文言とプレースホルダを持たない文言の出力が、テストで固定されている
  - 複数形（件数に応じた単数と複数）の出力が、テストで固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: MessageTypes_
  - _Requirements: 1.2_

- [x] 1.2 (P) 旧形式の共有設定の移行結果を現行の値で固定する
  - 自動ポップアップの選択の組み合わせ（ON の数が 0・1・2 以上）の結果が、テストで固定されている
  - 旧キーだけが保存されている場合、新しい選択値が保存され、旧キーが消えることがテストで固定されている
  - 新しい選択値が既に保存されている場合、その値は上書きされないことがテストで固定されている
  - 保存に失敗した場合、旧キーが残ることがテストで固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: LegacyShareMigration_
  - _Requirements: 2.2_

- [x] 1.3 (P) Bluesky レコードの組み立てと AT URI の解析を現行の値で固定する
  - 代表的な入力に対する投稿レコードの組み立ての出力が、テストで固定されている
  - AT URI の解析（所有者と収集の一致の判定を含む）の代表的な入力と出力が、テストで固定されている
  - 現行の場所（`entry/url`）に対して書き、移動のタスクで import を更新する
  - 現行コードで、このテストが全件通過する
  - _Boundary: AtprotoRecordTypes, AtUri_
  - _Requirements: 3.2_

- [x] 1.4 現行の基準値を記録する
  - 変更の前に `npm run test:all` が全件通過し、件数（type・unit・component・route・render・lexicon・e2e）が記録されている
  - 記録した件数は tasks.md の Implementation Notes に書かれている
  - _Depends: 1.1, 1.2, 1.3_
  - _Requirements: 4.2_

- [x] 2. i18n と settings の循環を解消する
- [x] 2.1 辞書の型を依存のない位置へ分ける
  - 辞書の型（辞書の値の型と、英語辞書の型）が、翻訳の実行の位置から別のモジュールに移っている
  - 英語辞書の各ファイルは、翻訳の実行のモジュールを import しない
  - 翻訳の公開の型は、元の位置からも引き続き参照できる
  - `npm run test:imports` で、`lib/i18n` 内の循環が検出されない
  - 1.1 の特性化テストが引き続き通過する
  - _Depends: 1.4_
  - _Boundary: MessageTypes_
  - _Requirements: 1.1, 1.2_

- [x] 2.2 自動ポップアップの値と型を分け、移行処理の依存を一方向にする
  - 自動ポップアップの値の一覧と型が、設定の読み書きのモジュールとは別の位置にあり、移行処理はそれだけを参照する
  - 移行処理が、設定の読み書きのモジュールを import しない
  - 設定の読み書きのモジュールは、値と型を引き続き参照できる
  - `npm run test:imports` で、`lib/settings` 内の循環が検出されない
  - 1.2 の特性化テストが引き続き通過する
  - _Depends: 1.2_
  - _Boundary: AutoPopupTargetModel, LegacyShareMigration_
  - _Requirements: 2.1, 2.2_

- [x] 3. atproto・api・video・feedback・survey の双方向の依存を解消する
- [x] 3.1 Bluesky レコードの形の型を atproto に持たせる
  - atproto の 4 つのモジュールが、api の型を参照せず、atproto の型を参照する
  - api の推論結果が atproto の型に代入可能であることを、型検査で確かめている
  - `npm run test:type` が通過する
  - 1.3 の特性化テストが引き続き通過する
  - _Boundary: AtprotoRecordTypes_
  - _Requirements: 3.1, 3.2_

- [x] 3.2 動画 blob のスキーマを video に移す
  - 動画の送信処理が、api のスキーマを import せず、video の動画 blob のスキーマを使う
  - api のスキーマは、移した動画 blob のスキーマを引き続き参照できる（OpenAPI の説明は api 側に残る）
  - `npm run test:type` と `npm run test:route` が通過する
  - _Boundary: VideoBlob_
  - _Requirements: 3.1_

- [x] 3.3 送信内容の型を feedback に移す
  - フィードバックの Issue 生成が、api の型を import せず、feedback の送信内容の型を使う
  - api のフィードバックのスキーマの推論結果が、feedback の型に代入可能であることを、型検査で確かめている
  - `npm run test:type` と `npm run test:route` が通過する
  - _Boundary: FeedbackSubmission_
  - _Requirements: 3.1_

- [x] 3.4 回答 API の経路のスキーマを survey に移す
  - 回答の処理が、api のスキーマを import せず、survey の経路のスキーマを使う
  - api の経路のスキーマは、移したスキーマを引き続き参照できる
  - `npm run test:route` の回答の経路のテストが通過する
  - _Boundary: SurveyPathParams_
  - _Requirements: 3.1_

- [x] 3.5 標準エラー応答の生成を util に移す
  - エラー応答の生成関数が util に置かれ、util は lib を import しない
  - 利用側（API の応答と回答の処理）の import が util を参照する
  - `lib/api/response` に残るのは AT の例外を HTTP ステータスに変換する関数だけである
  - `npm run test:route` と `npm run test:render` が通過する
  - _Depends: 3.4_
  - _Boundary: ErrorResponse_
  - _Requirements: 3.1_

- [x] 3.6 AT URI の解析を atproto に移す
  - AT URI の解析の関数が atproto にあり、entry は組み立ての関数だけを持つ
  - 利用側（entry・timeline・atproto の投稿）の import が atproto の解析を参照する
  - 1.3 の特性化テストが、移動後の場所で通過する
  - _Boundary: AtUri_
  - _Requirements: 3.1_

- [x] 4. entry・timeline・image の双方向の依存を解消する
- [x] 4.1 SourceImage の型を image に移す
  - ギャラリーのレイアウトが、entry の型を import せず、image の画像の型を使う
  - entry は同じ型を引き続き参照できる
  - `npm run test:type` が通過する
  - _Boundary: SourceImage_
  - _Requirements: 3.1_

- [x] 4.2 投稿の画像作成の入力を、必要な項目だけの構造型にする
  - 投稿の画像作成が、timeline の型を import せず、画像と動画の項目だけの構造型を使う
  - 既存の呼び出し側（timeline の投稿を渡す部品）が変更なしで通過する
  - `npm run test:type` と `npm run test:unit` が通過する
  - _Depends: 4.1_
  - _Boundary: PostVisualSource_
  - _Requirements: 3.1_

- [x] 4.3 削除範囲の解決を timeline に移す
  - 削除範囲の解決の関数が timeline にあり、entry は timeline を import しない
  - 利用側（entry の 2 部品、ゲストのダミーデータ、テスト）の import が新しい場所を参照する
  - 既存の削除範囲の単体テストが、新しい場所で通過する
  - `npm run test:type` と `npm run test:component` が通過する
  - _Depends: 3.6_
  - _Boundary: PostVisualSource, AtUri_
  - _Requirements: 3.1, 4.1_

- [x] 5. 規約と許容リストを更新し、全体を確かめる
- [x] 5.1 lib の領域どうしが双方向に依存しないことをテストで確かめる
  - リポジトリ全体の依存を走査し、`lib` の領域の組のうち双方向のものが 0 組であることをテストが確かめる
  - テストは `npm run test:unit` に含まれ、通過する
  - _Depends: 4.3_
  - _Boundary: Testing (libRegionPairs)_
  - _Requirements: 3.1_

- [x] 5.2 (P) steering に lib の領域の依存の向きを書く
  - `structure.md` に「lib の領域の依存の向き」の節があり、設計の Allowed Dependencies と一致する
  - 節には、規則の変更を steering の改訂と同じ変更で行うことが書かれている
  - _Boundary: Steering rules (structure.md)_
  - _Requirements: 5.2_

- [x] 5.3 許容リストから循環の項目を消す
  - 許容リストに `cycle` の項目が無い
  - `npm run test:imports` が違反 0 件・stale 0 件で、終了コード 0 になる
  - _Depends: 2.1, 2.2_
  - _Boundary: Allowlist_
  - _Requirements: 5.1_

- [x] 5.4 全体の検証を行い、基準値と比べる
  - `npm run test:all` が全件通過する
  - 1.4 で記録した件数に対して、件数が減っておらず、追加された特性化テストと双方向のテストの分だけ増えている
  - E2E（7 件）と route の既存テストが、変更の前と同じく通過する
  - _Depends: 5.1, 5.2, 5.3_
  - _Requirements: 4.1, 4.2_

## Implementation Notes

- 1.4 の基準値（変更の前, 2026-11-01）: unit 179・component 6・route 135・render 2・e2e 7。lexicon 成功。検査は違反 0・許容 122・stale 0。
- 最終（5.4）: unit 182（基準 179 + 双方向・循環のテスト 3）・component 6・route 135・render 2・e2e 7。lexicon 成功。検査は違反 0・許容 78・stale 0。既存の件数と結果は変わっていない。
- schema（生成ツールが読む）は `@/` を解決できない（tech.md の制約）。schema から別領域を参照する import は相対のままにした。`api/schema/common.ts` の動画 blob と `api/schema/v2/surveys/_surveyId/path.ts` の回答経路の 2 件は、許容リストに `src-import-style` の所有で記録した（その扱いは src-import-style の作業で決める）。
- 型の代入可能性の検査（api の推論結果 → atproto・feedback の型）は、schema の外の `lib/api/typeCompat.ts` に置いた。
- `errorResponseFromStatus` は `util/http.ts` に移し、利用側 24 件の import を変えた（`lib/api/response.ts` は `resolveXrpcStatus` だけを残す）。
- 許容リストは現在の違反に合わせて作り直した。循環の 32 件は消え、移動で解消された `.js`・相対 import の項目も消えた。
- `tests/unit/lib/entry/resolveEntryDeleteScope.test.ts` と `url.test.ts` は、移動先（timeline・atproto）に合わせてテストの場所を変えた。テストの意味は変えていない。
