# Research & Design Decisions

---

**Purpose**: API スキーマの説明文を直したときに、生成物のどこに出て、何を確かめれば変更が説明文だけだと言えるかを記録する。
---

## Summary

- **Feature**: `comments-api-schema`
- **Discovery Scope**: Extension（既存の生成パイプラインへの文字列の変更。新しい構成要素は作らない）。light discovery。
- **Key Findings**:
  - 生成物に出るのは route の `summary`（`client.ts` の `@summary`、35 件）と zod の `description`（`model/*.ts` の JSDoc）だけ。応答の `description`（`"Success"` など）は型名にしか出ない。schema ファイルのコメントは出ない。
  - 検査（`scripts/architecture/commentRules.ts`）は、`summary:` や `description:` と引用符が同じ行にある行しか見ない。複数行の値は検査されない。
  - 許容リストの所有 spec `comments-api-schema` の項目は 5 件で、現在の検査結果と一致する。
  - `npm run codegen` はオフラインで約 2 秒で終わり、同じ入力から同じ出力を作る（確認済み）。

## Research Log

### 生成物に出る文字列の経路

- **Context**: 説明文の変更が生成物のどこに現れるかを特定する。
- **Sources Consulted**: `config/orval.config.ts`、`scripts/build/build-openapi-document.ts`、`src/client/openapi/client.ts`、`src/client/openapi/model/*.ts`（codegen で作り直したもの。変更前と同一であることを確認済み）。
- **Findings**:
  - route の `summary` は `client.ts` の `@summary` になる（35 件）。
  - zod の `.meta({ description })` は `model/*.ts` の JSDoc になる。型のフィールド名 `description: string;` は文字列ではなく識別子。
  - 応答の `description: "Success"` は、生成物では型名（`...ResponseSuccess`）にだけ現れ、コメントには出ない。
  - schema ファイルの先頭ヘッダと `//` コメントは生成物に出ない。
- **Implications**: 生成物の差分の検査は、コメント行だけが変わったことを見ればよい。非コメント行は型名と関数名だけなので、差分が出なければ振る舞いは変わっていない。

### 生成物の差分だけでは見えない変更

- **Context**: zod の制約（`.max(5)` など）を変えると、生成物の型が変わるか。
- **Findings**: 生成物の TypeScript は制約の値を型の形に反映しない場合がある。そのため、生成物の差分だけでは、zod の制約の変更を検出できない。
- **Implications**: 生成元の検査として、`buildOpenApiDocument()` の出力（OpenAPI の JSON）を変更前後で比べ、差分のキーが `summary` と `description` だけであることを確かめる。OpenAPI の JSON には制約（`maxItems` など）が出るため、制約の変更も検出できる。

### 検査の対象外の二つのファイル

- **Context**: `src/lib/api/schema` は 38 ファイルで、文言の監査の対象は 36 ファイルである。
- **Findings**:
  - `index.ts` と `v2/surveys/[surveyId]/path.ts` は、`summary`・`description` を持たない（経路の割り当て表と、契約の再エクスポート）。生成物にも出る文字列が無い。
  - 検査（`commentRules.ts`）を読み取りだけで走らせ（`findCommentViolations`）、この 2 ファイルの違反が無いことを確かめた。違反は許容リストの 5 件（`src/lib/api/schema` の 4 ファイル）と一致した。
- **Implications**: 2 ファイルは文言の対象外だが、コメントは検査と要件 3 の対象に含む。

### 検査の盲点

- **Context**: 規則違反の検出が、説明文の全部を見ているか。
- **Sources Consulted**: `scripts/architecture/commentRules.ts` の `SCHEMA_TEXT_LINE`、`src/lib/api/schema/v2/entry/post.ts`（228〜229 行）。
- **Findings**:
  - `SCHEMA_TEXT_LINE` は `summary:` と引用符が同じ行にある行だけを対象にする。`entry/post.ts` の `summary:` は改行の後に値が続くため、値の行は検査されない。
  - zod の `description:` を別の行に書いた場合も同様に検査されない。
