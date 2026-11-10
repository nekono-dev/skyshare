# 調査と設計判断の記録

## Summary

- **Feature**: `comment-policy`
- **Discovery Scope**: Extension（既存の成果物の確認。新しい技術は導入しない。light discovery）
- **Key Findings**:
  - 基準（`.kiro/steering/comments.md`）・検査（`scripts/architecture/commentRules.ts`）・テスト（20 件）・許容リスト（642 件）は、コミット 165216e に揃っている。2026-11-08 に、テスト 20 件の通過を確認した。
  - 許容リストは `(path, rule)` の組で重複が無く、各項目の `owner` は検査の所有 spec の規則（`ownerOf`）と一致する。
  - `tech.md` の「Code Quality」の節（35 行目）が、旧の書き方（「責務と処理概要」「実装上の制約」の JSDoc）を定めており、基準と食い違う。基準への参照も無い。

## Research Log

### 既存の成果物の確認

- **Context**: 要件（comment-policy の受入基準）が、現在の基準と検査の振る舞いと一致するかを確かめる。
- **Sources Consulted**: `.kiro/steering/comments.md`、`scripts/architecture/commentRules.ts`、`tests/unit/scripts/commentRules.test.ts`、`config/comments/allowlist.json`、`config/test/vitest.unit.config.ts`（`tests/unit/**/*.test.ts` を対象とする）。
- **Findings**:
  - 検査の規則は、ヘッダ（上限 6 行・箇条書き 3 件）、禁止パターン 5 種（spec 参照・要件番号・AC/FR/NFR・cc-sdd・kiro）、日付（コメント中、バッククォート外）。API スキーマの `summary`・`description` の行にも禁止パターンを当てる。
  - 検査の対象は `src`・`scripts`・`hack`・`tests`・`config` の `.ts`・`.tsx`・`.astro`・`.mjs`。除外は `src/client/`・`src/images/`・`tests/fixtures/`・`*.d.ts`・ドット始まりのディレクトリ・`node_modules`。
  - 「旧」「以前」「移行」「経緯」は、検査の規則に無い（レビューで判断する）。
- **Implications**: 要件 1〜7 は、この現状の振る舞いを記述する。「1〜2 行」は機械検査せず、要件 2.6 のとおりレビューで見る。

### 許容リストの形と照合

- **Context**: 許容リストの照合のキーを何にするか。
- **Findings**:
  - 照合のキーは `(path, rule)`。行番号は使わない。行が動いても、違反が同じなら許容は外れない。
  - `checkSource` は、同じファイルで同じ規則に当たる違反を 1 件にまとめる。キーの粒度と一致する。
  - 同じファイルの同じ規則の違反が増えても、新しい違反としては報告されない（キーが同じため）。この粒度の制約は、既存の規則の導入時の判断として受け入れる。
- **Implications**: 許容リストは「ファイル × 規則」の単位で解消を追跡する。個々の違反の数は追跡しない。

### 所有 spec の割り当て

- **Context**: 許容リストの `owner` が、検査とどう結び付くか。
- **Findings**:
  - `ownerOf` は、パスの接頭辞で 5 つの spec のいずれかを返す。`--emit-allowlist` の下書きだけが使う。
  - テストは、`owner` が 5 つの既知の値のどれかであることを確かめ、さらに `ownerOf(path)` と一致することを確かめる（要件 5.5。現状の 642 件は一致している）。
- **Implications**: 一致の検査を、テストに加える（要件 5.5 と タスク 3.2）。

### 既存の import 検査との比較

- **Context**: `scripts/architecture/allowlist.ts` は、許容リストの形式・重複・未知の規則・所有 spec の存在・理由の記入を読み込み時に検証する。
- **Findings**: コメントの許容リストは、テストの中で「所有 spec が既知の 5 つのどれか」「理由が空でない」「解消済みの項目が無い」「未登録の違反が無い」を確かめる。重複と未知の規則の検証は無い（現状は重複 0 件を確認済み、未知の規則は無い）。
- **Implications**: 重複と未知の規則の検証は、タスク 3.2 でテストに加えた（design の Open Questions 2）。

