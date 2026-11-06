# Research & Design Decisions

---

**Purpose**: 骨格（`Baselayout.astro`）の移動に関する調査と設計判断の根拠を残す。
---

## Summary

- **Feature**: `layout-home`
- **Discovery Scope**: Simple Addition（配置の変更。新しい依存・外部連携・振る舞いの変更はない）。Extension としての軽い探査（import 経路と検査の確認）を実施した。
- **Key Findings**:
  - 骨格の参照元は `src/pages/` の 13 ファイルで、すべて `@/layout/Baselayout.astro` を import している。
  - `Baselayout.astro` の import は `@/components/layout/Metadatas/index.astro` ほか `@/` の絶対 import だけで、移動後も解決先が変わらない。相対 import はない。
  - `tests/unit/scripts/componentLayout.test.ts` は、`src/components/` の部品フォルダ（`index.tsx` または `index.astro` を持つフォルダ）の外にあるソースファイルを違反とする。直置きの `components/layout/Baselayout.astro` は例外一覧に無いため違反になる。
  - `Baselayout` を直接 import する render テストは存在しない（`tests/render/components/AnalyticsTag.test.ts` は `components/layout/AnalyticsTag` を import する）。

## Research Log

### 部品規約と骨格の置き場

- **Context**: brief は「`components/layout/` へ移す」と定める。一方、`structure.md` は 1 部品 1 フォルダを定め、`componentLayout` が直置きを検査する。
- **Sources Consulted**: `.kiro/steering/structure.md`（部品・共通の節）、`tests/unit/scripts/componentLayout.test.ts`、`src/layout/Baselayout.astro`。
- **Findings**: 骨格の部品は `components/layout/` 直下のフォルダ（`Sidebar/`・`FooterNav/` など）に置かれている。`structure.md` は `layout` を基盤として、利用元の内側に置く規則の対象外としている。
- **Implications**: 置き場は `components/layout/Baselayout/index.astro` とする。`components/layout/` の直下に区切りの無い `.astro` を置くと検査が失敗するため、部品フォルダの形を取る。

### 参照の更新範囲

- **Context**: 旧パスの参照を漏れなく更新する必要がある。
- **Sources Consulted**: `grep` による `src/layout`・`@/layout`・`layout/Baselayout` の全文検索（`.kiro/specs/` を除く）。
- **Findings**:
  - コードの import: `src/pages/` の 13 ファイル（`index`・`help`・`feedback`・`post`・`settings`・`privacy`・`jump`・`accounts`・`login`・`entries/index`・`entries/[slug]`・`entries/sample`・`posts/[dbIndex]/[slug]`）。
  - 文書の旧パス: `src/components/layout/README.md` の 12 行目（`src/layout/Baselayout.astro` と記述）。
  - コメントの `Baselayout` の言及（`LoginForm`・`FooterNav`・`EntryDetailView`・`settings`）は、名前のみで旧パスを含まないため変更しない。
  - `docs/DEVELOP.md` の `Baselayout` の言及も名前のみで、変更しない。
- **Implications**: 変更対象はコードの import 13 件と `components/layout/README.md` の 1 箇所、および steering の骨格の記述（`roadmap.md` の探査の根拠）。

### 出力の一致の確かめ方

- **Context**: 出力と振る舞いを変えないことを機械で確かめる方法が必要である。
- **Findings**: 既存の render テストは骨格の出力を対象にしていない。移動の前後で `npm run build` の HTML を比較すれば、出力の一致を直接確かめられる。
- **Implications**: 移動の前に `dist/` の HTML を退避し、移動の後に比較する。比較の対象は全ページとし、差分が無いことを完了条件にする。

## Architecture Pattern Evaluation

| Option              | Description                                    | Strengths                                         | Risks / Limitations                | Notes  |
| ------------------- | ---------------------------------------------- | ------------------------------------------------- | ---------------------------------- | ------ |
| A: 直置き           | `components/layout/Baselayout.astro`           | brief の文言どおり                                | `componentLayout` の検査に違反する | 不採用 |
| B: 部品フォルダ     | `components/layout/Baselayout/index.astro`     | 規約と検査に適合する。`layout` の他の部品と同じ形 | import のパスが一段深くなる        | 採用   |
| C: 別の基盤フォルダ | `components/layout/base/Baselayout.astro` など | 直置きを避けられる                                | 部品規約に無い形を作る             | 不採用 |

## Design Decisions

### Decision: 骨格の置き場を部品フォルダの形にする

- **Context**: brief は `components/layout/` への移動を決定済みとしている。`componentLayout` は部品フォルダの外のソースを違反とする。
- **Alternatives Considered**:
  1. `components/layout/Baselayout.astro`（直置き）
  2. `components/layout/Baselayout/index.astro`（部品フォルダ）
- **Selected Approach**: 2 を採用する。置き場は `components/layout/` 配下のままで、brief の決定（骨格を `components/layout/` へ一本化する）と矛盾しない。
- **Rationale**: 規約（steering の部品の規約と検査）の正は steering で、既存の検査を変えずに済む。
- **Trade-offs**: import のパスが `@/components/layout/Baselayout/index.astro` と一段長くなる。
- **Follow-up**: 実装の後、`componentLayout` のテストが通ることを確かめる。

### Decision: 移動の方法

- **Context**: 履歴を残す必要がある（brief の決定）。
- **Selected Approach**: `git mv src/layout/Baselayout.astro src/components/layout/Baselayout/index.astro` で移動し、中身は変えない。移動の後に `src/layout/` が空であることを確かめ、残さない。
- **Follow-up**: 移動の後、`src/layout/` が存在しないことを確かめる。

## Risks & Mitigations

- 出力の差分（`<head>` の順序・クラス名など） — 移動の前に `dist/` の HTML を退避し、移動の後に全ページを比較する。
- 旧パスの参照の取りこぼし — 移動の後に `@/layout`・`src/layout` を全文検索し、`.kiro/specs/` を除いて 0 件であることを確かめる。
- 検査の失敗（部品フォルダの形） — `componentLayout` のテストを移動の後に実行する。

## References

- `.kiro/steering/structure.md` — 部品の規約（1 部品 1 フォルダ・基盤の扱い）
- `tests/unit/scripts/componentLayout.test.ts` — 部品フォルダの外のソースの検査