- **Implications**: 検査の盲点を補うため、`src/lib/api/schema` の全行を、禁止パターン（`FORBIDDEN_PATTERNS`）で一度 grep する。検査の規則の変更は comment-policy の所有なので、本 spec では変えない。

### 説明文の事実の確認（抜き取り）

- **Context**: 説明文が現在の振る舞いを述べているか。全数の確認の前に、判断の型を決める。
- **Sources Consulted**: `src/lib/feedback/submitFeedback.ts`（レート制限のキー）、`config/wrangler.template.jsonc`（期間 60 秒・上限 1 件）、`src/lib/api/schema/common.ts`（`listUris` の `.max(5)` と説明文の「合計で最大5件」）、`src/lib/atproto/gate.ts`（防御的な clamp）。
- **Findings**:
  - `feedback` の「1 分に 1 件、アカウントごと」は、期間 60 秒・上限 1 件と、キー `session.did` で一致する。ただし、この数値は説明文から取り除く（決定 B、下記）。zod の制約ではないため、生成物からも消える。
  - `listUris` の説明文の「合計で最大5件」は、zod の `.max(5)`（`listUris` 単体の件数）と一致する。ただし、この文は説明文から取り除く（決定 B）。上限は `.max(5)` だけで表し、生成物の `@maxItems` に出る。「allowMentioned/allowFollower/allowFollowing と合計」の範囲は zod では表せず、`gate.ts` の側に残る。
  - 「サーバ側でも防御的に clamp」は `gate.ts` の記述（`MAX_REPLY_GATE_RULES` を超えないよう clamp）と一致する。ただし、これは振る舞いの説明なので説明文から取り除く。理由は `gate.ts` に残る（comments-lib の対象）。
- **Implications**: 監査は、説明文の各主張を実装の 1 箇所以上で確かめる方式にする。結果は、ずれたものと判断に迷うものだけを本ファイルに記録する。

### 数値の上限の文章（取り除く対象）