### `tech.md` の食い違い

- **Context**: 要件 8.1 は、`tech.md` から基準への参照を 1 箇所だけ置くことを求める。
- **Findings**: `tech.md` の 35 行目が「各モジュールの先頭に日本語の JSDoc を置き、『責務と処理概要』『実装上の制約』を書く（既存コードの共通の書き方）」と定めている。基準の書き方（目的 1〜2 行・箇条書き最大 3 件・6 行以内）と食い違う。参照は無い。
- **Implications**: 35 行目を基準への参照に置き換える（design の Modified Files）。これは未完了の作業であり、tasks で実装する。

## Architecture Pattern Evaluation

| Option                      | Description                                            | Strengths                                                    | Risks / Limitations                                                                      | Notes      |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- |
| 文字列判定（採用）          | 行の正規表現とブロックコメントの先頭判定だけで検査する | 依存が無い。速い。決定的。既存の import 検査の規則と同じ作り | 構文を見ないため、文字列リテラルの中の `//` などを誤判定しうる（コメント行の判定で緩和） | 現状の方式 |
| 構文木（TypeScript の AST） | コメントノードを列挙して判定する                       | 誤判定が少ない                                               | Astro・`.mjs`・JSDoc の扱いが複雑になる。依存が増える                                    | 採用しない |

## Design Decisions

### Decision: 検査は文字列判定とする

- **Context**: 対象は `.ts`・`.tsx`・`.astro`・`.mjs` と、コメント中の語。判定は行頭の記号と禁止パターンで足りる。
- **Alternatives Considered**:
  1. 文字列判定（正規表現）
  2. TypeScript の AST でコメントを列挙する
- **Selected Approach**: 行頭が `//`・`/*`・`*`・`{/*`・`<!--` の行だけを「コメント行」として、禁止パターンと日付を判定する。先頭ヘッダは、シェバン行・フロントマターの `---`・空行を飛ばした先頭のブロックコメントを探す。
- **Rationale**: 依存を増やさず、既存の import 検査と同じ作りにできる。結果は入力だけで決まる。
- **Trade-offs**: 文字列リテラルの中の行頭の `*` などを、コメントとして誤判定する可能性がある。判定は「ファイル × 規則」の 1 件に絞るため、影響は限られる。
- **Follow-up**: 誤判定が出たら、許容リストではなく、判定の規則を直す。

### Decision: 許容リストの照合は `(path, rule)` の組で行う

- **Context**: 既存の違反は 642 件あり、行番号は作業中に動く。
- **Selected Approach**: キーは `path` と `rule` の組。行番号は報告にだけ使う。
- **Rationale**: 行の移動で許容が外れない。解消の単位（ファイルの 1 規則）と合う。
- **Trade-offs**: 同じ規則の違反が同じファイルで増えても検出されない。
- **Follow-up**: 規則を追加したときの作り直し（`--emit-allowlist`）は、既存の違反を黙って許容するため、規則の追加時だけに限る（要件 5.6）。

### Decision: 「旧」「以前」「移行」「経緯」は機械で判定しない

- **Context**: 正当な用法（製品の用語としての「移行」など）がある。
- **Selected Approach**: 検査の規則に入れない。基準の文書（comments.md）で書かないものとして示し、レビューで判断する。
- **Rationale**: 語の一致だけでは、正当な用法を誤って失敗にする。
- **Trade-offs**: 経緯の混入は、レビューまで残る。

## Risks & Mitigations

- **許容リストの解消漏れ**: 解消済みの項目が残ると、テストが失敗する（要件 5.3）。
- **基準と既存コードの食い違い**: `tech.md` の 35 行目が旧の書き方を定めている。Modified Files で置き換える。
- **許容リストの改ざん・誤記**: 重複・未知の規則・所有 spec の不一致は、テストで検出する（タスク 3.2）。

## References

- `.kiro/steering/comments.md` — 基準（本文が正本）
- `.kiro/steering/roadmap.md` — Phase 7（comment-policy と comments-* の依存）
- `.kiro/specs/comment-policy/brief.md` — 決定事項と進捗
