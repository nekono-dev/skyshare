# Implementation Plan

共有ファイルの編集順: `tests/unit/scripts/importRules.test.ts` は lib-layers 4.2 → util-placement 6.2 → 本仕様（2.3・3.5）の順に編集する。`structure.md` の「依存規則の検査」の表と「型（`src/types/`）」の節は、util-placement 6.1 → 本仕様 5.1 の順に編集する。

- [ ] 1. 実装の前提の確認
- [x] 1.1 着手時の基準を記録し、上流の完了を確かめる
  - `npm run test:all` の終了コードと通過件数を、実装の作業記録に書き残す（以後の完了条件の基準）
  - `src/util/` の残りが util-placement の結果の 5 件、`src/types/` が型だけの 3 件（util-placement の結果）、`src/layout/` が存在せず、`config/architecture/import-allowlist.json` の項目が 0 件であることを確かめる
  - 完了時の状態: 基準の件数と、上流の完了の確認結果が記録されている
  - _Requirements: 7.3_

- [ ] 2. 規則の一覧と許容リストの理由（基盤）
- [x] 2.1 規則の一覧を一本化し、規則 utilShared・typesLeaf・typesOnly を加える
  - _Depends: lib-layers 4.1, util-placement 6.1_
  - `RULE_IDS` を `rules.ts` で定義し、`RuleId` をそこから導き、`allowlist.ts` はそれを import する。これにより、lib-layers 4.1 が `RuleId`（`rules.ts`）と `allowlist.ts` の `RULE_IDS` に加えた `libLayer` の二つの定義を、`rules.ts` の一つの定義に置き換える（規則の一覧の単一の正は `rules.ts`）
  - 規則 `utilShared` の根拠（`RULE_BASIS`）を「共通（`src/util/`・`src/styles/`）」の節として書く
  - 規則 `typesLeaf`・`typesOnly` の根拠（`RULE_BASIS`）を「型（`src/types/`）」の節として書く（節の本文は util-placement 6.1 が書く）
  - 既存の規則（`layer`・`uiInLib`・`cycle`・`crossRegionRelative`・`relativeDepth`・`jsExtension`）の判定と `RULES` の並びは変えない
  - 完了時の状態: 既存の `importRules.test.ts` の根拠の検査（すべての規則に節が紐づく）が、`utilShared` を含めて通る
  - _Requirements: 5.1, 6.1_
- [x] 2.2 許容リストの項目に理由を必須で持たせる
  - `AllowlistEntry` に `reason` を加え、空または欠落の項目は読み込みのエラーにして終了コード 1 にする
  - `--emit-allowlist` の下書きは各項目の `reason` を空で出し、理由を埋めるまで読み込めないようにする
  - `DEFAULT_OWNERS` に `utilShared`・`typesLeaf`・`typesOnly`（いずれも `"structure-checks"`）を加える
  - 完了時の状態: 理由の無い許容リストは `npm run test:imports` が失敗し、既存の許容リスト（空）は読み込める
  - _Depends: 2.1_
  - _Requirements: 4.1, 4.2, 4.3, 2.5_
- [x] 2.3 許容リストの既存のテストを理由の欄に合わせる
  - `importRules.test.ts` の許容リストの fixture に `reason` を加え、`--emit-allowlist` の往復のテストは理由を埋めてから読み込む手順に変える
  - 理由が欠落・空の許容リストが読み込みエラーになる負例を加える
  - 完了時の状態: `npm run test:unit` の `importRules.test.ts` が通り、理由の欠落の負例が失敗を報告する
  - _Depends: 2.2_
  - _Requirements: 4.2, 4.3, 6.1_

