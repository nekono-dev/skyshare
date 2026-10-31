# Research & Design Decisions

---

**Purpose**: 依存規則の検査を作るための調査の記録と、設計判断の根拠を残す。
---

## Summary

- **Feature**: `src-import-rules`
- **Discovery Scope**: Extension（既存の `scripts/` と CI への追加）。新規の外部依存は導入しない方針で調べた。
- **Key Findings**:
  - 既存の CI の test ジョブ（`deploy.yaml`）は `push`（`develop`・`release/**`）でだけ動く。PR 単位で単体テストを回すワークフローはない。
  - lint 系のツール（ESLint・dependency-cruiser）は未導入。`typescript` 5.9.3 は直接の devDependency として既にある。
  - dependency-cruiser 18.7.0 は `.astro` を解析できない（対応拡張子は js・ts（別の変換器が必要）・svelte・vue）。本リポジトリの `src/pages/` と `src/components/` の大半は `.astro` である。
  - 既知の違反の許容と減少の確認は、dependency-cruiser に baseline（`--ignore-known`）と shrink-only の仕組みがある。ただし同じ機能を自前の許容リストで作っても、要件 6 の形式（所有 spec・stale の報告）を満たすには追加の作業が要る。

## Research Log

### 既存の検査と CI

- **Context**: 検査をどのワークフローで止めるかを決めるため。
- **Sources Consulted**: `.github/workflows/deploy.yaml`・`e2e.yaml`・`preview.yaml`（トリガーと test ジョブの手順を確認）。
- **Findings**:
  - `deploy.yaml`: `push` で `release/**` と `develop` に動く。test ジョブが `test:type`・`test:unit`・`test:component`・`test:route`・`test:render`・`test:lexicon` を実行し、デプロイの前提になる。
  - `e2e.yaml`: `pull_request` で動く（E2E のみ）。
  - `preview.yaml`: `push` で `dev/**` に動く（プレビューの配備）。
- **Implications**: 検査は `deploy.yaml` の test ジョブに組み込む。PR の段階で止める仕組みは、既存にないため本 spec では作らない（設計の「未決定事項」に記録）。

### `.astro` ファイルの import 抽出

- **Context**: `src/pages/` と `src/components/` の `.astro` にも規則を適用する必要がある。
- **Sources Consulted**: リポジトリ内の計測（後述の「実測」）。`typescript` 5.9.3 の `createSourceFile`。
- **Findings**: `.astro` の import は先頭の `---` で囲まれたフロントマターにある。フロントマターを切り出して TypeScript として解析すると、101 件の import 辺を取れた。`@astrojs/compiler` を使う必要はない。
- **Implications**: フロントマターの切り出しは自前の数行で行う。新しい依存は要らない。

### 既存ツールの比較（build vs adopt）

- **Context**: 規則の検査と既知の違反の許容を、既存のツールで賄えるかを確かめるため。
- **Sources Consulted**: dependency-cruiser 18.7.0（npm のパッケージ、`--info` の出力、`depcruise-baseline`・`--ignore-known`・shrink-only の記述を確認。WebSearch の結果も参照）。

| 候補                                | 規則           | 循環               | 型だけの import     | `.astro`                       | 許容リスト                         | 新しい依存                           | 判定                                                            |
| ----------------------------------- | -------------- | ------------------ | ------------------- | ------------------------------ | ---------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| 自前（TypeScript API）              | 自前で記述     | 自前（強連結成分） | `isTypeOnly` で判定 | フロントマターを切り出して解析 | 自前（所有 spec・stale を持てる）  | なし（`typescript` と `tsx` は既存） | 採用                                                            |
| dependency-cruiser                  | 宣言的に記述   | 組み込み           | 設定で対応可        | 非対応                         | baseline と shrink-only が組み込み | あり                                 | 不採用。`.astro` を別の仕組みで扱うと、検査が 2 系統に割れる    |
| ESLint（eslint-plugin-import など） | 組み込みと自前 | 一部               | 対応あり            | 別のパーサーが必要             | 抑制ファイルは別に管理             | ESLint 一式（未導入）                | 不採用。ESLint の一式を新たに導入する割に、得られるものが少ない |
| madge                               | 規則なし       | 組み込み           | 弱い                | 非対応                         | なし                               | あり                                 | 不採用。規則の検査ができない                                    |

- **Implications**: 自前の TypeScript API による検査を採用する。許容リストの形式は要件 6 に合わせて自前で定義する。

### 実測（リポジトリ読み取りのみ・scratchpad の試作）

- **Context**: 規則ごとの違反数を確かめ、許容リストの規模を見積もるため。
- **Method**: `src/` 内の `.ts`・`.tsx`・`.astro` を走査し、import 辺を解決して規則を適用した（`src/client/openapi/` と `.d.ts` を除外）。
- **Findings**（辺の数）:
  - 対象ファイル 389、import 辺 1,113
  - `lib` → `components`・`pages`、`util` → `lib`・`components`・`pages`: 0 件
  - `lib` の `react` 系の import: 7 件
  - 領域をまたぐ相対 import: 17 件（同じ領域内の相対 import は許可されるため、brief の「相対 311 件」より少ない）
  - `../` が 3 段以上の相対 import: 39 件（すべて `lib/api/schema/`）
  - `.js` 拡張子の付いた import: 27 件（すべてエイリアス `@/`）
  - 循環の辺（型のみを含む）: 32 件、18 ファイル、強連結成分 2 つ（`lib/i18n` 16 ファイル、`lib/settings` 2 ファイル）
