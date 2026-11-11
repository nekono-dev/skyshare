# 実装計画

このspec は、`tests/`（fixture を除く）と `config/test/` のコメントとテストの題名を書き換える。題名は、日本語を含むものを全件（374 件・51 ファイル）英語にする（`design.md` の「決定」）。単位は層（ディレクトリ）ごとに区切り、各単位の最後に、違反が 0 件であること・件数が変わらないこと・許容リストの項目が消えたこと・日本語の題名が 0 件であることを確かめる。

**前提**: `comment-policy` が完了していること（コメントの基準・検査・許容リストの項目の規則）。未完了の間は、この spec の作業に着手しない（`design.md` の「実装の前提」）。

**並行の扱い**: 作業の単位には `(P)` を付けない。理由は次のとおり。(1) 許容リスト `config/comments/allowlist.json` を、他の `comments-*` の 4 spec（comments-lib・comments-components-pages・comments-scripts-config・comments-api-schema）と共有する。(2) 題名の確認は、同じ件数の基準（作業の前の記録）に依存する。そのため、単位は直列に進め、各単位は直前の単位に依存する（`_Depends:_` は直前の単位の最後の確認に付ける）。

- [ ] 1. 作業の前の記録
- [ ] 1.1 層ごとの件数と違反の基準を保存する
  - 層ごと（unit・component・route・render）に、vitest の JSON 報告で合計・成功・失敗・スキップの件数を保存する
  - e2e の件数を、`npx playwright test --list -c config/test/playwright.config.ts` で保存する
  - 作業の単位ごとの対象（`tests/unit/lib`・`tests/unit/scripts`・`tests/unit/scripts/importRules.test.ts`・`tests/route` など）の件数も、同じ方法で保存する（単位の確認で比べるため）
  - 許容リストの所有者 `comments-tests` の項目数（198 件）と、対象のパスの一覧を保存する
  - 日本語を含む `describe`・`it`・`test` の題名の一覧（ファイル・行・題名）を保存し、件数を確かめる。基準は 374 件・51 ファイル（構文で数えた値）。依頼時の概数 362 件と違う場合は、この一覧を正本にして報告する。単位ごとの内訳は U1 64・U2 241・U3 30・U4 26・U5 9・U6 0・U7 4
  - 保存先は作業用ディレクトリで、リポジトリに新しいファイルを置かない
  - 作業の開始時の `git status` を保存し、以後の差分の確認の基準にする
  - 前提: `comment-policy` が完了していること（この spec の着手条件）
  - _Boundary: 作業の記録_
  - _Requirements: 1.3, 3.1, 6.6, 7.2_

- [ ] 2. tests/unit/lib の書き換え
- [x] 2.1 コメントを書き換える
  - 対象の `tests/unit/lib/**/*.test.ts` で、先頭ヘッダが無いものに目的のブロックコメント（6 行以内）を加える
  - 要件番号・AC/FR/NFR のタグ・spec 名・経緯・日付入りの決定をコメントから取り除き、非自明な理由だけを現在形で残す
  - コードの言い換えだけのコメントを削る。判別に迷うものは残し、報告に挙げる
  - 変えた行はコメント行だけで、テストの期待値と入力は変わっていない
  - _Depends: 1.1_
  - _Boundary: tests/unit/lib_
  - _Requirements: 2.1, 2.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.2 題名を英語にする
  - 日本語を含む題名（64 件・13 ファイル）を、期待値が確かめている振る舞いを述べる英語の題名に書き換える
  - 英語の題名のうち、要件番号・spec 名・AC/FR/NFR・経緯（「前回」など）を含むものも、同じ規則で書き換える
  - `.each` の書式指定（`%s`・`%i` など）は残す。日本語も要件番号なども含まない英語の題名は、文言を変えない
  - 英語にすると意味が変わる題名は、推測で訳さず、作業を止めて報告し、判断を受ける
  - 書き換えた題名の件数と、`it.each` の展開後の件数が変わっていないことを確かめる
  - _Depends: 2.1_
  - _Boundary: tests/unit/lib_
  - _Requirements: 2.1, 3.2, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 2.3 この単位を確認し、許容リストの項目を消す
  - `commentRules.ts --emit-allowlist` の出力で、対象のパスの違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で対象のパスの項目を Edit で消す（JSON 全体を作り直さない）
  - `npx vitest run -c config/test/vitest.unit.config.ts tests/unit/lib` の失敗件数が 0 件で、件数が 1.1 の記録と一致する
  - 題名の検索（要件番号・`specs/`・AC/FR/NFR・経緯）と題名の検査（日本語を含む題名が 0 件）で、対象のパスに該当が無い
  - `git diff` の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 2.2_
  - _Boundary: tests/unit/lib, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.2, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 3. tests/unit/scripts/importRules.test.ts の書き換え
