# Implementation Plan

- [x] 1. 検査の土台を用意する
- [x] 1.1 (P) 検査の入口を用意する
  - 検査を起動する npm スクリプトが存在し、現時点では規則が空でも終了コード 0 で終わる
  - 同じ入口が、全体の検証の入口（test:all）の一部として実行される
  - _Boundary: Cli_
  - _Requirements: 7.1_

- [x] 1.2 (P) 検査の対象を走査する
  - `src/` の `.ts`・`.tsx`・`.astro` を列挙し、生成物と型宣言ファイルを除外する
  - `.astro` は先頭のフロントマターの import だけを取り出し、本文の `<script>` は含めない
  - 型だけの import と、動的 import の文字列リテラルを取り出し、型だけかどうかを区別する
  - `@/`・相対パス・拡張子の省略・`index` を解決し、解決できない `.ts` 系の指定はエラーとして報告する
  - 走査の前後で `src/` のファイルが変わらない
  - _Boundary: ImportScanner_
  - _Requirements: 5.1, 7.4_

- [x] 1.3 (P) ファイルの領域を判定する
  - `lib/<領域>`・部品フォルダ（`components/<領域>/<Name>`）・部品フォルダの外（`components/<領域>`）・その他の親ディレクトリ・`src/` 直下の各ファイルが、期待どおりの領域になる
  - 同じ領域の 2 つのファイルは同じ領域と判定され、異なる領域は異なると判定される
  - _Boundary: RegionClassifier_
  - _Requirements: 4.1, 4.2_

- [x] 2. 規則と循環を適用する
- [x] 2.1 層の規則と UI 非依存の規則を適用する
  - `lib` から `components`・`pages` への import が違反として報告される
  - `util` から `lib`・`components`・`pages` への import が違反として報告される
  - `lib` から `react`・`react-*` の外部パッケージへの import（型だけの import を含む）が違反として報告される
  - 違反の報告は、規則の名前・ファイル・指定・説明を含む
  - 各規則には、根拠となる steering の節（`structure.md` の見出し）が紐づいている
  - _Depends: 1.2, 1.3_
  - _Boundary: RuleEvaluator_
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 5.1, 10.1_

- [x] 2.2 領域をまたぐ相対 import・段数・拡張子の規則を適用する
  - 異なる領域への相対 import が違反として報告され、同じ領域内の相対 import は違反にならない
  - `../` が 3 段以上の import が違反として報告される
  - 解決先がモジュールで、指定が `.js` で終わる import が違反として報告される
  - 型だけの import にも同じ規則が適用される
  - _Depends: 2.1_
  - _Boundary: RuleEvaluator_
  - _Requirements: 4.1, 4.3, 4.4, 5.1_

- [x] 2.3 循環 import を検出する
  - 循環に含まれる import だけが違反として報告され、循環のない木では違反が 0 件になる
  - 型だけの import で作った循環も報告される
  - 自分自身を import している場合は循環として数えない
  - _Depends: 1.2, 2.1_
  - _Boundary: CycleDetector_
  - _Requirements: 3.1, 5.1_

- [x] 3. 許容リストと結果の判定を作る
- [x] 3.1 許容リストを読み込んで検証する
  - 許容リストの JSON が壊れていると、場所を示したエラーになる
  - 同じ照合キーの項目が 2 つあると、エラーになる
  - 未知の規則名の項目と、所有 spec のディレクトリが存在しない項目は、エラーになる
  - 所有 spec の状態（承認の有無）は判定しない
  - _Boundary: AllowlistStore_
  - _Requirements: 6.3_

- [x] 3.2 違反と許容リストを照合する
  - 許容リストに載った違反は失敗として扱われず、件数だけが数えられる
  - 許容リストに無い違反は失敗として扱われる
  - 違反が消えた許容の項目は stale として報告され、stale だけでは終了コードは変わらない
  - _Depends: 3.1_
  - _Boundary: AllowlistStore_
  - _Requirements: 3.2, 6.1, 6.2, 6.4_

- [x] 3.3 結果の表示と終了コードを決める
  - 許容されていない違反が 1 件以上ある、または許容リストにエラーがあると、終了コードが 1 になる
  - それ以外は終了コード 0 になり、stale は警告として別に表示される
  - 最後に違反と許容と stale の件数の要約が表示される
  - _Depends: 2.2, 2.3, 3.2_
  - _Boundary: Cli_
  - _Requirements: 6.2, 7.2_

- [x] 3.4 許容リストの下書きを出力する
  - `--emit-allowlist` で、現在の違反のすべてが、規則ごとの既定の所有 spec（設計の表）付きの JSON として出力される
  - このオプションはファイルを書き換えない
  - 出力された下書きを検査に与えると、違反が 0 件、stale も 0 件になる
  - _Depends: 3.3_
  - _Boundary: Cli, AllowlistStore_
  - _Requirements: 6.3, 7.1_