- [ ] 3. util の汎用性の検査
- [x] 3.1 (P) 規則 utilShared の判定を純粋な関数で加える
  - `src/util/` の各モジュールについて、`src/util/` の外からの利用元の領域（`regionOf`）の集合を作る
  - 領域が二つ未満（0 件を含む）のモジュールを、`ruleId` が `utilShared` の違反にする（`specifier` は空文字）
  - `src/util/` 内からの import は利用元に数えない。型だけの import は数える
  - 利用元は `scanModules` が読む `src/` のモジュールだけを数える。`tests/`・`scripts/` からの import は数えない（`util` の汎用性は製品コードの利用元で判定する）
  - 完了時の状態: 負例（領域が一つ・0 件・`util` 内からのみ・`pages` の直下の二つのファイル）と正例（領域が二つ）が、fixture のグラフで期待どおりに判定される
  - _Boundary: UtilSharingRule_
  - _Depends: 2.1_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.2_
- [x] 3.2 utilShared の違反を検査の CLI に合流させる
  - `check-imports.ts` の違反の一覧に `findUtilSharingViolations` の結果を加える。`typesLeaf` は `evaluateImportRules` の辺の規則（3.3）として自動で加わる
  - 許容されない `utilShared` の違反は「違反」として表示され、終了コード 1 になる。許容リストに理由付きで載れば終了コード 0 になる
  - 完了時の状態: 既存の CLI の負例（終了コード・許容・stale）が変わらず通り、`utilShared` の負例が終了コード 1 を返す
  - _Depends: 3.1_
  - _Requirements: 2.5, 7.1_

- [x] 3.3 (P) 規則 typesLeaf を辺の規則として加える
  - `evaluateImportRules` に `typesLeaf` を加える。importer が `src/types/` で、target が `src/types/` の外のモジュールまたはパッケージの辺を違反にする（ruleId `typesLeaf`、型だけの辺も数える）
  - 完了の条件: `tests/unit/scripts/typesRules.test.ts` の fixture で、`src/types/a.ts` → `src/lib/x.ts`・`src/util/y.ts`・パッケージが違反になり、`src/types/a.ts` → `src/types/b.ts` と `src/lib/x.ts` → `src/types/a.ts` が違反にならない
  - _Boundary: TypesRules（typesLeaf）_
  - _Depends: 2.1_
  - _Requirements: 8.1, 8.2, 8.6_
- [x] 3.4 (P) 規則 typesOnly の判定を純粋な関数で加える
  - `scripts/architecture/typesOnly.ts` に `findTypesOnlyViolations(files)` を置く。文字列の本文を構文木（`typescript`）で読み、`type` 宣言・`interface` 宣言・`export type`・`export interface`・`import type` 以外の文を違反にする（ruleId `typesOnly`、specifier は空文字）
  - 完了の条件: fixture で `export const`・`export enum`・`export default`・値の `import`・`export *` が違反になり、`export type`・`export interface`・`import type` が違反にならない
  - _Boundary: TypesRules（typesOnly）_
  - _Depends: 2.1_
  - _Requirements: 8.3, 8.4, 8.6_
- [x] 3.5 typesOnly の違反を検査の CLI に合流させる
  - `check-imports.ts` が `src/types/` の `.ts` の本文を読み、`findTypesOnlyViolations` の結果を違反に加える（`.astro` は対象外）
  - 完了の条件: 許容されない `typesOnly` の違反は終了コード 1、許容リストに理由付きで載れば 0
  - _Depends: 3.2, 3.4_
  - _Requirements: 8.4, 7.1_

- [ ] 4. 骨格の静的な検査
- [x] 4.1 (P) 骨格の置き場が一つであることを静的に検査するテストを加える
  - `src/layout/` で始まるパスを違反とする純粋な判定を、ファイル名の一覧に対して行う
  - `src/` のソースの本文を文字列として読み、`@/layout/` で始まる文字列リテラルが無いことを確かめる（モジュールは実行しない。要件 6.3）
  - `src/components/layout/Baselayout/index.astro` が存在することを確かめる
  - 負例として `src/layout/Baselayout.astro` を含む一覧が違反として報告されることを確かめる
  - 完了時の状態: `tests/unit/scripts/layoutSingle.test.ts` が通り、負例が `src/layout/` だけを報告する
  - _Boundary: LayoutSingle test_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.3_