- [x] 3.1 コメントと題名を書き換える
  - 先頭ヘッダとインラインコメントを、4.1〜5.5 の規則に従って書き換える（要件番号・経緯・spec 名を取り除く）
  - 日本語を含む題名 55 件（`it.each` の 91 行目の題名を含む）と、題名の要件番号（「（要件 x.y）」など）・経緯を含む英語の題名を、期待値が確かめている振る舞いを述べる英語の題名に書き換える。題名が多いため、テストの件数（`it` と `describe` の増減なし）を、書き換えの後に確かめる
  - 「R1」「R4a」などの規則の番号は、題名の振る舞いの説明に残さない（規則の名前が必要なら、説明の中の語で書く）
  - 題名が spec 名を含む場合（「前回の残件」など）は、経緯を取り除く
  - _Depends: 2.3_
  - _Boundary: tests/unit/scripts/importRules.test.ts_
  - _Requirements: 2.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 3.2 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、`tests/unit/scripts/importRules.test.ts` の違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で対象のパスの項目を消す
  - `vitest run` で `importRules.test.ts` を実行し、失敗件数が 0 件で、件数が 1.1 の記録（対象のファイルの件数）と一致する
  - 題名の検索で、対象のファイルに要件番号・spec 名の残りが無い。題名の検査（日本語を含む題名）が 0 件である
  - 差分の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 3.1_
  - _Boundary: tests/unit/scripts/importRules.test.ts, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 4. tests/unit/scripts の残りの書き換え
- [x] 4.1 コメントを書き換える
  - 対象は `tests/unit/scripts/` の `importRules.test.ts`・`commentRules.test.ts` 以外の全ファイル（`kiroGate.test.ts` などを含む）
  - 先頭ヘッダが無いもの・6 行を超えるもの・箇条書きが 3 件を超えるものを、規則の範囲に収める
  - 要件番号・AC・spec 名（`comment-policy` など）・経緯・`cc-sdd`・`kiro` の語をコメントから取り除く。`kiroGate.test.ts` の `kiro` は、検証する対象のコマンド名であり、コメントでは言い換える
  - `commentRules.test.ts` のコメントは書き換えない（`comment-policy` の担当。違反は comment-policy で解消する）。同ファイルの題名は 4.2 で扱う
  - _Depends: 3.2_
  - _Boundary: tests/unit/scripts（importRules.test.ts・commentRules.test.ts を除く）_
  - _Requirements: 2.1, 2.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4.2 題名を英語にする
  - 日本語を含む題名 186 件（`commentRules.test.ts` の 20 件を含む。`importRules.test.ts` の 55 件は 3.1 で扱う）を、期待値が確かめている振る舞いの英語の題名に書き換える
  - 題名の要件番号（「（要件 x.y）」「（要件 x.y・z.w）」）・spec 名（「src-pages-thin 6.1」「components-small-areas 2.3」など）・経緯（「前回の残件」）を含む英語の題名も、同じ規則で書き換える
  - 「所有 spec」「spec の要約」など、概念の名前として使われる `spec` の語は残す（具体的な spec 文書を指さないため）。残した語は報告に挙げる
  - 「kiro コマンド」など、検証する対象の名前として使われる語は残し、報告に挙げる（6.5）
  - `commentRules.test.ts` の題名は、検査の規則の名前と入力例を説明する文言として英語にする。入力の文字列（禁止パターンの例）は変えない
  - 書き換えた題名の件数と、`it.each` の展開後の件数が変わっていないことを確かめる
  - _Depends: 4.1_
  - _Boundary: tests/unit/scripts（importRules.test.ts を除く。commentRules.test.ts は題名のみ）_
  - _Requirements: 2.1, 3.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 4.3 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、`tests/unit/scripts/` の対象の違反（`commentRules.test.ts` を除く）が 0 件である
  - 許容リストから、所有者 `comments-tests` で `tests/unit/scripts/` の項目を消す
  - `tests/unit/scripts`（`commentRules.test.ts` を除く）の vitest 実行の失敗件数が 0 件で、件数が 1.1 の記録と一致する
  - 題名の検査で、`tests/unit/scripts/` の日本語を含む題名が 0 件である
  - 差分の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 4.2_
  - _Boundary: tests/unit/scripts（commentRules.test.ts を除く）, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 5. tests/unit のその他（components・support・util・fixtures）の書き換え
