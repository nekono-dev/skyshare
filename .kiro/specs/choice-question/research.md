# Research & Design Decisions

## Summary

- **Feature**: `choice-question`
- **Discovery Scope**: Simple Addition（既存の共通 UI 部品 2 つを束ねる薄い部品。外部ライブラリの調査は不要で、既存コードのパターン確認のみ行った）
- **Key Findings**:
  - `RadioButton`（`name` で束ねる、選択された時だけ `onSelect`）と `Checkbox`（variant `card`、`onCheckedChange(next)`）は、カードの外枠を `ui["base-card"]` と `ui["selectable-card"]` で共有しており、そのまま並べれば見た目が揃う。無効時の見た目は `selectable-card` の `:has(input:disabled)` が持つ。
  - 既存の `FeedbackForm` が `fieldset` と `legend` で `RadioButton` のグループにラベルを付けている。`fieldset` の初期化（`margin`・`padding`・`border`・`min-width`）は各コンポーネントの CSS に書く慣習である。
  - `RadioButton` の外枠は `.option { flex: 1 1 0 }`（横並び用）を持つため、縦に並べるコンテナは `flex` の主軸に依存しない `grid` にするのが安全である。
  - 共通部品の単体テストは Node 環境の `renderToStaticMarkup` と、関数コンポーネントの直接呼び出しで行う慣習がある（`tests/components/common/ListboxOption.test.ts`）。画面を持たない共通部品の Playwright 確認は、`src/pages/entries/sample.astro` のような確認用ページに載せる前例がある。

## Research Log

### 既存の選択部品の契約と見た目

- **Context**: 薄い部品として束ねるため、2 つの部品の入出力と、並べたときの見た目の整合を確認する。
- **Sources Consulted**: `src/components/common/RadioButton/index.tsx`・`index.module.css`、`src/components/common/Checkbox/index.tsx`・`index.module.css`、`src/styles/button.ui.module.css`、`src/styles/ui.module.css`
- **Findings**:
  - `RadioButton`: `checked`・`onSelect`・`label`・`name`・`disabled`・`id`・`className`。ネイティブ `input[type=radio]` の `onChange` が選択された時だけ発火するため、選択中の再選択では通知されない。
  - `Checkbox`: `checked`・`onCheckedChange(next)`・`label`・`disabled`・`variant`。`card` で `RadioButton` と同じ外枠になる。
  - どちらもネイティブ `input` を視覚的に隠し、`:focus-visible` でフォーカスの位置を示す。
  - `selectable-card` は `width: 100%` と横並びの `display: flex` を持つ。
- **Implications**: 新しい部品はカードの見た目を一切持たず、並べる配置（縦の `grid`）とグループのラベル（`fieldset` と `legend`）だけを持つ。見た目の整合（要件 8.1・8.2）は既存部品に委ねる。

### グループのラベルと支援技術

- **Context**: 要件 7.1・7.2・7.5。質問文を選択肢全体のラベルにし、同じ画面の複数の質問を干渉させない。
- **Sources Consulted**: `src/components/feedback/FeedbackForm/index.tsx`（`fieldset` と `legend` の用例）、HTML 仕様（`fieldset` は `group` ロール、`input[type=radio]` の同名グループは `radiogroup` として扱われる）
- **Findings**: `fieldset` と `legend` は単一選択にも複数選択にも同じ構造で使え、質問文がグループの名前として支援技術に伝わる。`input[type=radio]` の同名グループは `name` が同じものだけが排他になるため、質問ごとに異なる `name` が要る。
- **Implications**: 質問ごとに `useId()` で `name` を生成する。ARIA の `role` を手書きせず、ネイティブの意味に任せる。

### 画面を持たない部品の実ブラウザ確認

- **Context**: ワークフローは UI 変更の完了条件に Playwright の実動作確認を含める。この部品は利用側（survey-form）の完成前には、どの画面にも載らない。
- **Sources Consulted**: `.kiro/steering/workflow.md`（UI 実装の検証）、`src/pages/entries/sample.astro`（確認用サンプルページの前例）、`tests/e2e/fixtures.ts`
- **Findings**: 確認用ページを `prerender` の静的ページとして置き、`noindex` を付ける前例がある。ゲストの表示に依存しない。
- **Implications**: 確認用の状態を持つ React コンポーネントとその確認用ページを追加し、`tests/e2e/choiceQuestion.spec.ts` が操作後の DOM を検証する。

## Architecture Pattern Evaluation