- [ ] 5. steering と規則の一致
- [x] 5.1 structure.md の依存規則の表と util の規約を改訂する
  - 「依存規則の検査」の表に `utilShared` の行（内容: 各 `src/util/` モジュールは `src/util/` の外の二つ以上の領域から使われること。根拠: 「共通（`src/util/`・`src/styles/`）」）を加える
  - 表に `typesLeaf`（根拠: 「型（`src/types/`）」）と `typesOnly`（同左）の行を加える（`utilShared` の行と同じ形）
  - 表の下の文に、許容リストの項目は理由を持つことを加える
  - 「共通（`src/util/`・`src/styles/`）」の節に、`util` を置く条件（利用元が二つ以上の領域）を一文で加える
  - 骨格（`src/layout/` を置かない旨）の一文は、この節に書かない。layout-home 3.2 が部品の節（`layout`（骨格）の記述）に書く一文を、本タスクは重複して書かず、参照するだけにする
  - lib-layers 5.2 が「依存規則の検査」の表に `libLayer` の行を加えた後に行う（同じ表を編集するため）。本タスクは `libLayer` の行を消さない
  - 完了時の状態: 表の `utilShared` の行・節の一文・表の下の文が存在し、`libLayer` の行と共存する
  - _Boundary: structure.md_
  - _Depends: lib-layers 5.2, layout-home 3.2, util-placement 6.1_
  - _Requirements: 5.2, 5.4_
- [ ] 5.2 structure.md と規則の一覧が一致することを検査するテストを加える
  - `structure.md` の「## 依存規則の検査」の表の一列目と `RULE_IDS` が双方向に一致することを確かめる
  - `RULE_BASIS` の「」内の名前が `structure.md` の見出しと一致することを確かめる
  - `structure.md` に「共通（`src/util/`・`src/styles/`）」の節と、部品の節の骨格（`layout`）の一文（`` `src/layout/` `` を置かない旨）が含まれることを確かめる
  - `structure.md` に「型（`src/types/`）」の節があることを確かめる（規則 `typesLeaf`・`typesOnly` の根拠）
  - 負例として、規則が一つ欠けた表と余分な行を持つ表が差を報告することを確かめる
  - 完了時の状態: `tests/unit/scripts/steeringRules.test.ts` が通る
  - _Boundary: SteeringRules test_
  - _Depends: 2.1, 5.1_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. 完了時の固定
- [ ] 6.1 許容リストの完了時の状態を検査するテストを加える
  - `config/architecture/import-allowlist.json` を `loadAllowlist` で読み、エラーが無いことを確かめる
  - 読み込んだ項目のうち `ruleId` が `libLayer`・`utilShared`・`typesLeaf`・`typesOnly` のものが 0 件であることを確かめる
  - 負例として `utilShared` の項目を持つ一時ファイル（`fs.mkdtempSync`）を読み、その項目が検出されることを確かめる
  - 完了時の状態: `tests/unit/scripts/allowlistCompletion.test.ts` が通る
  - _Requirements: 1.4, 4.4, 8.5_
- [ ] 6.2 実リポジトリで util の汎用性の違反が 0 件であることを確かめる
  - `scanModules` で実リポジトリを読み、`findUtilSharingViolations` の結果が 0 件であることを `utilSharing.test.ts` で確かめる
  - 同じ `scanModules` の結果で、`src/types/` の `.ts` の本文に `findTypesOnlyViolations` を適用し、`typesLeaf` の辺が 0 件であることを `typesRules.test.ts` で確かめる
  - 完了時の状態: 実リポジトリの `src/util/` の残り 5 件がすべて二つ以上の領域から使われ、テストが通る
  - _Depends: 3.1_
  - _Requirements: 2.6, 8.5_

