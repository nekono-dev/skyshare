# 調査と設計判断の記録

## Summary

- **Feature**: `comments-tests`
- **Discovery Scope**: Extension（既存の検査と許容リストに対する light discovery。新しい技術は導入しない）
- **Key Findings**:
  - 検査（`scripts/architecture/commentRules.ts`）は、コメントの行だけを見る。テストの題名（`describe`・`it` の文字列）は検査の対象外で、題名の要件番号や spec 名は検査で見つからない。題名は別の方法（検索）で確かめる。
  - 検査はファイルを読んで違反を返すだけで、通常の実行では出力しない。`--emit-allowlist` は違反の一覧を出力する（書き込みはしない）。テスト `tests/unit/scripts/commentRules.test.ts` はリポジトリ全体で判定するため、作業の単位ごとの確認は、違反の一覧をパスで絞って行う。
  - 許容リストの所有者 `comments-tests` の項目は 111 ファイル・198 件（うち `config/test/` が 7 ファイル・14 件、残りは `tests/` の 104 ファイル）。許容リストは `comments-*` の 5 spec で共有する。
  - `testing.md` は「テストの題名は英語」と定める。日本語を含む題名は 374 件・51 ファイル（2026-11-08 に構文で数えた。依頼時の概数 362 件とは一致しない）。題名の言語は英語に決定した（「Design Decisions」の決定）。
  - `tests/unit/scripts/` に、`kiro` の語を対象の名前として持つテスト（`kiroGate.test.ts`）がある。
  - `npm run test:e2e` は `prettier --write .` を含み、リポジトリ全体を書き換える（`testing.md` の「未決定・未検証」2 番。題名の言語とは別の論点）。
- **Implications**: 作業は、層（ディレクトリ）ごとの単位に分ける。題名の確認は、要件番号・spec 名・経緯の検索で行う。e2e の実行（`npm run test:e2e`）は本 spec の範囲外で、最後の e2e は comments-api-schema が実行する。

## Research Log

### 検査の対象と判定

- **Context**: 検査が題名を見るかどうか。
- **Sources Consulted**: `scripts/architecture/commentRules.ts`（`checkSource`・`collectSources`・`COMMENT_LINE`）。
- **Findings**:
  - 禁止パターンは `COMMENT_LINE`（行頭が `//`・`/*`・`*`・`{/*`・`<!--`）の行だけに当てる。`it("…要件 2.4…")` の行は、行頭が `it` のため対象外。
  - 先頭ヘッダは、シェバン行・Astro のフロントマターの後の最初のブロックコメント。
  - 除外は `src/client/`・`src/images/`・`tests/fixtures/`・`*.d.ts`・ドットで始まるディレクトリ・`node_modules`。`tests/unit/fixtures/`（`tests/fixtures/` の外）は除外されない。
- **Implications**: 題名は検査と別に、検索で確かめる。`tests/unit/fixtures/` は検査の対象で、対象に含める。

### 題名の言語

- **Context**: 書き換える題名の言語と範囲。
- **Sources Consulted**: `.kiro/steering/testing.md` 68 行目（「テストの題名は英語。」、「Requirements for tests」の節）、`.kiro/specs/test-foundation/requirements.md` の要件 3 の受入基準 3（「テストの題名を英語で書くことを求める」）と 4（識別子を題名に含めることを許可する）、commit 72e43b4a（規則の導入）、cc6fb3d（develop への持ち越し）、brief の Approach（「`testing.md` の規則（題名の言語）に従う」）、`tests/` の構文による計数。
- **Findings**: 規則は「テストの題名は英語」。日本語を含む題名は 374 件・51 ファイル。`test-foundation` の 3.4 は受入基準の識別子を題名に含めることを禁止せず許可する。本 spec は、既存の規則どおり要件番号を題名から取り除く（許可と本 spec の方針は別の論点）。
- **Implications**: 範囲は scope (a)（日本語を含む全件を英語にする）。要件番号・spec 名・経緯を含む英語の題名も書き換える。

### 許容リストの共有

- **Context**: 許容リストは `comments-lib`・`comments-components-pages`・`comments-scripts-config`・`comments-api-schema` と共有する。
- **Findings**: 4 spec は同じ JSON を並行に変更しうる。
- **Implications**: 項目の削除は、書き換えの直前に読み直し、自分の所有（`comments-tests`）で対象のパスの項目だけを削る。JSON 全体を作り直さない。

