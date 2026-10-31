# Research & Design Decisions

---

**Purpose**: 部品の入れ子の規則と common の分類について、実測と代替案の比較、判断の根拠を記録する。
**Scope**: 実装は 2026-11-03 に済んでおり、本ファイルは、その変更を仕様として確定するための根拠である。
---

## Summary

- **Feature**: `src-component-nesting`
- **Discovery Scope**: Extension（既存の構造の規則の拡張。新しい外部依存はなし）
- **Key Findings**:
  - 部品フォルダ 94 件のうち、子フォルダに入っていたのは 4 件（`ThreadComposer` の子）だけだった。
  - 利用元がすべて一つの親の中にある部品は、規則を全件に当てはめると 37 件になる。そのうち 19 件は領域をまたぐ移動になる。
  - `common/` の 23 件は、役割で 6 つの分類（dialog・select・input・list・media・section）に分ける。根に残すのは、複数の分類から使われる `Loading`（16 件の利用元）と `InlineIcon`（6 件）。
  - UI から hooks の型を import する逆向きの依存が 1 件あった（SuggestPopover → hooks/useSuggest）。型を `rules/` に移して解消した。

## Research Log

### 利用関係の実測

- **Context**: 「利用元がすべて一つの親の中にある部品」を機械的に判定できるかを確かめる必要があった。
- **Sources Consulted**: `src/` 配下の `.ts`・`.tsx`・`.astro` の import 文（`from`・`import()`・`vi.mock`）を正規表現で解析し、解決先のファイルから部品フォルダ（`index.tsx`/`index.astro` を持つ最も深いフォルダ）を求めた。
- **Findings**:
  - 利用元の集合は、部品ごとに一意に求まる。import 文は静的で、判定の入力として十分だった。
  - 親の判定は、子の移動で親のパスが変わるため、移動を反映して繰り返す必要があった（反復で固定点まで計算）。
- **Implications**: 規則は、機械的な検査に乗せられる（要件 2.1・2.2 の確認）。

### 規則の適用範囲の比較

- **Context**: 規則をどこまで当てはめるかで、移動件数と構造が変わる。
- **Sources Consulted**: 上の実測の結果。
- **Findings**:

| 案                       | 移動 | 領域をまたぐ移動 | ThreadComposer の配下 | 最深 |
| ------------------------ | ---- | ---------------- | --------------------- | ---- |
| 全件（基盤を除く）       | 36   | 18               | 18                    | 5 段 |
| 同じ領域の中だけ         | 20   | 0                | 8                     | 4 段 |
| 直下の部品だけを親にする | 26   | 11               | 10                    | 5 段 |

- 「全件」を採用した。所有関係を import どおりに写せるため、「ThreadComposer とそれ以外」という特例を作らずに済む。
- 「同じ領域の中だけ」は、領域をまたぐ移動を避けられるが、画像・動画の選択部品が composer の所有であるという実態を表せない。
- **Implications**: 規則は「全件」で定める。移動の件数は、実装後に 37 件（基盤の扱いを決めたあとの数）になった。

### 基盤（common・layout）の定義

- **Context**: `common/` の部品は、利用元が一つでも子にするべきか、基盤として残すべきか。
- **Findings**:
  - 基盤を「`common/` の汎用の部品（呼び出し側の文言と状態を受け取り、業務を持たない）」と定義した。
  - 利用元が一つの `common/` 部品は、6 件あった。個別に判断した結果は下表のとおり。

| 部品            | 利用元                 | 判断                                                                                                                  |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| ChoiceQuestion  | SurveyDialog（1）      | 汎用（文言と状態を外から受け取る）。`common/select/` に残す                                                           |
| FloatingBox     | SuggestPopover（1）    | 汎用プリミティブ（Overlay と同じ性格）。`common/dialog/` に残す                                                       |
| NavigationBar   | DraftListPanel（1）    | 汎用（業務を持たない）。`common/list/` に残す                                                                         |
| ThemeModeSelect | Settings（1）          | 汎用。ただし、ラベルが `settings.theme.*` のキーを直接使う。`common/select/` に残す（ラベルの扱いは Out of Boundary） |
| Spinner         | Loading（1）           | ロジックを持たない。`Loading` に統合する                                                                              |
| LanguageSelect  | ThreadSegmentForm（1） | 投稿言語の一覧を持つ業務の部品。`composer/ThreadComposer/ThreadSegmentForm/` の子にする                               |