- [x] 5.1 コメントと題名を書き換える
  - 対象は `tests/unit/components/`・`tests/unit/support/`・`tests/unit/util/`・`tests/unit/fixtures/`（`tests/fixtures/` の外）
  - 先頭ヘッダと禁止パターン（`steeringStructure.ts` の「kiro」を含む）を、4.1〜5.5 の規則に従って書き換える
  - 日本語を含む題名 30 件（`tests/unit/components/` 28 件・`tests/unit/util/` 2 件）を英語にする。英語の題名のうち、要件番号・spec 名・経緯を含むものも、同じ規則で書き換える
  - _Depends: 4.3_
  - _Boundary: tests/unit（components・support・util・fixtures）_
  - _Requirements: 2.1, 2.3, 3.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 5.2 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、対象のパスの違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で対象のパスの項目を消す
  - `vitest run tests/unit/components tests/unit/support tests/unit/util tests/unit/fixtures` の失敗件数が 0 件で、件数が 1.1 の記録と一致する
  - 題名の検査で、対象のパスの日本語を含む題名が 0 件である
  - 差分の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 5.1_
  - _Boundary: tests/unit（components・support・util・fixtures）, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 6. tests/route の書き換え
- [x] 6.1 pages・outbound の書き換え
  - 対象は `tests/route/pages/`（9 ファイル）と `tests/route/outbound/`（1 ファイル）
  - 先頭ヘッダ（不足を含む）と禁止パターン（要件番号など）をコメントから取り除く（4.1〜5.5）
  - 日本語を含む題名 26 件（`tests/route/pages/` の 7 ファイル。`scheduleCleanup.test.ts` の「（要件 2.4）」を含む）を英語の振る舞いの題名にする。英語の題名のうち、要件番号・経緯を含むものも、同じ規則で書き換える
  - 書き換えた題名の件数と、`it.each` の展開後の件数が変わっていないことを確かめる
  - _Depends: 5.2_
  - _Boundary: tests/route（pages・outbound）_
  - _Requirements: 2.1, 3.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 6.2 schedule・session・survey・support の書き換え
  - 対象は `tests/route/schedule/`（5 ファイル）・`tests/route/session/`（3 ファイル）・`tests/route/survey/`（3 ファイル）・`tests/route/support/`（4 ファイル）
  - コメントを、6.1 と同じ規則で書き換える。`d1-isolation-a/b.test.ts` と `time-injection.test.ts` の要件番号を含むコメントを取り除く
  - `runner.test.ts` の日付を含むコメントは、バッククォートの外なら取り除くか、入力例として囲む（5.1）
  - 日本語を含む題名は 0 件（確認のみ）。英語の題名に要件番号・spec 名・経緯が無いことを確かめ、あれば 6.1 と同じ規則で書き換える
  - _Depends: 6.1_
  - _Boundary: tests/route（schedule・session・survey・support）_
  - _Requirements: 2.1, 3.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.6_

- [x] 6.3 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、`tests/route/` の違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で `tests/route/` の項目を消す
  - `npx vitest run -c config/test/vitest.route.config.ts tests/route` の失敗件数が 0 件で、件数が 1.1 の記録と一致する
  - 題名の検査で、`tests/route/` の日本語を含む題名が 0 件である
  - 差分の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 6.2_
  - _Boundary: tests/route, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 7. tests/component と tests/render の書き換え
