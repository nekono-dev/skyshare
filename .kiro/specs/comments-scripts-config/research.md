# Research & Design Decisions

---

**Purpose**: 運用の資材（`scripts/`・`hack/`・`config/`・`.githooks/`・`.github/workflows/`）のコメントを書き直す作業の、事前の調査と判断の記録。
---

## Summary

- **Feature**: `comments-scripts-config`
- **Discovery Scope**: Extension（既存のスクリプトと設定のコメントを、振る舞いを変えずに書き直す。新しい部品や依存は増やさない）
- **Key Findings**:
  - 許容リストのうち、この spec が所有する項目は 43 件（30 ファイル）。検査の規則では、所有 spec は「`src/`・`tests/`・`config/test/`・許容リストの生成物」以外すべて `comments-scripts-config` になる。
  - 検査の CLI は、`--emit-allowlist` を付けないと何も出力せず終了コード 0 で終わる。残っている違反の確認には、`--emit-allowlist` の出力を所有パスで絞る必要がある。
  - 検査の禁止パターン `\bkiro` は、コメント中の `.kiro/` のパス（`.kiro/specs/` など）にも当たる。書き直しでは、パスを書く代わりに役割を述べる必要がある。
  - シェルスクリプトとワークフロー YAML は自動検査の対象外。経緯や要件番号の記述は、grep で候補を出してレビューで判断する。
  - 許容リストは、全 comments-* spec が共有する。並列に編集すると衝突するため、作業は順番に進める。
  - `scripts/architecture/commentRules.ts` は comment-policy が所有する。`ownerOf` は `scripts/architecture/` を comments-scripts-config に割り当てるため、既知の例外として記録する（`ownerOf` は変えない）。

## Research Log

### 許容リストと所有 spec の割り当て

- **Context**: この spec が直す範囲を、検査の規則から確定する。
- **Sources Consulted**: `config/comments/allowlist.json`（642 件）、`scripts/architecture/commentRules.ts`（`ownerOf`）。
- **Findings**:
  - 所有 spec の割り当ては `ownerOf`（`src/lib/api/schema/` → comments-api-schema、`src/lib/` → comments-lib、`src/` → comments-components-pages、`tests/` と `config/test/` → comments-tests、それ以外 → comments-scripts-config）。
  - この spec の 43 件の内訳: 先頭ヘッダの欠落 17、行数の超過 11、箇条書きの超過 9、要件番号 5、kiro 1。
  - 現在の違反の数（642）と許容リストの項目数（642）は一致している（作業の前の基線）。
- **Implications**: 対象の範囲は、ownerOf の「それ以外」に当たる全ファイル。検査の対象の拡張子（`.ts`・`.tsx`・`.astro`・`.mjs`）に当たるのは、このうち一部だけ。

### 検査の CLI と単体テストの実行

- **Context**: 完了の確認に使うコマンドを決める。`comments.md` は `npx tsx scripts/architecture/commentRules.ts` で検査すると書いているが、その実行では出力が無い。
- **Sources Consulted**: `scripts/architecture/commentRules.ts`（直接実行の分岐）、`config/test/vitest.unit.config.ts`。
- **Findings**:
  - 直接実行で出力するのは `--emit-allowlist` のときだけ。違反の一覧は、その出力から取る。
  - 単体のテストファイルを vitest で実行すると、カバレッジの閾値のエラーで失敗する。`--coverage.enabled=false` を付けると、commentRules のテストは 20 件とも通る（本 spec の作業前の確認）。
  - 全体の確認は `npm run test:unit` で行う（カバレッジを含む）。
- **Implications**: 各領域の完了は「所有パスの違反が 0 件、所有の許容項目が無い」で確かめる。リポジトリ全体の検査が通るのは、全 comments-* spec が終わってから。

### 禁止パターンと、この spec の対象のコメント