- **Implications**: 基盤は「汎用」の定義で決まる。判断の根拠は、部品の公開の型（props）が文言と状態だけで構成されているかにある。

### common の分類

- **Context**: 23 件が平らに並んでいて、依存の関係が読めない。
- **Findings**:
  - 内部依存（common の中での import）の辺は 15 本。連結した塊は次のとおり。
    - `Overlay`・`FloatingBox`・`ChoiceDialog`（→ Overlay・Loading）・`ConfirmDialog`（→ ChoiceDialog・Overlay・Loading）
    - `Dropdown`（→ ListboxOption・ComponentList）・`LocaleSelect`・`ThemeModeSelect`・`AutoPopupTargetSelect`（→ Dropdown・InlineIcon）
    - `NavigationBar`（→ ComponentList）・`InfiniteScrollSentinel`（→ Loading）
    - `ChoiceQuestion`（→ Checkbox・RadioButton）
  - 内部依存のない部品は、`Avatar`・`MediaThumb`・`Collapsible`・`TabButtons`・`CountedTextInput`・`ToggleSwitch`・`Checkbox`・`RadioButton`・`FloatingBox`・`InlineIcon`・`ListboxOption`・`Loading`・`Overlay`・`ComponentList`。
  - 根に残すのは、複数の分類から使われる `Loading`（16 件の利用元）と `InlineIcon`（6 件）。
- **Implications**: 分類の間の依存は、役割の分類をまたいでもよいが、循環は作らない（検査で確認）。

### 分類フォルダの扱い

- **Context**: 分類フォルダは、部品フォルダでも子フォルダでもない新しい種類のフォルダになる。
- **Alternatives Considered**:
  1. 分類フォルダを作らず、接頭辞で分ける（例: `DropdownSelect`）— 名前が長くなり、依存の塊が見えない
  2. 分類フォルダを作る（採用）— 塊がフォルダで見える。分類フォルダは部品を直接持たない
- **Implications**: 分類フォルダは、`componentLayout` の検査（部品フォルダの外のソースファイル）の対象外。ただし、分類フォルダに部品のファイルを直接置くことは禁止する（要件 4.7）。
- **Region side-effect**: 領域の判定（`regionOf`）は `components/<a>/<b>` の 4 段目以降を部品の領域にする。分類フォルダ `common/dialog/` の部品は、`components/common/dialog` の領域になる。分類をまたぐ相対 import は、領域の規則（`crossRegionRelative`）で `@/` に書き換える。書き換えは src-import-style の規則に従う。

### 逆向きの依存の解消（SuggestPopover）

- **Context**: 表示の部品（SuggestPopover）が、hooks の型（`hooks/useSuggest.ts` の `SuggestCandidate`）を import していた。UI が hooks を参照する向きは、判断の層と UI の層の依存の向きに反する。
- **Alternatives Considered**:
  1. 型を SuggestPopover の内側に複製する — 型の同期が必要になる
  2. 型を `rules/suggestCandidate.ts` に移す（採用）— `rules/` は値と型を持つが React に依存しない。hooks と UI の両方が、rules を参照できる
- **Implications**: `rules/suggestCandidate.ts` は、`rules/suggestHashtags.ts` と `@/lib/atproto/suggest`（型）だけに依存する。

### 循環検査の結果

- **Context**: `src-cycles` は、components の循環（ThreadComposer ↔ SuggestPopover・VideoPicker）を対象外にしていた。
- **Findings**: 変更後、循環検査（強連結成分）は 0 件。
- **Implications**: 型の移動で、対象外にしていた循環は解消された（検査で確認）。

### 既存の検査の前提

- **Sources**: `tests/unit/scripts/componentLayout.test.ts`（部品フォルダの外のソースファイルの検査）、`tests/unit/scripts/steeringRegions.test.ts`（領域の一覧の検査）、`scripts/architecture/`（import 検査・循環検査）。
- **Findings**:
  - `componentLayout` は、入れ子の部品フォルダを「部品フォルダの中」と判定する（祖先を辿る）。入れ子の変更で検査の結果は変わらない。
  - `steeringRegions` は、`src/components/` の直下のフォルダ名が `structure.md` に現れることを確かめる。分類フォルダは直下の名前として現れないため、一覧の対象は直下の領域のみ。
  - import 検査の規則（`crossRegionRelative`・`relativeDepth`）は、移動後も違反 0 件。