| Option                     | Description                                                                     | Strengths                                          | Risks / Limitations                          | Notes              |
| -------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- | ------------------ |
| 薄い切り替え部品（採用）   | 種別で `RadioButton` と `Checkbox` を切り替え、グループのラベルと配置だけを持つ | 既存の見た目・操作をそのまま引き継ぐ。部品が小さい | 上限の判定と選択の一覧の組み立てを部品が持つ | brief の方針と一致 |
| 既存部品の拡張             | `RadioButton` または `Checkbox` に質問のまとまりの機能を足す                    | 部品が増えない                                     | 既存部品の責務が膨らみ、他の利用側へ影響する | 却下               |
| 自前でネイティブ入力を描画 | 新しい見た目を作る                                                              | 自由度が高い                                       | 見た目が二重になり、既存のカードと乖離する   | 却下               |

## Design Decisions

### Decision: 選択状態の表現を識別子の配列に統一する

- **Context**: 単一選択は 0 または 1 件、複数選択は 0 件以上の選択を持つ。利用側が種別ごとに別の型を扱うと、アンケートの画面で分岐が増える。
- **Alternatives Considered**:
  1. 単一は `string | undefined`、複数は `string[]` の判別共用体
  2. 常に `readonly string[]`（単一は 0 または 1 件）
- **Selected Approach**: 常に識別子の配列（案 2）。通知も配列。
- **Rationale**: 利用側の回答の状態（質問 ID から選択肢の配列）を、種別によらず同じ形で持てる。生成元の設定は種別を `kind` で持つため、画面の分岐は部品の `kind` に渡すだけで済む。
- **Trade-offs**: 単一で 2 件以上を渡された場合の意味が曖昧になる。含まれる識別子の選択肢をすべて選択中として描画し、補正はしない（要件 6.3 の妥当性を判定しない方針）。
- **Follow-up**: 単一で通知される配列は常に 1 件であることを単体テストで固定する。

### Decision: 上限は選択中の数が上限に達した未選択の選択肢を無効にして表現する

- **Context**: 要件 4。上限に達したあとの操作を、通知の取り消しではなく見た目で示す。
- **Alternatives Considered**:
  1. 上限に達した状態の未選択を無効にする（採用）
  2. 選べるが、通知側で拒否する
  3. 先に選んだものを自動で外す
- **Selected Approach**: 案 1。選択中の選択肢は無効にしない（外せる）。
- **Rationale**: 利用者が理由を見た目で理解でき、通知は常に上限を満たす。
- **Trade-offs**: 渡された選択状態が上限を超えていても補正しない（要件 4.5）。補正は呼び出し側の責任とした。
- **Follow-up**: `maxSelect` は 1 以上の整数であることを前提とする。範囲の検証は上流のアンケート設定の検証が担う。

### Decision: 確認用ページを追加する

- **Context**: 利用側が未完成の間も、実ブラウザでの確認が要る。
- **Alternatives Considered**:
  1. 確認用ページを置く（採用）
  2. Storybook などを導入する
  3. 利用側の完成まで実ブラウザ確認を保留する
- **Selected Approach**: 案 1。`entries/sample.astro` の前例に従う。
- **Rationale**: 新しい依存を増やさず、リグレッション防止のテストを恒久的に残せる。
- **Trade-offs**: 本番にも確認用ページが配信される（`noindex`）。内容は固定の例文のみで秘匿情報はない。
- **Follow-up**: survey-form の完成後も、部品単体の確認として残す。

### Synthesis

- **Generalization**: 単一選択と複数選択は「識別子の集合の変更」という一般的な操作の特殊な場合である。入出力を識別子の配列に統一し（上記）、種別は表示の切り替えだけにした。アンケート固有の概念は持ち込まない。
- **Build vs Adopt**: 既存の `RadioButton`・`Checkbox` を採用する。ネイティブの `fieldset` と `legend` がグループのラベルを提供するため、ARIA の自作や外部ライブラリは使わない。
- **Simplification**: 選択肢ごとの無効指定・選択肢の説明文・選択肢のグルーピングは、現在の要件にないため持たない。状態を持つフックや文脈（Context）も作らず、1 つの関数コンポーネントと純粋関数 2 つで足りる。

## Risks & Mitigations

- 既存部品の `className` の連結に先頭の空白が入る（`${className ? ` ${className}` : ""}`）が、動作に影響しない — 部品側では `className` を渡さず、変更しない。
- `RadioButton` の `flex: 1 1 0` が縦並びで意図しない伸縮を起こす — 配置を `grid` にし、実ブラウザで高さが内容に合うことを確認する。
- 確認用ページが本番に配信される — `noindex` を付け、固定の例文のみにする。

## References

- `.kiro/specs/choice-question/brief.md` — 範囲と制約
- `.kiro/steering/coding-conventions.md` — 共通 UI のスタイル規約
- `.kiro/steering/workflow.md` — UI 実装の検証