- [x] 7.1 コメントと題名を書き換える
  - 対象は `tests/component/`（common・composer・i18n・support の 7 ファイル）と `tests/render/components/`（1 ファイル）
  - `tests/render/astro.d.ts` は対象外（`*.d.ts`）
  - 先頭ヘッダ（不足を含む）と禁止パターンを、4.1〜5.5 の規則に従って書き換える
  - 日本語を含む題名 9 件（`tests/component/composer/ThreadComposer.test.tsx` 4 件・`tests/component/i18n/renderSlots.test.tsx` 5 件）を英語にする。英語の題名のうち、要件番号・spec 名・経緯を含むものも、同じ規則で書き換える。`tests/render/` の題名は日本語を含まない
  - _Depends: 6.3_
  - _Boundary: tests/component, tests/render_
  - _Requirements: 2.1, 3.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [x] 7.2 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、`tests/component/` と `tests/render/` の違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で対象のパスの項目を消す
  - `npx vitest run -c config/test/vitest.component.config.ts` と `npx vitest run -c config/test/vitest.astro.config.ts` の失敗件数が 0 件で、件数が 1.1 の記録と一致する
  - 題名の検査で、`tests/component/` と `tests/render/` の日本語を含む題名が 0 件である
  - 差分の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 7.1_
  - _Boundary: tests/component, tests/render, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 8. tests/support と tests/e2e の書き換え
- [x] 8.1 tests/support のコメントを書き換える
  - 対象は `tests/support/`（`fakeBluesky/` の 4 ファイルと `fakeOutbound.ts`）
  - 先頭ヘッダ（不足を含む）と禁止パターン（要件番号など）を、4.1〜5.5 の規則に従って書き換える
  - 偽の Bluesky の応答の内容（固定の値・経路）は変えない
  - 日本語を含む題名は 0 件（確認のみ）
  - _Depends: 7.2_
  - _Boundary: tests/support_
  - _Requirements: 2.1, 2.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8.2 tests/e2e のコメントを書き換える
  - 対象は `tests/e2e/flows/`（8 ファイル。`support.ts` と、利用者の六つの流れ・`util-placement.spec.ts`）
  - 先頭ヘッダ（不足を含む）と禁止パターン（要件番号・`要件` の語）を、4.1〜5.5 の規則に従って書き換える
  - 題名は、日本語を含むものが 0 件であることと、要件番号・spec 名・経緯を含むものがないことを確かめ、あれば 6.1 と同じ規則で書き換える（E2E の題名に要件番号が無いことを確かめる）
  - `tests/e2e/.auth/` は Git 管理外のため対象外
  - _Depends: 8.1_
  - _Boundary: tests/e2e_
  - _Requirements: 2.1, 2.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3, 6.6_

- [ ] 8.3 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、`tests/support/` と `tests/e2e/` の違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で対象のパスの項目を消す
  - e2e の実行（`npm run test:e2e`）は、この spec では行わない（最後の e2e は comments-api-schema が実行する）。ここでは `npx playwright test --list -c config/test/playwright.config.ts` の件数が 1.1 の記録と一致することを確かめる
  - 差分の変更行が、コメント行・題名の文字列・許容リストの項目の削除に限られる
  - _Depends: 8.2_
  - _Boundary: tests/support, tests/e2e, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.1, 2.3, 2.4, 3.1, 3.3, 6.6, 7.1, 7.2, 7.3, 8.1, 8.2_

- [ ] 9. tests/live と config/test の書き換え
- [ ] 9.1 コメントと題名を書き換える
  - 対象は `tests/live/atprotoContract.test.ts` と `config/test/` の 7 ファイル（`playwright.config.ts`・`stryker.config.mjs`・`vitest.astro.config.ts`・`vitest.component.config.ts`・`vitest.live.config.ts`・`vitest.route.config.ts`・`vitest.unit.config.ts`）
  - 先頭ヘッダ（不足・6 行超・箇条書き 3 件超）と禁止パターン（要件番号・spec 参照・`kiro`）を、4.1〜5.5 の規則に従って書き換える
  - 日本語を含む題名 4 件（`tests/live/atprotoContract.test.ts`）を英語にする。`config/test/` は題名が無い（コメントのみ）
  - 設定の値（閾値・`include`・`exclude`・環境・タイムアウト）は変えない。コメントと題名の書き換えだけを行う
  - 日付を含むコメントは、バッククォートの外なら取り除く
  - _Depends: 8.3_
  - _Boundary: tests/live, config/test_
  - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.6, 6.7_