- [ ] 7. 完了の確認
- [ ] 7.1 検査と全体のテストを実行し、終了コードを確かめる
  - `npm run test:imports` が終了コード 0 で、違反・許容のエラー・stale が 0 件であることを確かめる
  - `npm run test:all` が終了コード 0 で終わることを確かめる
  - 完了時の状態: 両方のコマンドの終了コードが 0 である
  - _Depends: 2.3, 3.2, 3.3, 3.5, 4.1, 5.1, 5.2, 6.1, 6.2, lib-layers 4.2, util-placement 7.3, components-small-areas, lib-large-files_
  - _Requirements: 7.1, 7.2_
- [ ] 7.2 通過件数と非変更を確かめる
  - `npm run test:all` の通過件数が 1.1 で記録した基準を下回らないことを確かめる
  - 変更が `scripts/`・`tests/`・`config/architecture/`・`.kiro/steering/structure.md` だけに限られ、`src/` の製品コードと生成物（`src/client/openapi/`）に差分が無いことを `git status` で確かめる
  - 完了時の状態: 件数が基準以上で、製品コードと生成物に差分が無い
  - _Depends: 7.1_
  - _Requirements: 7.3, 7.4_

## Implementation Notes

### 1.1 着手時の基準と上流の確認（記録）

- `npm run test:all`（着手時、2026-11-04）: 終了コード 0。unit 50 ファイル 341 件、component 5 ファイル 13 件、route 23 ファイル 212 件、render 1 ファイル 2 件、e2e 7 件（すべて通過）。以後の完了条件の基準は、この通過件数とする。
- `npm run apigen`: 終了コード 0。実行後の `git status` で、生成物（`src/client/openapi/`）に差分は無い。
- 上流の確認（util-placement の結果と一致）:
  - `src/util/` の残りは 5 件（`formData.ts`・`http.ts`・`padTwoDigits.ts`・`utf8Bytes.ts`・`waitForImageLoad.ts`）。
  - `src/types/` は型だけの 3 件（`clientEnvironment.ts`・`formData.ts`・`outcome.ts`）。
  - `src/layout/` は存在しない。
  - `config/architecture/import-allowlist.json` の項目は 0 件（`"entries": []`）。
- 不一致は無いため、着手は可能（BLOCKED ではない）。

### 5.1 structure.md の表と util の規約（記録）

- 表に `utilShared`・`typesLeaf`・`typesOnly` の行を加えた。規則の実装（3.2・3.3・3.5）の完了まで、表の上と下の注で「予定」と明記している。
- 完了の時点で、`structure.md` の 63 行目「葉と型だけの規則（typesLeaf・typesOnly）は、現時点の npm run test:imports では検査しない」は、3.3・3.5 の完了時に直す。同じ理由で `utilShared` も 3.2・3.5 の完了時に注を直す。
- 部品の節の骨格の記述（「骨格は `components/layout/Baselayout/` に置く」）は layout-home 3.2 で書かれ、5.2 の検査は「`src/layout/` を置かない旨」の文言を見る。文言が足りなければ 5.2 で扱う。
- util 節の「複数領域」を「二つ以上の領域」へ言い換えた（意味は同じ）。

### 2.1 規則の一覧の一本化（記録）

- `DEFAULT_OWNERS` に `utilShared`・`typesLeaf`・`typesOnly`（所有 spec は `structure-checks`）を 2.1 で加えた。`RuleId` を広げると型の `Record<RuleId, string>` が欠けて `test:type` が失敗するため、型の整合のために前倒しした。2.2 では重複して加えない。2.2 は `reason` の追加と読み込みの検証だけを行う。
- 「すべての規則に根拠の節が紐づく」検査は `RULE_IDS` の全件で回す（手書きの配列は廃止）。根拠の節名（`structure.md` の見出し）との一致は、現状ではファイル名（`structure.md`）の包含だけを見ている。節名の一致の検査は後続で加える余地がある。
- 2.2 の記録: CLI の「存在しない owner」テストの項目に `reason` が無いため、owner の検査ではなく reason の欠落で終了コード 1 になっている。2.3 で `reason` を加えて owner の経路を単独で検証し直す。
