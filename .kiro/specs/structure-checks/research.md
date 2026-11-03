# Research & Design Decisions

---

**Purpose**: `structure-checks` の設計判断の根拠を、実装の実測と上流 spec の決定から記録する。
---

## Summary

- **Feature**: `structure-checks`
- **Discovery Scope**: Extension（既存の `scripts/architecture/` と `tests/unit/scripts/` の検査に規則を加える）
- **Key Findings**:
  - 検査の基盤は `scripts/architecture/`（`scanModules`・`evaluateImportRules`・`findCycleViolations`・`allowlist`）。新しい規則は既存の `Violation`・許容リストの仕組みに乗せられる。
  - `libLayer` 規則は `lib-layers` が `rules.ts` に加える。本仕様はその有効化と完了時の確認を担う（規則の二重定義はしない）。
  - `util` の汎用性は辺の単位ではなく、モジュールごとの利用元の集合で決まるため、`evaluateImportRules`（辺ごとの規則）ではなく、`findCycleViolations` と同じ「グラフ全体を見る」形で加える。
  - 許容リストの項目には理由の欄が無い。理由の記録を要件にするため、項目の形式を拡張する必要がある。
  - `src/` の 400 行超のファイルは 17 件あり、そのうち `lib`・`util` は 7 件（`lib-large-files` の対象）、`components/` は 9 件、生成物（`src/client/openapi/client.ts`）は 1 件。400 行の検査は範囲外とした。

## Research Log

### 既存の検査の実測（2026-11-03）

- **Context**: 新しい規則の置き場と方式を決めるため、既存の検査を読んだ。
- **Sources Consulted**: `scripts/architecture/{rules,check-imports,allowlist,cycles,regions,importGraph}.ts`、`tests/unit/scripts/{componentLayout,steeringRegions,libRegionPairs,importRules}.test.ts`、`config/architecture/import-allowlist.json`（現在は `entries: []`）
- **Findings**:
  - `RULE_IDS`（`allowlist.ts` の内部定数）と `RuleId`（`rules.ts`）が二重に定義されている。規則を一箇所から取り出せるよう、`rules.ts` から export する必要がある。
  - `DEFAULT_OWNERS` は `Record<RuleId, string>` のため、規則を足すと既定の所有 spec の対応も必須になる。
  - `RULE_BASIS` は `importRules.test.ts` で「すべての規則に steering の節が紐づく」ことを確かめられている。
  - `emitAllowlist` は下書きを返し、`checkAllowlist` は `ruleId|from|specifier` のキーで照合する。
- **Implications**: 新しい規則は `rules.ts`（`RuleId`・`RULE_BASIS`）、`allowlist.ts`（`DEFAULT_OWNERS`・理由の検証）、`check-imports.ts`（違反の合流）に加える。

### 利用元の実測（util の現状と移動後の見込み）

- **Context**: `util` の規則が、現状と `util-placement` 完了後に何件を違反にするかを確かめる。
- **Sources Consulted**: `src/util/` の 25 ファイル、`.kiro/specs/util-placement/design.md` の移動の対応表
- **Findings**:
  - 現状の 25 ファイルのうち、`util-placement` が移動する 20 件（単一領域の 14 件、`util/share/` の 5 件、型だけの `util/outcome.ts` の 1 件）は、移動しなければ `utilShared` の違反になりうる。残す 5 件は後述のとおり二つ以上の領域から使われる。
  - 移動後に `src/util/` に残る 5 件（`http`・`formData`・`utf8Bytes`・`padTwoDigits`・`waitForImageLoad`）は、いずれも二つ以上の領域から使われる。（`util-placement` の決定により `outcome` は `src/types/` へ移り、`formData` は型のみ移る。旧記録の 19 件・6 件を改めた。）
- **Implications**: `util-placement` が完了すれば、`utilShared` の違反は 0 件になる。実装は `util-placement` の後に行い、許容リストに項目を残さない。

### 400 行の検査の要否

- **Context**: brief は 400 行の上限の検査を「design で必要性を判断する」としていた。
- **Sources Consulted**: `wc -l` の実測（`src/` 内の `.ts`・`.tsx`・`.astro`）、`.kiro/specs/lib-large-files/design.md`、`roadmap.md` の Phase 5 の対象
- **Findings**:
  - 400 行超は `src/` で 17 件。うち `lib`・`util` は 7 件（`lib-large-files` が分割する）、`components/` は 9 件（`Dropdown`・`ThreadComposer`・`Settings` など）、生成物 `src/client/openapi/client.ts` は 1 件。
  - roadmap の Phase 5 は、この検査を範囲に挙げていない（`lib`・`util`・骨格の配置の検査）。
- **Implications**: 400 行の検査は本仕様に含めない。`lib`・`util` だけに掛けると、`components/` の分割が済むまで規則が不揃いになるため。必要が生じたら別の spec で扱う。

### 骨格の検査の方式