- **Implications**: 許容リストは約 120 件になる（規則ごとの件数の合計）。項目はすべて、後続の spec（`src-cycles`・`src-lib-ui-boundary`・`src-import-style`）が減らす。

### 型だけの import の循環

- **Context**: 要件 5 は型だけの import も検査対象と定める。
- **Findings**: `lib/i18n/messages/*` と `translate.ts` の循環は、すべて `import type` を含む。実行時の循環はない。
- **Implications**: 型だけの辺も循環の検査に含める（要件どおり）。実行時の循環と型の循環は区別せず、同じ許容リストで扱う。

## Architecture Pattern Evaluation

| Option                               | Description                                            | Strengths                                     | Risks / Limitations                      | Notes                          |
| ------------------------------------ | ------------------------------------------------------ | --------------------------------------------- | ---------------------------------------- | ------------------------------ |
| 単一の TypeScript スクリプト（採用） | 走査・解決・規則・循環・許容を 1 つのツールで行う      | 新しい依存がない。`.astro` も同じ経路で扱える | 規則と循環の検査を自前で保守する         | `scripts/architecture/` に置く |
| 外部ツールの併用                     | dependency-cruiser で `.ts` を、自前で `.astro` を扱う | 規則の記述が宣言的                            | 2 系統の許容リストと出力を持つことになる | 不採用                         |

## Design Decisions

### Decision: 検査の実装は自前の TypeScript API とする

- **Context**: 要件 1〜6 は、`.astro` を含む走査、型だけの import、所有 spec 付きの許容リスト、stale の報告を必要とする。
- **Alternatives Considered**:
  1. dependency-cruiser — 規則と循環と baseline が組み込みだが、`.astro` を解析できない。
  2. ESLint — 導入の範囲が広い。
  3. 自前の TypeScript API — 依存を増やさず、要件をそのまま表せる。
- **Selected Approach**: 自前の TypeScript API。`typescript` で各ファイルを解析し、`.astro` は先頭のフロントマターを切り出して解析する。
- **Rationale**: 既存の依存だけで要件を満たせる。`.astro` を同じ経路で扱え、検査の結果の形式を 1 つに保てる。
- **Trade-offs**: 規則と循環の検査を自前で保守する。その分、テストで振る舞いを固定する（`design.md` の Testing Strategy）。
- **Follow-up**: 採用後も、要件 1〜6 の検査結果をテストで確かめる。

### Decision: `.js` 拡張子は付けない方式で統一する（要件 4.4 の設計での確定）

- **Context**: 要件 4.4 は、`.js` 拡張子の方式を設計で定めるとした。実装は混在しており（`@/` の `.js` が 27 件）、steering の例（`structure.md` の Import Organization）は `.js` を付けている。
- **Alternatives Considered**:
  1. `.js` を付ける — steering の例と一致する。ただし、相対 import は付いていないため、相対と絶対で方式が割れる。
  2. `.js` を付けない — 相対 import と同じ方式で揃う。`@/` の `.js` 付きは 27 件だけで、変更は少ない。
- **Selected Approach**: 拡張子を付けない。steering の例を、この方式に合わせて書き換える（要件 8.1）。
- **Rationale**: 相対 import が付けていないため、全体で 1 つの方式に揃う。変更は 27 件。
- **Trade-offs**: steering の例を変える必要がある。
- **Follow-up**: `src-import-style` の作業で 27 件を直す。`npm run test:type` と `npm run build` で解決を確かめる。

## Risks & Mitigations

- **許容リストが約 120 件と大きい** — 各項目に所有 spec を持たせ、後続の spec が減らす。stale の報告で、減っていないことを見せる。
- **PR の段階で検査が動かない** — 既存の CI に PR 単位の test ワークフローがない。デプロイ前の test ジョブで止める。PR の段階の検査は、未決定事項として残す。
- **`src/client/openapi/` の除外で、生成物を通る循環を見逃す** — 生成物は手で編集せず、本 spec の対象外とする。循環の検査は生成物を除いて行う（設計に明記）。
- **TypeScript の版の変更で解析結果が変わる** — `typescript` は既存の devDependency で、版を固定している。版の変更時は検査のテストで確かめる。

## References

- `.github/workflows/deploy.yaml` — test ジョブの構成と `push` のトリガー（リポジトリ内）
- `.kiro/steering/structure.md` — 規約の正（依存の向き・領域・`@/` の統一）
- `.kiro/specs/src-import-rules/requirements.md` — 要件 1〜9
- dependency-cruiser（npm、18.7.0）— `--info` の対応言語と拡張子の一覧を確認