- **Context**: 決定 B（説明文に数値の上限を文章で書かない）で取り除く文字列の一覧。作成時点（`src/lib/api/schema`）の行。タスク 2.2 の完了の確認に使う。
- **Findings**: `summary` と `description` の全文字列を TypeScript の AST で抽出して調べた（複数行の値を含む。`common.ts:276` の `ERROR_STATUS_DESCRIPTIONS` の参照を除く）。数値の上限の文章を持つのは次の 2 件だけ。
  1. `src/lib/api/schema/common.ts` 106〜107 行（`listUris` の `description` の値）: 「…allowMentioned/allowFollower/allowFollowingと合計で最大5件(サーバ側でも防御的にclamp)。」の一文を取り除く。残すのは「customの場合のみ意味を持つ。返信を許可するリストのAT-URI配列(#listRule)。」
  2. `src/lib/api/schema/v2/feedback/post.ts` 91 行（`createFeedback` の `summary` の値）: 「(one per minute per account)」を取り除く。残すのは「Submit a bug report or a feature request as a GitHub issue」。
- **Implications**: 取り除くと、生成物の `@maxItems`（`listUris` の `.max(5)`）は変わらない。`feedback` の 1 分 1 件は zod の制約ではないため、生成物から消える（差分の報告に挙げる）。

### 英語の summary の文体

- **Context**: `comments.md` は「現在形で、何かを書く」と定める。英語の summary は命令形の動詞句（`Delete ...`、`Get ...`）で書かれている。
- **Findings**: 既存の summary は全件が動詞句で、現在の振る舞いを述べている。文法の時制を変えるかどうかは、基準の文言の解釈に依存する。
- **Implications**: 本 spec では、動詞句の文体を変えない（基準の「現在の振る舞いを述べる」を満たすと解する）。この解釈は差分の報告に挙げる。

### テストが説明文の文字列を検査しているか

- **Findings**: `tests/` と `config/test/` に、schema の summary や description の文字列を比べるテストは無い。`commentRules.test.ts` は規則と許容リストを検査し、説明文の本文は比べない。
- **Implications**: 説明文の変更で既存のテストは壊れない。ただし、zod の制約を変えた場合は route と unit のテストで検出する。

## Architecture Pattern Evaluation

| Option                                   | Description                                                 | Strengths                                          | Risks / Limitations                                            | Notes              |
| ---------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- | ------------------ |
| 生成元の文字列を直して再生成する（採用） | schema の文字列を直し、`npm run codegen` で生成物を作り直す | 生成物を手で編集しない。生成パイプラインを変えない | 検査の盲点があるため、grep を補う必要がある                    | brief の方針に一致 |
| 生成物の JSDoc を直接直す                | `src/client` を編集する                                     | 作業が少ない                                       | 生成物は gitignore で、再生成で消える                          | 却下               |
| orval の設定で説明文を書き換える         | 生成時に置換する                                            | schema は変わらない                                | 生成ツールの変更は本 spec の範囲外（brief の Out of Boundary） | 却下               |

## Design Decisions

### Decision: zod の制約は変えない

- **Context**: 説明文の中には、件数や文字数の制約が文章で書かれているものがある。`comments.md` は制約を zod で書くとしている。
- **Alternatives Considered**:
  1. 文章の制約を zod の制約として追加する
  2. 文章の制約に合わせて zod を変える
  3. zod の制約は変えず、説明文から数値の上限の文章を取り除く（決定 B、採用）
- **Selected Approach**: 3。zod の制約を追加・削除・変更しない。説明文の数値の上限の文章は取り除く。上限は zod の制約だけで表す。
- **Rationale**: zod の制約を足すと API の受け付ける入力が変わる。本 spec の制約は「振る舞いを変えない」ことである。文章と zod の二か所に上限を書くと、食い違いの余地が残る。`comments.md` は「制約は文章ではなく zod で書く」と定めている。
- **Trade-offs**: zod に無い上限（`feedback` の 1 分 1 件）は、説明文から消えると生成物にも出なくなる。`listUris` の合計の範囲も zod では表せない。どちらも差分の報告に挙げる。
- **Follow-up**: 取り除く対象は「数値の上限の文章（取り除く対象）」の一覧（2 件）。zod に無い上限は差分の報告に一覧する。

### Decision: 変更の検証は三つの比較で行う

- **Context**: 生成物の差分だけでは、zod の制約の変更を検出できない（前述）。
- **Selected Approach**:
  1. 生成物の差分（変更前の生成物と変更後の生成物）: 変わった行がすべてコメント行であること
  2. OpenAPI の JSON の差分（`buildOpenApiDocument()` の出力）: 変わったキーがすべて `summary` と `description` であること
  3. schema の git 差分: 変わった行がすべてコメント行か、`summary` または `description` の値の行であること
- **Rationale**: 三つを合わせると、生成物の文字列、API の契約、生成元の文の順に、変更が説明文に限られることを確かめられる。
- **Follow-up**: 比較の作業ファイルは作業ディレクトリ（scratchpad）に置き、リポジトリには追加しない。

### Decision: 英語の summary の文体は変えない

- **Selected Approach**: 既存の動詞句の文体を保つ。事実と違うものだけを直す。
- **Rationale**: 文体の統一は振る舞いの説明の目的に含まれない。差分を小さくする。
- **Follow-up**: 差分の報告に、この解釈を挙げる。

## Risks & Mitigations

- 監査で、説明文が実装と食い違うものが見つかる。 — 説明文を実装に合わせて直す。実装の変更は本 spec の範囲外なので、直せない場合は説明文を残して報告する。
- 検査の盲点から、複数行の値の禁止パターンを見落とす。 — schema の全行を grep する（前述）。
- 説明文に数値の上限が残り、zod の制約と食い違う。 — 説明文から数値の上限の文章を取り除き、上限は zod だけに置く（決定 B）。全行の grep で残りを確かめる（タスク 2.2）。
- comments-lib が未完了のまま実行すると、順序の依存が崩れる。 — 実行の前に comments-lib の完了を確かめる。

## References

- `.kiro/steering/comments.md` — コメントの基準（正本）
- `scripts/architecture/commentRules.ts` — 検査の規則（`FORBIDDEN_PATTERNS`、`headerOf`）
- `config/orval.config.ts`、`scripts/build/build-openapi-document.ts` — 生成の入口