- [x] 4. 許容リストを確定し、CI に組み込む
- [x] 4.1 現状の違反から許容リストを確定する
  - 下書きを出力し、規則ごとの件数と所有 spec を確認して、許容リストとして確定する
  - 確定した許容リストで検査を実行すると、終了コード 0 になり stale は 0 件になる
  - 所有 spec はすべて `.kiro/specs/` に存在する
  - _Depends: 3.4_
  - _Boundary: AllowlistStore, Cli_
  - _Requirements: 6.1, 6.3, 7.2_

- [x] 4.2 (P) 規約の記述を steering に合わせる
  - `structure.md` の「依存の向き」と「Import Organization」に、検査の規則（循環の禁止・`lib` の UI 非依存・領域をまたぐ相対 import の禁止・`../` の段数の上限・拡張子を付けない方式）が書かれている
  - `structure.md` の import の例が、拡張子を付けない方式に直っている
  - 規則の変更は steering の改訂と同じ変更で行うことが、規約の記述に示されている
  - _Boundary: Steering rules (structure.md)_
  - _Requirements: 8.1, 10.3_

- [x] 4.3 検査を CI のテストジョブに組み込む
  - 既存のテストジョブ（deploy の test ジョブ）に検査の手順が加わり、`test:lexicon` より前に実行される
  - 違反がある状態で手順が失敗すると、ジョブが失敗し、デプロイに進まない
  - _Depends: 4.1_
  - _Boundary: Cli_
  - _Requirements: 7.3_

- [x] 5. 単体テストで規則と判定を確かめる
- [x] 5.1 領域と走査のテストを書く
  - 領域の判定の期待値（lib・部品フォルダ・部品フォルダの外・その他・src 直下）がテストで固定されている
  - `.astro` のフロントマターの import が取り出され、本文の `<script>` の import は取り出されない
  - 動的 import の文字列リテラルが取り出され、型だけの import が区別されてテストされる
  - _Depends: 1.2, 1.3_
  - _Boundary: ImportScanner, RegionClassifier_
  - _Requirements: 4.2, 5.1_

- [x] 5.2 規則と循環のテストを書く
  - 層の規則・UI 非依存・領域をまたぐ相対 import・段数・拡張子・循環の各規則について、違反の例と正しい例がテストされている
  - 型だけの import にも各規則が適用されることがテストされている
  - _Depends: 2.2, 2.3_
  - _Boundary: RuleEvaluator, CycleDetector_
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.1, 4.3, 4.4, 5.1_

- [x] 5.3 許容リストと終了コードのテストを書く
  - 許容された違反が失敗にならず、許容されていない違反が失敗になることがテストされている
  - 消えた許容の項目が stale として報告され、終了コードが変わらないことがテストされている
  - 壊れた許容リスト、重複キー、未知の規則、存在しない所有 spec がエラーになることがテストされている
  - _Depends: 3.3_
  - _Boundary: AllowlistStore, Cli_
  - _Requirements: 3.2, 6.1, 6.2, 6.3, 6.4, 7.2_

- [x] 5.4 想定の構成からの独立をテストで確かめる
  - 任意の名前と配置のフォルダだけを持つ木で、違反が 0 件になる
  - 特定のファイルの存在を前提にしない木でも、規則が正しく判定される
  - 各規則に根拠の steering の節が紐づいていることが、テストで確かめられる
  - _Depends: 2.1, 2.2_
  - _Boundary: RuleEvaluator_
  - _Requirements: 10.1, 10.2_

- [x] 6. 全体の確認を行う
- [x] 6.1 既存の検証の結果が変わらないことを確かめる
  - 既存のテストの件数と結果（type・unit・component・route・render・e2e・lexicon）が、検査の追加の前と同じである
  - 検査の追加で、画面と API の振る舞いが変わっていないことを、既存の E2E で確かめる
  - _Depends: 4.3, 5.1, 5.2, 5.3, 5.4_
  - _Boundary: Cli_
  - _Requirements: 9.1, 9.2_

## Implementation Notes

- 生成物（`src/client/openapi/`）への import は、検査の対象外として辺にも未解決にもしない。最初の実装では「解決できない」エラーになったため、直した（2026-11-01）。
- `tsconfig.json` の `exclude` に `tests/fixtures/import-rules` を加えた。違反を含む fixture を型検査から外すため。
- 許容リストの初期内容は `--emit-allowlist` の出力（122 件）を、所有 spec を確認して確定した。規則ごとの内訳: `relativeDepth` 39・`cycle` 32・`jsExtension` 27・`crossRegionRelative` 17・`uiInLib` 7。`layer` は 0 件。
- 検証結果（2026-11-01）: type 成功、unit 158（既存 122 + 追加 36）、component 6、route 135、render 2、lexicon 成功、e2e 7。既存の件数と結果は変わっていない。