- **Implications**: 既存の検査は、規則の変更を反映させるための変更を要さない。ただし、`structure.md` の領域の一覧（`video`・`survey` の削除）は更新が必要。

## Architecture Pattern Evaluation

| Option                       | Description                | Strengths                             | Risks / Limitations                                    | Notes                    |
| ---------------------------- | -------------------------- | ------------------------------------- | ------------------------------------------------------ | ------------------------ |
| 利用元で決める入れ子（採用） | 利用元がすべて親の中なら子 | import から機械的に決まる。特例がない | 移動件数が多い（37 件）。ThreadComposer の配下が増える | 規則を steering に定める |
| 領域内の入れ子のみ           | 同じ領域の中だけ子にする   | 領域をまたぐ移動がない                | 画像・動画の選択部品の所有が表せない                   | 移動 20 件               |
| 現状維持                     | 平らな並びのまま           | 作業なし                              | 利用関係が読めない                                     | 不採用                   |

## Design Decisions

### Decision: 入れ子の規則は利用元で決める

- **Context**: 要件 1（利用元の内側に置く規則）。
- **Alternatives Considered**: 全件・同じ領域の中だけ・直下のみ（上の比較）。
- **Selected Approach**: 全件。基盤（`common/`・`layout/`）は対象外。
- **Rationale**: import が所有関係を表す。特例を作らずに、どの親の中で使われるかが読める。
- **Trade-offs**: 移動が多く、ThreadComposer の配下が 19 件になる。利用関係の複雑さは、フォルダとして見えるようになる。
- **Follow-up**: 規則の変更（例: 件数の上限）は、revalidation trigger として扱う。

### Decision: common の分類は役割で決める（改訂）

- **Context**: 要件 4。
- **Selected Approach**: 役割で 6 つの分類（dialog・select・input・list・media・section）と、根（Loading・InlineIcon）。
- **Rationale**: 利用者（開発者・コントリビュータ）が部品を探すときに読む役割の名前で分ける。依存の連結成分は、分類の根拠ではなく、分類の検証に使った。初版は依存の塊（overlay・select・list・form・display）で分けたが、名前が役割を表さず分かりにくいとの指摘を受けて改訂した。
- **Trade-offs**: 役割の分類は依存の塊と一致しない（例: `select/` の `ChoiceQuestion` は `input/` の部品を使う）。分類をまたぐ依存は許容する（循環は作らない）。

### Decision: Spinner は Loading に統合

- **Context**: 要件 5.1・5.2。
- **Selected Approach**: スピナーのマークアップと CSS を `Loading` に移す。`Spinner` フォルダは削除。
- **Rationale**: 利用元が Loading だけで、ロジックがない。統合で、見た目は変わらない。
- **Follow-up**: 他の部品がスピナーを必要とした時点で、`common/` に戻す判断をしてよい。

### Decision: SettingsDialog は削除

- **Context**: 要件 5.3・5.4。
- **Rationale**: 利用元が 0 件。`settings.astro` は `Settings` を直接使う。
- **Follow-up**: 設定画面の e2e（既存の手順）で、表示が変わらないことを確かめる。

## Risks & Mitigations

- **移動の件数が多く、取りこぼしがある** — 移動と import の書き換えを、計画（移動元と移動先の対応表）から機械的に行い、型検査・import 検査・全テストで確かめる。
- **ThreadComposer の配下が増え、読みにくくなる** — 規則を steering に明記し、README の図で親子関係を示す。
- **分類フォルダが、部品の検査と衝突する** — 分類フォルダに部品のファイルを置かない（要件 4.7）。検査の対象は部品フォルダの外のソースファイルなので、分類フォルダ自体は検査されない。
- **既存の spec（`settings`・`post-composition`・`surveys`）の本文が旧い配置を指す** — それぞれの spec の本文は履歴として残す。本 spec の範囲外。

## References

- `.kiro/steering/structure.md` — 部品・領域の規則（本 spec で追記する）
- `.kiro/specs/src-folder-layout/` — 部品フォルダ外の例外の一覧（1.3）
- `.kiro/specs/src-import-style/` — `@/` と相対 import の規則
- `.kiro/specs/src-cycles/` — 循環検査