- [ ] 9.2 この単位を確認し、許容リストの項目を消す
  - `--emit-allowlist` の出力で、`tests/live/` と `config/test/` の違反が 0 件である
  - 許容リストから、所有者 `comments-tests` で対象のパスの項目を消す（`config/test/` の 14 件を含む）
  - `git diff -- config/test` で、変更が行コメントとブロックコメントに限られ、閾値・対象・環境の値が変わっていない
  - 題名の検査で、`tests/live/` の日本語を含む題名が 0 件である
  - `npx vitest run -c config/test/vitest.live.config.ts` は実行しない（ゲートに入らず、実アカウントを使うため）。`tests/live` は、構文と型の確認（10.1）に含める
  - _Depends: 9.1_
  - _Boundary: tests/live, config/test, config/comments/allowlist.json_
  - _Requirements: 1.1, 2.2, 2.3, 2.4, 6.6, 7.1, 7.2, 7.3, 8.1_

- [ ] 10. 最終確認と報告
- [ ] 10.1 型・imports の確認
  - `npm run test:type` が通る（`tests/live` の型を含む）
  - `npm run test:imports` が通る
  - _Depends: 9.2_
  - _Boundary: 検証_
  - _Requirements: 8.3_

- [ ] 10.2 層ごとの件数と結果の確認
  - unit・component・route・render の全体の実行（`npm run test:unit`・`test:component`・`test:route`・`test:render`）の成功件数・失敗件数・スキップ件数が、1.1 の記録と一致する（題名の変更だけで、件数が変わっていない）
  - unit 層の分岐カバレッジの閾値が満たされている（全体の実行の結果による）
  - _Depends: 10.1_
  - _Boundary: 検証_
  - _Requirements: 2.4, 3.1, 3.3, 8.3_

- [ ] 10.3 整形を伴う実行の後の、対象外の変更の確認
  - 整形を伴う実行（`prettier --write` を含むもの）を行った場合だけ、実行の前後の `git status` を比べ、新たに変わったファイルのうち本 spec の対象外のものを確かめる
  - 差分が整形（`prettier`）のみのものは、comments-* の単位の外の整形差分だけを戻す（他の spec の変更は戻さない）
  - この spec の完了条件の実行（10.1・10.2）は整形を伴わない。`npm run test:e2e` は実行しない
  - _Depends: 10.2_
  - _Boundary: 検証_
  - _Requirements: 1.2, 1.3, 8.5_

- [ ] 10.4 全体の検査と許容リストの確認
  - 題名の検索（リポジトリ全体の `tests/` と `config/test/`）で、要件番号・`specs/`・AC/FR/NFR のタグ・経緯の語が残っていない（`tests/fixtures/` は検索の対象外だが、同じ語が無いことを確かめる）
  - 題名の検査（`design.md` の「題名の検査」の (a)・(b)）で、`tests/`（`tests/fixtures/` を除く）と `config/test/` の describe・it・test の題名に日本語が 0 件である。両方の件数を報告に含める
  - 許容リストの所有者 `comments-tests` の項目が 0 件である（7.4）
  - `commentRules.test.ts` のコメントは本 spec の対象外。その全体の結果が失敗する場合は、原因が `comments-lib`・`comments-components-pages`・`comments-scripts-config`・`comments-api-schema` の未完了の項目であることを確かめて報告する（8.4）
  - _Depends: 10.3_
  - _Boundary: 検証, config/comments/allowlist.json_
  - _Requirements: 1.1, 6.1, 6.6, 7.4, 8.4, 8.6_

- [ ] 10.5 報告
  - 変更したファイルの一覧、許容リストから消した項目の件数（198 件から減った数）、各層の件数の前後の比較を報告する
  - 書き換えた題名の件数（単位ごと・合計。U1 64・U2 241・U3 30・U4 26・U5 9・U7 4 の内訳と、U0 で確定した件数との差）と、題名の検査（(a)・(b)）の結果が 0 件であることを報告する
  - 英語にできず判断を受けた題名（ファイル・行・理由）、判別に迷って残したコメントと題名（ファイル・行・理由）、残した `spec`・`kiro` の語（6.5 の判断）を報告する
  - _Depends: 10.4_
  - _Boundary: 報告_
  - _Requirements: 5.4, 6.2, 6.5, 6.7, 9.1_
