# Requirements Document

## Project Description (Input)

生成元 `src/lib/api/schema/**` の説明文（route の `summary`、zod の `description`）が、生成物 `src/client/openapi/**` のコメントに転写されている。生成元の説明が古く、生成物にも古い経緯が残る。生成元の説明を現在の振る舞いに合わせて直し、`npm run codegen` で生成物を作り直す。生成物の変化は説明文（コメント）だけに限る。前提として comments-lib（`src/lib` の整理）の後に行う。

## Introduction

API スキーマ（`src/lib/api/schema`）の説明文と、その中のコメントを現在の振る舞いと基準（`.kiro/steering/comments.md`）に合わせて直す。直したあとに生成物（`src/client/openapi`）を作り直し、生成物の変化が説明文だけであることを確かめる。生成物は手で編集しない。

本スペックは、comment-policy（基準と検査）→ comments-lib → 本スペックのタスク 1（変更前の基準の保存）→ comments-components-pages / comments-tests / comments-scripts-config → 本スペックの残りのタスク（説明文の書き換え、再生成と比較、許容リスト、検証）→ 全 comments-* の完了後の e2e の順に、逐次で行う（並行しない）。生成の入口の `config/orval.config.ts` と `scripts/build/build-openapi-document.ts` は、基準の保存の後に comments-scripts-config が変える。本スペックの再生成は comments-lib の後に行う。comments-lib の G1（`api/` 領域）は `src/lib/api/schema` を明示して除外しており、このディレクトリのコメントは本スペックが担当する。

## Boundary Context (Optional)

- **In scope**: `src/lib/api/schema/**` のコメント、route の `summary`、zod の `description`、HTTP 応答の `description`、生成物の再生成と差分の確認、許容リスト（`config/comments/allowlist.json`）のうち本スペックが所有する項目の削除。`src/lib/api/schema/**` の 38 ファイルのうち、`summary` または `description` を持つ 36 ファイルが文言の対象である。残る 2 ファイル（`index.ts`（経路の割り当て表）と `v2/surveys/[surveyId]/path.ts`（契約の再エクスポート））は文字列を持たず、生成物にも出ないため文言の対象外とする。ただし、この 2 ファイルのコメントは検査（Requirement 3・4.1）の対象に含む。
- **Out of scope**: API の入出力の形・経路・認可・バリデーション（zod の制約の追加・削除・変更を含む）、`scripts/build/build-openapi-document.ts` と orval の設定、説明文の言語の変更、生成物の手編集、`src/lib/api/schema` 以外のコメント。
- **Adjacent expectations**: comments-lib は `src/lib/api/schema` を書き換えない。コメントの基準は `.kiro/steering/comments.md` が正本で、判断に迷うコメントは残したうえで差分の報告に挙げる。共通の語の一覧の正本も `.kiro/steering/comments.md` とし、本スペックは spec 固有の語を追加しない。

## Requirements

### Requirement 1: 説明文が現在の振る舞いを述べる

**Objective:** As a 生成物を読む開発者と AI エージェント, I want route の説明と項目の説明が現在の振る舞いと一致すること, so that 古い経緯を読まずに API の使い方を判断できる

#### Acceptance Criteria

1. The API schema (`src/lib/api/schema`) shall state, in each route `summary` and each zod `description`, the current behavior of the endpoint or item it describes.
2. If a route `summary` or zod `description` disagrees with the current implementation, the API schema shall be corrected to match the implementation.
3. The API schema shall write each route `summary` and zod `description` as a single line of present-tense text, including the values written across several lines in the source.
4. The API schema shall not state a numeric limit (for example, a maximum count, a character count, or a rate limit) in prose in any `summary` or `description`. A limit shall be written only as a zod constraint on the same item, which the generated code then carries (for example, as `@maxItems`).

### Requirement 2: 生成物は説明文の差分だけを持つ

**Objective:** As a 保守する開発者, I want 再生成で変わるのが説明文だけであること, so that クライアントの振る舞いと型が変わらないと確かめられる

#### Acceptance Criteria

1. When `npm run codegen` is run after the text changes, the codegen command shall complete successfully.
2. When the generated client under `src/client/openapi` is compared with the baseline generated before the text changes, the difference shall consist only of comment and description text lines（比較の手順は design.md の「比較の方法」）。
3. The API schema shall keep the paths, request and response shapes, status codes, authentication, and zod validation constraints unchanged.
4. If a text change would require a change to a shape or a validation constraint, then the API schema shall keep the existing behavior and list that item in the difference report.

### Requirement 3: 生成元のコメントが基準に従う

**Objective:** As a AI エージェント, I want スキーマファイルのコメントが基準に従うこと, so that 経緯や spec への参照を読まずに済む

#### Acceptance Criteria

1. The API schema files shall not contain references to specs (`specs/...`), requirement numbers, AC/FR/NFR tags, cc-sdd, kiro, or dates outside backquoted input examples.
2. The API schema files shall begin with a header comment of at most 6 lines and at most 3 bullet items.
3. The API schema files shall state, in their comments, the current behavior and the reasons for it, and shall not paraphrase the code or record history.
4. If a comment is hard to classify as keep or delete, then the API schema shall keep the comment and list it in the difference report.

### Requirement 4: 検査と許容リストが解消を示す

**Objective:** As a 保守する開発者, I want 検査が `src/lib/api/schema` の違反を報告しないこと, so that 許容リストに本スペックの項目が残らない

#### Acceptance Criteria

1. When the comment checker is run, the comment checker shall report no violation for files under `src/lib/api/schema`.
2. The allowlist shall contain no entry whose owner is `comments-api-schema` after this feature is complete.
3. When `npm run test:unit` is run, the unit test suite shall pass.
4. When `npm run test:type` and `npm run test:imports` are run, both commands shall pass.
5. When all `comments-*` specs are implemented, the e2e run (`npm run test:e2e`) shall be run once as the final integration step of the comments series. After that run, the 作業 shall comments-* の単位の外の整形差分だけを戻す（prettier の工程が作った差分に限る）。
