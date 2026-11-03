# Requirements Document

## Introduction

Phase 5 では `src/lib/`・`src/util/`・`src/components/`・骨格（`src/layout/`）の配置を組み替える。既存の検査は `components/` の配置（`componentLayout`・`steeringRegions`）と import の規則（`test:imports`）しか見ておらず、`lib` の層・`util` の汎用性・骨格の置き場は誰も検査していない。本仕様は、組み替えの完了後に同じ種類の違反が再び入り込まないよう、これらの配置の規則を機械で検査する。検査は既存の方式（`scripts/architecture/` の規則と許容リスト、`tests/unit/scripts/` の静的テスト）に合わせて追加し、既存の規則の判定は変えない。利用者に見える振る舞い、API、生成物は変えない。

## Boundary Context

- **In scope**:
  - `lib` の層の規則（`libLayer`、`lib-layers` が定義）が完了時点で有効であり、許容の項目が無いことの確認
  - `src/util/` の各モジュールが、`src/util/` の外の二つ以上の領域から使われることの検査（新しい規則 `utilShared`）
  - `src/types/` の葉と型だけの規則の検査（`typesLeaf`・`typesOnly`。Requirement 8）
  - `src/layout/` が存在せず、骨格が `src/components/layout/` の部品フォルダにあることの検査
  - 許容リストの各項目に理由を書くこと（理由の欄の追加と、理由が無い項目の読み込み失敗）
  - `structure.md` の「依存規則の検査」の表を、検査の規則と一致させること
  - 上記の検査のための負例テスト（検査が違反を見つけることの確認）
- **Out of scope**:
  - `lib` の層の分類と `libLayer` 規則の定義（`lib-layers`）。本仕様はその有効化と完了時の確認だけを扱う
  - `src/util/` の配置の変更（`util-placement`）・`src/components/` の配置の変更（`components-small-areas`）・大ファイルの分割（`lib-large-files`）
  - 400 行を超えるファイルの検査は追加しない。理由: Phase 5 の検査の範囲（roadmap の「配置・層・骨格」）に含まれない。また `src/components/` には 400 行を超えるファイルが 9 件あり、上限を検査に加えると `components/` の分割を別途必要とするため
  - 既存の規則（`layer`・`uiInLib`・`cycle`・`crossRegionRelative`・`relativeDepth`・`jsExtension`）の緩和・変更
  - `scripts/` の検査（Phase 2 の範囲）、検査の基盤の書き換え
- **Adjacent expectations**:
  - `util-placement` と `lib-layers` と `components-small-areas` と `layout-home` と `lib-large-files` が完了し、移動が済んでいること（本仕様は、それらの結果を検査する。`util-placement` の結果として `src/types/` に型だけのファイルが並ぶ）
  - 許容リストの既定の所有 spec は、既存の規則と同じく `.kiro/specs/` に存在する spec 名を用いる（新しい規則の所有 spec は `structure-checks`）
  - 規則の根拠は `structure.md` の規約に限る。規則を変えるときは、`structure.md` の改訂と同じ変更で行う

## Requirements

### Requirement 1: lib の層の規則の有効化と完了時の確認

**Objective:** As a 開発者, I want `lib` の基盤と業務の層の方向が機械で検査され、例外なく完了していること, so that 基盤から業務への逆流が再び入り込まない

#### Acceptance Criteria

1. When `npm run test:imports` is run, the 依存規則の検査 shall apply the `libLayer` rule to every import edge whose importer and target are both under `src/lib/`
2. If a module in a 基盤 領域 imports a module in a 業務 領域, then the 依存規則の検査 shall report that import as a violation with ruleId `libLayer`
3. The 依存規則の検査 shall not report an import from a 業務 領域 to a 基盤 領域 as a `libLayer` violation
4. When this spec is completed, the 許容リスト shall contain no entry whose ruleId is `libLayer`

### Requirement 2: util の汎用性の検査

**Objective:** As a 開発者, I want `src/util/` に置かれたモジュールが二つ以上の領域から使われることを機械で確かめたい, so that 単一の領域だけが使う業務固有の物が `util` に戻らない

#### Acceptance Criteria

1. When `npm run test:imports` is run, the 依存規則の検査 shall determine, for each module under `src/util/`, the set of 領域 of its importers that are outside `src/util/`
2. If a module under `src/util/` has importers from fewer than two distinct 領域 (including zero importers), then the 依存規則の検査 shall report it as a violation with ruleId `utilShared`, showing the module path and the 領域 found
3. The 依存規則の検査 shall not count an import from inside `src/util/` as a use from a 領域
4. If a module under `src/util/` has importers from two or more distinct 領域, then the 依存規則の検査 shall not report it as a `utilShared` violation
5. The 依存規則の検査 shall report a `utilShared` violation through the same 許容リスト mechanism as the other rules, so that a violation is accepted only when it is listed with a reason and an owner
6. When this spec is completed, the 許容リスト shall contain no entry whose ruleId is `utilShared`, and every module under `src/util/` shall satisfy Requirement 2.4

### Requirement 3: 骨格の一本化の検査

**Objective:** As a 開発者, I want 骨格（ページの枠）の置き場が一つだけであることを機械で確かめたい, so that 骨格を二つの場所に置く状態が再び生じない

#### Acceptance Criteria