- **Context**: 書き直しで何を消すかの基準を、検査の規則から確かめる。
- **Sources Consulted**: `scripts/architecture/commentRules.ts`（`FORBIDDEN_PATTERNS`）、対象ファイルのコメント行（`grep` の結果）。
- **Findings**:
  - 禁止パターン: `specs/`、`要件 数字.数字`、`AC|FR|NFR` と数字、`cc-sdd`、`\bkiro`（大文字と小文字は区別しない）。
  - `\bkiro` は `.kiro/` にも当たる（`.` と `k` の間は単語の境界）。コメント行の `.kiro/specs/`・`.kiro/settings/` は違反になる。
  - `kiro-gate.mjs` のコメント行には、`/kiro-*` や「kiro ワークフロー」の記述が複数ある。検査は同じ規則につき 1 件だけを報告するため、許容リストは 1 件（`forbidden:kiro`）になっている。実際の書き換え箇所は、許容リストの件数より多い。
  - `install-cc-sdd.sh` は、cc-sdd の導入そのものを行うスクリプト。コメントの多くが cc-sdd と `.kiro/` を指す。検査の対象外（シェル）なので、基準に沿ってレビューで判断する。
  - 検査の対象外の経緯の記述: `check-imports.ts` の「従来どおり」、`allowlist.ts` の「設計の表と一致させる」（設計書への参照）、`hack/survey-cli/config.ts` の「2026年11月の下書き」（日付の入力例がバッククォートの外にある）。いずれもレビューで見つかる。
  - 「以前の生成物を取り除く」（`render-survey-config.ts`）のような、現在の振る舞いとして必要な「以前」は残す。
- **Implications**: 書き直しは、禁止パターンに当たる行を、役割と理由を述べる文に置き換える。判断が分かれるものは、残して許容リストに理由を付けて記録する。

### 検査の対象外のファイルの確認方法

- **Context**: シェルスクリプトとワークフロー YAML は検査の対象外。振る舞いが変わらないことを、機械的に確かめる方法を決める。
- **Sources Consulted**: `package.json`（`test:lexicon` などの実行）、`node_modules`（`yaml` と `js-yaml` がある）、`bash -n` の動作。
- **Findings**:
  - YAML は、書き換えの前後で `yaml` の `parse` の結果が同じであれば、キー・値・構造は変わっていない。Python の `yaml` は入っていないため、Node で確かめる。
  - シェルは `bash -n` で構文を確かめられる。`.githooks/pre-push` は、`npm run test:all` 相当を呼ぶため、中身は変えない。
  - コメントだけの変更は、`git diff -U0` の変更行がすべてコメント行（または空行）であることで確かめられる。
- **Implications**: 振る舞いの不変は、「変更行がコメントだけ」「YAML の解析結果が同じ」「シェルの構文が通る」「`.mjs` と `.ts` は型と単体テストが通る」の組で確かめる。

### 共有のファイルの扱い（許容リストと並列の作業）

- **Context**: comments-* の 5 つの spec は並列に作られる。許容リストは全 spec が書き換える。
- **Findings**: 許容リストの編集は、JSON の項目の削除だけ。同じファイルを並列に編集すると、後から書いた側が前の編集を失うおそれがある。
- **Implications**: この spec の作業は、領域の順に直列で進める。並列の印は付けない。

## Architecture Pattern Evaluation

| Option                     | Description                                                                                                                                  | Strengths                                                        | Risks / Limitations                                        | Notes                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| 領域ごとに書き直す（採用） | 運用資材を領域（architecture・agent・config・survey・e2e・secrets・dev/build・git/lib/hooks・workflows）に分け、領域ごとに書き直して確認する | 差分をレビューできる単位になる。所有パスの確認が領域ごとに閉じる | 許容リストの編集が領域ごとに繰り返される                   | roadmap の Phase 7 の決定に従う          |
| 機械的な一括置換           | 禁止パターンの語を一括で消す                                                                                                                 | 速い                                                             | 「従来」「以前」の正当な用法や、判断が要る説明を誤って消す | 基準の「機械的な一括置換」の禁止に当たる |
| 許容リストの作り直し       | `--emit-allowlist` の出力で許容リストを置き換える                                                                                            | 作業が一度で済む                                                 | 新しい違反が黙って許容される                               | 基準が禁止している。使わない             |

## Design Decisions

### Decision: 検査の確認は `--emit-allowlist` の出力を所有パスで絞る

- **Context**: CLI の直接実行は出力しないため、違反の残りを確かめる手段が要る。
- **Alternatives Considered**:
  1. CLI の直接実行を変えて、違反を表示させる — 検査の規則の変更にあたるため、この spec の範囲外（要件 5.5）。
  2. `--emit-allowlist` の出力を、所有パスで絞って確かめる — 検査の規則を変えずに済む。
- **Selected Approach**: 2。出力の中で、所有 spec が `comments-scripts-config` の項目だけを取り、許容リストの所有項目と比べる。
- **Rationale**: 検査の規則と CLI を変えず、この spec の範囲で完了を確かめられる。
- **Trade-offs**: 確認に一手間かかる。出力の形式が変わると、比べる手順も変える必要がある。
- **Follow-up**: 作業の前の基線（43 件の所有項目、全体 642 件）を、作業の開始時に再確認する。

### Decision: 単体テストの実行はカバレッジを切る

