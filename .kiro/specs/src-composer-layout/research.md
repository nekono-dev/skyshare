# 調査ログと設計判断

## Summary

- **Feature**: `src-composer-layout`
- **Discovery Scope**: Extension（`components/composer/ThreadComposer/` の内部の配置の整理。振る舞いは変えない）
- **Key Findings**:
  - 直下の `.ts` は 10 件（フック 6・判断 4）。配線は `index.tsx` と CSS。子フォルダ 4 件（部品）は各 2 ファイル。
  - 外部からの参照は 4 箇所（`composer/SuggestPopover` が `useSuggest` の型、`video/VideoPicker` が `segments` の型、`ThreadSegmentForm` が `segments`・`useSuggest`・`useKeyboardRows`、テスト 4 ファイル）。いずれも `@/` の絶対パス。
  - フックと判断の相互の参照は、同じ部品の中の相対 import（`./segments` など）。移動の後は、フォルダをまたぐ `../` の参照になる（深さは 1 段で、3 段未満の規則に収まる）。
  - 構造の検査（`composerSplit.test.ts`）は、判断とフックのファイル名を、直下のパスで列挙している。移動後のパスに更新する。
  - steering（`structure.md` 42 行目）は「判断は同じフォルダの `camelCase.ts`」と定める。移動には、この規則の改訂が要る。

## Research Log

### 移動の方法（`git mv` と import の書き換え）

- **Context**: 要件 1.1〜1.4 の配置を、履歴を残して移す。
- **Findings**: `git mv` は、履歴（`git log --follow`）を残す。移動の後の型検査（`tsc --noEmit`）が、取りこぼした import を検出する。
- **Implications**: 移動と書き換えを 1 段階で行い、型検査で確かめる。

### 参照の形（相対か `@/` か）

- **Context**: 参照の書き方を統一する。
- **Findings**: 部品の内部は相対 import（`./`）が既存の慣習。外部（部品の外）は `@/` の絶対パス。`steering` の「領域をまたぐ相対 import は禁止」は、同じ部品（`ThreadComposer`）の内部の `../` を許す（領域は `composer`、部品は `ThreadComposer`）。
- **Implications**: 部品の内部（`index`・`hooks/`・`rules/`）は相対 import（`./`・`../`）。外部からの参照は `@/` の絶対パスに統一する（既存の参照の形を保つ）。

### 規約の改訂（steering）

- **Context**: 要件 3.1（子フォルダの規則を記載する）。
- **Findings**: 現行の規則（「部品の判断は同じフォルダの `camelCase.ts`」）は、子フォルダを許していない。`hooks/`・`rules/` は部品の子フォルダで、小文字の名前（`lib`・`util` と同様に、フォルダ名は camelCase/小文字）。
- **Implications**: 規則に「部品の判断が多いときは `rules/` に、フックは `hooks/` にまとめてよい。部品フォルダ（PascalCase）は子に持たない」を追記する。`structure.md` の例（`ThreadComposer/segments.ts`）も `ThreadComposer/rules/segments.ts` に直す。

### 構造の検査（`composerSplit.test.ts`）

- **Context**: 要件 3.1（規則と配置のずれを検出する）・要件 4.1（既存のテストの期待値は変えない）。
- **Findings**: 検査のリストは、ファイル名と直下のパスで書かれている。移動後のパスに直すと、既存の検査（行数・React の import の無さ・循環）はそのまま機能する。
- **Implications**: 検査の対象（`PURE_JUDGMENT_FILES`・`NON_INDEX_FILES`）を `rules/`・`hooks/` のパスに更新する。規則の検出（要件 3.3）は、移動後に「直下にフック・判断の `.ts` が残っていない」を追加して確かめる。

## Architecture Pattern Evaluation

| Option                                              | Description                    | Strengths                                                       | Risks / Limitations         | Notes                  |
| --------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- | --------------------------- | ---------------------- |
| C. 部品は保ち、フックと判断だけ子フォルダへ（採用） | `hooks/`・`rules/` を追加      | 部品の規約（1 部品 1 フォルダ）を変えない。直下が配線だけになる | steering の規則の改訂が要る | 利用者の選択（案 C）   |
| A. 直下にすべて平らに置く                           | 子フォルダをなくす             | 階層が最も浅い                                                  | 直下が 20 件を超える        | 不採用（利用者の選択） |
| B. 役割で 3 つの子フォルダにまとめる                | 部品フォルダも役割の子に入れる | 直下が最も少ない                                                | 部品の規約と衝突する        | 不採用（利用者の選択） |

## Design Decisions

### Decision: フォルダ名は `hooks`・`rules`

- **Context**: 要件 1.2・1.3。判断の名前は利用者が技術用語を避けるよう求めた（`rules`）。フックは React の慣習の `hooks` を使う。
- **Selected Approach**: `ThreadComposer/hooks/`（フック 6 件）と `ThreadComposer/rules/`（判断 4 件）。
- **Rationale**: 両方とも、中身を一語で示す。

### Decision: 外部からの参照は `@/` を保つ、内部は相対 import

- **Context**: 既存の慣習（外部は `@/`、部品の内部は `./`）を保つ。
- **Selected Approach**: 外部（`SuggestPopover`・`VideoPicker`・`ThreadSegmentForm`・テスト）は `@/components/composer/ThreadComposer/{hooks,rules}/x` に書き換える。内部（`index`・`hooks/`・`rules/`）は `./`・`../`。
- **Rationale**: 既存の規約（`@/` は領域をまたぐ import）に従う。

### Decision: 公開の関数・型の名前と形は変えない

- **Context**: 要件 2.1・2.2（振る舞いの不変）。`Props`・`ThreadComposerHandle`・フックの戻り値の形は、参照元（`PostLauncher`・`PostPage`・`Timeline`）に影響する。
- **Selected Approach**: 移動だけを行う。関数・型の名前、引数、戻り値は変えない。
- **Rationale**: 移動の差分を、import パスの書き換えだけに保てる。

## Risks & Mitigations

- **import の取りこぼし** — `tsc --noEmit` で検出する（移動の段階ごとに実行）。
- **規則と配置のずれ** — 構造の検査に、直下のフック・判断の検出を追加する（要件 3.3）。
- **`VideoPicker` が `components/composer` の型を使う（既存の依存）** — 移動後も同じ依存を保つ。依存の向きは変えない（要件 2.1 の範囲外）。
- **steering の規則変更の影響** — 規則の記載は `src-folder-layout`（全体の原則）が参照する。この spec では、ThreadComposer の子フォルダの規則だけを書く。

## References

- `.kiro/specs/src-composer-layout/requirements.md`
- `.kiro/specs/src-composer-layout/brief.md`
- `.kiro/specs/src-composer-split/design.md`（ThreadComposer の分割の前提）
- `.kiro/steering/structure.md`（「部品」の規約、「依存規則の検査」）