### e2e の副作用

- **Context**: `npm run test:e2e` の `build:prepare` は `prettier --write .` を含む。
- **Findings**: リポジトリ全体が整形の対象になる。並行する他の spec の未コミットの変更も対象になりうる。
- **Implications**: 本 spec の完了条件は整形を伴う実行を含まない。整形を伴う実行を行った場合は、`git status` を比べ、comments-* の単位の外の整形差分だけを戻す（他の spec の変更は戻さない）。

## Architecture Pattern Evaluation

作業の分割のみ。アーキテクチャの選択は無い。層（unit・component・route・render・e2e・config/test・live）の境界に沿って分ける。層は `testing.md` の Layers の節に従う。

## Design Decisions

### Decision: 題名の言語は英語（日本語を含む題名は全件）

- **Context**: 要件 6.2 と brief の「testing.md の規則（題名の言語）」の解釈。
- **Selected**: 日本語を含む `describe`・`it`・`test` の題名（`.each` を含む）を、すべて英語にする（scope (a)）。既存の英語の題名は、要件番号・spec 名・経緯を含むものだけを書き換える。
- **Rationale**: `testing.md` の「テストの題名は英語。」と `test-foundation` の要件 3.3 が、テストの題名を英語と定める。既存の日本語の題名を残すと、規則に反する題名が残る。書き換えた題名だけを英語にする案は、同じファイルの中で英語と日本語が混ざるため採らない。
- **Source**: 依頼者の決定（本 spec の作業依頼）。根拠の規則は上の「題名の言語」の節のとおり。

### Decision: 作業の確認は層とパスで絞る

- **Context**: 検査とテストはリポジトリ全体で判定する。
- **Selected**: 作業の単位ごとに、`--emit-allowlist` の出力を対象のパスで絞って、違反が無いことを確かめる。テストの実行は、対象のファイルを引数で絞る（`vitest run -c <config> <paths>`）。リポジトリ全体の検査の成功は、最後の検証でだけ求める。
- **Rationale**: 他の `comments-*` の未完了の違反で、作業の単位の完了が決まらないようにするため。

### Decision: 件数の比較は層ごとの JSON 報告で行う

- **Selected**: 作業の前に、層ごとにテストの件数（合計・成功・失敗・スキップ）を記録する。作業の後に同じ方法で数え、一致を確かめる。
- **Rationale**: 題名の変更で件数が変わっていないことを、数で確かめる。

### Decision: tests/unit/scripts/commentRules.test.ts は、コメントを対象外、題名を対象とする

- **Context**: 検査のテストは、検査の規則（禁止パターン）の例を文字列（`cc-sdd`・`kiro` を含む入力）として持つ。同じファイルに、日本語を含む題名が 20 件ある。
- **Selected**: コメントは本 spec の対象外（`comment-policy` が担当し、違反は 0 件として扱う）。題名は、日本語を含むものを英語にする（scope (a)。`tests/` の全件が対象）。入力の文字列（禁止パターンの例）は変えない。
- **Rationale**: コメントは、テストの入力と検査の規則の範囲であり、ここで書き換えると検査の確認そのものが変わるため。題名は、期待値と入力を変えずに英語にできる。

## Risks & Mitigations

- **並行する作業との競合**: 他の `comments-*` が同じ許容リストと `src/` を変える。→ 許容リストは読み直して自分の項目だけを消す。`src/` は変えない。
- **整形を伴う実行による変更**: → 本 spec の完了条件に整形を伴う実行を含めず、行った場合はcomments-* の単位の外の整形差分だけを戻す。
- **題名の変更で期待値と振る舞いがずれる**: → 題名は期待値を読んでから書く。期待値の行は変えない。
- **判別に迷うコメントの扱い**: → 残し、報告に挙げる。

## References

- `.kiro/steering/comments.md`（コメントの基準）
- `.kiro/steering/testing.md`（テストの方針・題名の言語。68 行目）
- `.kiro/specs/test-foundation/requirements.md`（要件 3 の受入基準 3・4）
- `scripts/architecture/commentRules.ts`（検査）
- `tests/unit/scripts/commentRules.test.ts`（検査のテスト）
- `config/comments/allowlist.json`（許容リスト）