- **Context**: 1 ファイルだけの実行は、カバレッジの閾値で失敗する。
- **Selected Approach**: 領域の確認では `--coverage.enabled=false` を付けて commentRules のテストを通す。最後の確認は `npm run test:unit`。
- **Follow-up**: 最後の確認では、全 comments-* の完了後に、リポジトリ全体の検査が通ることを確かめる。

### Decision: 残す語の扱い（ツール名）

- **Context**: `kiro-gate.mjs` は kiro のコマンドを扱う。`install-cc-sdd.sh` は cc-sdd の導入そのもの。どちらも、ツール名を言い換えると責務が伝わりにくい。
- **Selected Approach**: 既定は、基準どおりに言い換える（役割で書く。`.kiro/` のパスも書かない）。言い換えると責務が伝わらないと判断した場合に限り、残して報告する。`kiro-gate.mjs` は検査の対象なので、残す場合は許容リストに所有と理由を付けて残す。`install-cc-sdd.sh` は検査の対象外なので、報告に挙げる。
- **Open Point**: この既定を、要件の承認の時点で人が確かめる。

### Decision: 既知の例外（commentRules.ts）と自動検査の範囲

- **Context**: 許容リストの所有の割り当て（`ownerOf`）は `scripts/architecture/` を comments-scripts-config に割り当てるが、`commentRules.ts` の所有は comment-policy である。自動検査が読むのは `.ts`・`.tsx`・`.astro`・`.mjs` だけ。
- **Selected Approach**: `commentRules.ts` は、この spec の対象外として扱う。その違反は comment-policy が 0 件に保つ。`ownerOf` は変えず、既知の例外として記録する。`.sh`・`.jsonc`・`.yaml`・`.githooks/pre-push` は、自動検査の対象外としてレビューで見る。
- **Follow-up**: 完了の確認では、`commentRules.ts` の項目が出ても、この spec では扱わず報告する。

### Decision: 検証の範囲（e2e と lexicon）と、生成の入口の順序

- **Context**: e2e の最後の実行は comments-api-schema が行う（roadmap の Phase 7）。`test:lexicon` は、他の comments-* spec の完了条件に含まれていない。`config/orval.config.ts` と `scripts/build/build-openapi-document.ts` は、comments-api-schema の OpenAPI の比較の対象になる生成の入口である。
- **Selected Approach**: 完了の確認は type・imports・unit・component・route・render。e2e と lexicon は含めない。生成の入口の 2 ファイルは、comments-api-schema の変更前の基準（生成物と OpenAPI の JSON）を保存した後に変える。この spec では生成を実行しない。
- **Follow-up**: 基準の保存が済むまで、この 2 ファイルは後回しにする。

### Decision: 理由の文言の書き換えの例外

- **Context**: 要件 5.4 は、許容リストを項目の削除だけで更新すると定める。残す判断の項目（例: `kiro-gate.mjs` の `forbidden:kiro`）は、残す理由を示す必要がある。
- **Selected Approach**: 残す判断の項目に限り、理由の文言を、残す理由（許容する例外であること）を明示する文に書き換える。これがこの spec で理由の文言を変える唯一の場合。
- **Follow-up**: 語の一覧（禁止パターンに当たる語）の正本は `.kiro/steering/comments.md` の「書くもの・書かないもの」の節にある。この spec は一覧を参照するだけで、語を追加しない。

## Risks & Mitigations

- 書き直しで、コメントの内容が消えて、後で誤った変更が入る — 残す基準（非自明な理由・外部仕様の参照）を先に確かめてから消す。判断が分かれたものは報告する。
- コメントの変更に紛れて、コードや YAML の値が変わる — 変更行がコメントだけであることを、領域ごとに `git diff` で確かめる。YAML は解析結果を比べる。
- 許容リストの衝突 — 領域の順に直列で編集する。編集の前に、ファイルを読み直す。
- 検査の規則と基準が変わる — この spec では変えない。変わったら、roadmap の Phase 7 を改訂する。

## References

- `.kiro/steering/comments.md` — コメントの基準（comment-policy の成果物）
- `scripts/architecture/commentRules.ts` — 検査の規則と、所有 spec の割り当て
- `tests/unit/scripts/commentRules.test.ts` — 検査の単体テスト。comment-policy が所有する（この spec では扱わない）
- `config/comments/allowlist.json` — 許容リスト
- `.kiro/steering/roadmap.md` — Phase 7（ソースのコメントの整理）
- `.kiro/specs/comment-policy/tasks.md` — 4.1（tech.md の「Code Quality」の節の参照の差し替え。未適用のため、この spec の前提が未完了）