- **Context**: `src/layout/` が無いことを、どの方式で確かめるか。
- **Sources Consulted**: `tests/unit/scripts/componentLayout.test.ts`（ファイル名の一覧に対する静的な検査）、`src/pages/*.astro` の `@/layout/` の import（現状 13 件）
- **Findings**: `@/layout/` の import は `test:imports` では「解決できない import」として失敗するが、規則の意図（骨格の置き場は一つ）を明示するには、専用の静的な検査が分かりやすい。
- **Implications**: `componentLayout` と同じ方式（ファイル一覧と本文の文字列に対する静的検査、モジュールを読み込まない）で書く。

## Architecture Pattern Evaluation

| Option                               | Description                                    | Strengths                                                | Risks / Limitations                | Notes                    |
| ------------------------------------ | ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------- | ------------------------ |
| 辺の規則に加える                     | `evaluateImportRules` の `RULES` に入れる      | 既存の形と同じ                                           | 利用元の集合を辺ごとに判定できない | 不採用                   |
| グラフ全体の規則を別モジュールに置く | `cycles.ts` と同じ形で `utilSharing.ts` を置く | 利用元の集合を一度に数えられる。許容リストの仕組みに乗る | 関数が一つ増える                   | 採用                     |
| 骨格を import 規則で検査する         | `@/layout/` を規則に加える                     | 既存の仕組みで足りる                                     | 「解決できない import」と重複する  | 不採用（静的検査で代替） |

## Design Decisions

### Decision: util の規則の判定単位

- **Context**: `util` の汎用性（要件 2）を、どの単位で数えるか。
- **Alternatives Considered**:
  1. 辺ごとに利用元の領域が二つ以上あるかを見る（辺の規則）
  2. モジュールごとに、`src/util/` の外からの利用元の領域の集合を作る（グラフ全体の規則）
  3. 利用元の数（件数）で数える
- **Selected Approach**: 2。`src/util/` の外からの利用元（辺の `from`）を `regionOf` で領域に変換し、集合の大きさが 2 以上のモジュールだけを通す。
- **Rationale**: 同じ領域の複数ファイルからの利用は一つの領域と数える（要件 2.2 の「領域」）。`util` の中からの利用は領域として数えない（要件 2.3）。
- **Trade-offs**: `src/pages/` の直下のファイルは全て `pages` という同じ領域になる。`pages/` だけから使われる `util` は違反になる。現状の 5 件には該当しない。
- **Follow-up**: 実装時に、`pages/` だけから使われるモジュールを負例のテストで固定する。

### Decision: 許容リストの理由の欄

- **Context**: 要件 4 は、許容の項目ごとに理由を求める。
- **Alternatives Considered**:
  1. 項目に `reason` を必須で加え、空の理由を読み込み時のエラーにする
  2. 理由を別ファイル（Markdown）に書く
  3. 理由を JSON のコメントとして扱う（JSON にはコメントが無いため不可）
- **Selected Approach**: 1。`reason` は非空の文字列の必須項目とする。下書き（`--emit-allowlist`）は `reason` を空で出し、空のままでは読み込みが失敗する。
- **Rationale**: 既存の形式（`version`・`entries`）を保ち、検査が理由の有無を機械で確かめられる。
- **Trade-offs**: 既存の下書きの利用手順が「理由を書いてから読み込む」に変わる。許容リストが空のため、既存の項目への影響は無い。

### Decision: `RULE_IDS` の単一の定義

- **Context**: `allowlist.ts` と `rules.ts` が規則の一覧を二重に持っている。
- **Selected Approach**: `rules.ts` で `RULE_IDS`（`as const`）を定義し、`RuleId` をそこから導き、`allowlist.ts` は import して使う。`steeringRules` の検査も同じ一覧を使う。
- **Rationale**: 規則を足したとき、一覧の更新漏れを型と検査の両方で検出できる。
- **Trade-offs**: `rules.ts` の export が一つ増える。検査の振る舞いは変わらない。

## Risks & Mitigations

- 上流の `util-placement` が完了する前に実装すると、`utilShared` の違反が残る — 実装は上流の完了後に行い、着手時に `npm run test:imports` の違反が 0 件であることを確かめる。
- `structure.md` の表の形式が変わると、規則の一覧との照合が壊れる — 照合は表の一列目の名前だけを使い、見出しと行の形を負例で固定する。
- 許容リストの形式の変更で既存のテストが落ちる — `importRules.test.ts` の許容リストの節を、理由の欄を含む形に更新する。

## References

- `.kiro/specs/lib-layers/design.md` — `libLayer` 規則と層の対応表
- `.kiro/specs/util-placement/design.md` — `util` の移動の対応表と残す 5 件
- `.kiro/specs/layout-home/design.md` — 骨格の配置 `src/components/layout/Baselayout/index.astro`
- `.kiro/specs/lib-large-files/design.md` — 400 行超の 7 件の分割