1. When the test suite is run, the 静的な検査 shall fail if a directory `src/layout/` exists
2. When the test suite is run, the 静的な検査 shall fail if any module under `src/` imports a specifier that starts with `@/layout/`
3. When this spec is completed, the 骨格（`Baselayout`）shall exist as a 部品フォルダ under `src/components/layout/`
4. If the 検査の入力に `src/layout/` を含む一覧を与えた場合, then the 静的な検査 shall report the `src/layout/` entries as violations (negative example)

### Requirement 4: 許容リストの理由の記録

**Objective:** As a 開発者, I want 許容リストの各項目に、例外を認める理由が書かれていること, so that 例外が残った理由を後から確かめられる

#### Acceptance Criteria

1. The 許容リスト shall require each entry to have a `reason` field that is a non-empty string stating why the exception is allowed
2. If an entry in the 許容リスト has no `reason` field, or its `reason` is empty, then the 許容リストの読み込み shall report an error and the 依存規則の検査 shall exit with code 1
3. When `--emit-allowlist` is run, the 依存規則の検査 shall output each draft entry with an empty `reason`, and the draft shall not be accepted as a complete allowlist until each `reason` is filled in
4. When this spec is completed, the file `config/architecture/import-allowlist.json` shall be valid under the requirement 4.1 format

### Requirement 5: 規則の根拠と steering の一致

**Objective:** As a 開発者, I want 検査の規則と `structure.md` の規則の表が一致していること, so that 規則の根拠を steering だけから読める

#### Acceptance Criteria

1. The 依存規則の検査 shall give every RuleId a basis that names a section of `.kiro/steering/structure.md`
2. The `structure.md` の「依存規則の検査」の表 shall have one row for every RuleId that the 依存規則の検査 can report, including `libLayer`, `utilShared`, `typesLeaf`, and `typesOnly`
3. If the RuleId in the 検査 has no row in the `structure.md` table, or the table has a row for an unknown RuleId, then the 静的な検査 shall fail
4. The `structure.md` shall state the 規約 that a module under `src/util/` is placed there only when two or more 領域 use it, and that the 骨格 is placed only under `src/components/layout/`, and that `src/types/` is a leaf of type-only declarations, so that Requirement 2, Requirement 3, and Requirement 8 have a steering basis

### Requirement 6: 既存の検査との整合

**Objective:** As a 開発者, I want 新しい検査が既存の検査の方式と判定を変えないこと, so that 既存の違反の検出と既存の許容の扱いが従来どおり保たれる

#### Acceptance Criteria

1. The 依存規則の検査 shall keep the results of the rules `layer`・`uiInLib`・`cycle`・`crossRegionRelative`・`relativeDepth`・`jsExtension` unchanged by this spec
2. The new checks shall follow the existing style: 純粋な関数で判定し、負例のテストで検査が機能することを確かめ、所有 spec と根拠を持つ
3. Where a check is a static file check (Requirement 3), it shall follow the style of `tests/unit/scripts/componentLayout.test.ts`. The check may read file names, and may read the source text of files as plain text (for example to find an `@/layout/` import string), but it shall not execute or import any module under test

### Requirement 7: 完了の条件

**Objective:** As a 開発者, I want 完了時に検査と全体のテストが通ることを確かめられること, so that 組み替えの結果を検査で固定できる

#### Acceptance Criteria

1. When this spec is completed, `npm run test:imports` shall exit with code 0, with no unlisted violation and no error in the 許容リスト
2. When this spec is completed, `npm run test:all` shall exit with code 0
3. When this spec is completed, the number of passing tests in `npm run test:all` shall not be lower than the count recorded at the start of implementation
4. The implementation of this spec shall not change any user-visible behavior, API input or output, or generated file

### Requirement 8: `src/types/` の検査

**Objective:** As a 開発者, I want `src/types/` が他の層に依存しない葉であり、型だけを持つことを機械で確かめたい, so that 型の置き場が業務や部品の処理と混ざらない

#### Acceptance Criteria

1. When `npm run test:imports` is run, the 依存規則の検査 shall apply the `typesLeaf` rule to every import edge whose importer is under `src/types/`
2. If a module under `src/types/` has an import edge（`import type` を含む）to a module outside `src/types/`（`@/lib/`・`@/components/`・`@/util/`・`@/pages/`・相対パスで外へ出るものを含む）or to any external package（DOM の型などの外部パッケージを含む）, then the 依存規則の検査 shall report that import as a violation with ruleId `typesLeaf`
3. When `npm run test:imports` is run, the 依存規則の検査 shall apply the `typesOnly` rule to every `.ts` module under `src/types/`, and shall report with ruleId `typesOnly` every statement that is not a type-level declaration or a type-only import（値の `const`・`let`・`var`・`function`・`class`・`enum`・`namespace`、`export default`、値の `import`、`export *`、値の `export { ... } from` を含む）
4. The `typesOnly` rule shall accept only `type` 宣言・`interface` 宣言・`export type`・`export interface`・`import type`, and the `typesLeaf` and `typesOnly` violations shall be accepted only through the 許容リスト with a reason, as the other rules are
5. When this spec is completed, the 許容リスト shall contain no entry whose ruleId is `typesLeaf` or `typesOnly`, and every module under `src/types/` in the repository shall satisfy both rules
6. The `typesLeaf` and `typesOnly` checks shall each have negative examples that prove the check reports a violation
