# 実装計画

対象は `src/lib`（`api/schema` を除く）の 223 ファイル。各領域のグループ（G1〜G7）は「書き直し → 検証 → 許容リストの削除」の順に進め、グループごとに検査とテストを通してから次へ進む。

すべてのタスクは順番どおりに行う（`(P)` は付けない）。理由は、許容リスト（`config/comments/allowlist.json`）と、検査のテストが全体を読む共有の資材であり、並列に変えると互いの検証を壊すため。

基準の正本は `.kiro/steering/comments.md`。書き直しの判断は基準に従い、基準を変えない。

前提: comment-policy の作業 4.1（`tech.md` の改訂）が完了していること。未完了のあいだは実装を始めない（spec.json の `ready_for_implementation` は `false`）。comments-* の spec は直列に行い、並列にしない。

- [x] 1. 作業の前提を確かめる
- [x] 1.1 作業前の基準線を記録する
  - comment-policy の作業 4.1 が完了していることを確かめる。未完了なら、ここで作業を止めて報告する
  - 作業を始める前の HEAD（基準のコミット）を記録する。以後の字句比較は、この版を基準にする
  - 検査で、`src/lib`（`api/schema` を除く）の `comments-lib` の違反が 116 ファイル・193 件であることを確かめる
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type` と `npm run test:imports` が通過することを確かめる
  - 基準線の数値は、完了の報告に書く
  - _Requirements: 5.4, 6.2, 6.5_

- [x] 1.2 字句比較の作業用スクリプトを作る（リポジトリの外の作業用ディレクトリに置く）
  - 基準のコミットの版（`git show` で取り出す）と作業ツリーの版を、字句の種類と字句の文字列で比べ、差分があれば場所を出す
  - コメントだけを変えた一時の版では差分が 0 件になり、コードを 1 字変えた一時の版では差分が出ることを確かめる
  - スクリプトはリポジトリに追加しない
  - _Requirements: 5.1, 5.2_

- [x] 2. G1（`atproto`・`api`・`codegen`・`platform`・`guestMode.ts`）を書き直す
- [x] 2.1 `atproto` のうち `agentFactory.ts` から `nsid.ts` までの先頭ヘッダとコメントを書き直す（14 ファイル、約 700 行）
  - 先頭ヘッダが 6 行以内・箇条書き 3 件以内・目的 1〜2 行になり、`header-missing` が無くなる
  - コメントの行から、`specs/`・要件番号・AC/FR/NFR のタグ・cc-sdd・kiro・バッククォートの外の日付を取り除く（行末のコメントも含む）
  - 経緯（旧実装・移行・「以前は」「かつては」）とコードの言い換えを、現在の理由の文に書き直すか削る。判別に迷ったものは残し、報告に挙げる
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G1 の atproto（前半）_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 2.2 `atproto` のうち `object.ts` から `videoAuth.ts` までの先頭ヘッダとコメントを書き直す（11 ファイル、約 670 行）
  - 2.1 と同じ判断で書き直す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G1 の atproto（後半）_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 2.3 `api`・`codegen`・`platform`・`guestMode.ts` の先頭ヘッダとコメントを書き直す（12 ファイル）
  - 2.1 と同じ判断で書き直す。`api/schema` には触れない
  - 生成に関わる `codegen` のコメントは、生成の振る舞いを変えない範囲で書き直す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G1 の api・codegen・platform・guestMode.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 7.1, 7.2, 7.3_

- [x] 2.4 G1 の検査を通し、許容リストの G1 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G1 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G1 のパスの項目だけを手で消す（他の項目と形式は変えない）
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G1 の全ファイルのコードの行に差分が無い
  - _Boundary: G1 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3. G2（`i18n`）を書き直す
- [x] 3.1 `i18n` の先頭ヘッダとコメントを書き直す（42 ファイル）
  - 2.1 と同じ判断で書き直す。UI の文言（文字列リテラル）は変えない
  - 字句比較で、コードの行（文字列リテラルを含む）に差分が無い
  - _Boundary: G2 の i18n_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 3.2 G2 の検査を通し、許容リストの G2 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G2 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G2 のパスの項目だけを手で消す
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G2 の全ファイルのコードの行に差分が無い
  - _Boundary: G2 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4. G3（`schedule`）を書き直す
- [x] 4.1 `schedule` の先頭ヘッダとコメントを書き直す（30 ファイル）
  - 2.1 と同じ判断で書き直す
  - Cron の経路の制約（`@atproto/*` を読まない、WebCrypto と fetch だけを使う、Free の CPU 制限）の理由は残し、現在形で書く
  - 認可の暗号化・冪等性・順序の制約の理由は、検証できる形で残す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G3 の schedule_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 4.2 G3 の検査を通し、許容リストの G3 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G3 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G3 のパスの項目だけを手で消す
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G3 の全ファイルのコードの行に差分が無い
  - _Boundary: G3 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. G4（`entry`・`timeline`）を書き直す
- [x] 5.1 `entry` の先頭ヘッダとコメントを書き直す（18 ファイル）
  - 2.1 と同じ判断で書き直す
  - 削除の対象の判定など、削除の安全性にかかわる理由は残す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G4 の entry_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 5.2 `timeline` の先頭ヘッダとコメントを書き直す（12 ファイル）
  - 2.1 と同じ判断で書き直す。「最小要件」など、正当な用法の語は変えない
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G4 の timeline_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [x] 5.3 G4 の検査を通し、許容リストの G4 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G4 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G4 のパスの項目だけを手で消す
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G4 の全ファイルのコードの行に差分が無い
  - _Boundary: G4 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6. G5（`survey`・`settings`）を書き直す
- [x] 6.1 `survey` の先頭ヘッダとコメントを書き直す（17 ファイル）
  - 2.1 と同じ判断で書き直す
  - 匿名性の理由（回答者の識別子の扱い、ハッシュの入力）は残し、現在形で書く
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G5 の survey_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 6.2 `settings` の先頭ヘッダとコメントを書き直す（10 ファイル）
  - 2.1 と同じ判断で書き直す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G5 の settings_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 6.3 G5 の検査を通し、許容リストの G5 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G5 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G5 のパスの項目だけを手で消す
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G5 の全ファイルのコードの行に差分が無い
  - _Boundary: G5 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. G6（`session`・`oauth`・`feedback`）を書き直す
- [ ] 7.1 `session` の先頭ヘッダとコメントを書き直す（10 ファイル）
  - 2.1 と同じ判断で書き直す
  - トークンを HttpOnly の Cookie だけに置く理由、`cache-control: no-store`、Cookie の枠の理由は残す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G6 の session_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 7.2 `oauth`・`feedback` の先頭ヘッダとコメントを書き直す（16 ファイル）
  - 2.1 と同じ判断で書き直す
  - OAuth の仕様の参照（RFC・公式の仕様の URL）は残す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G6 の oauth・feedback_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 7.3 G6 の検査を通し、許容リストの G6 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G6 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G6 のパスの項目だけを手で消す
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G6 の全ファイルのコードの行に差分が無い
  - _Boundary: G6 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. G7（`video`・`image`・`share`・`site`）を書き直す
- [ ] 8.1 `video`・`image` の先頭ヘッダとコメントを書き直す（17 ファイル）
  - 2.1 と同じ判断で書き直す
  - 動画の直接送信の理由（Workers を経由しない）と、画像の上限の理由は残す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G7 の video・image_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 8.2 `share`・`site` の先頭ヘッダとコメントを書き直す（14 ファイル）
  - 2.1 と同じ判断で書き直す
  - 字句比較で、コードの行に差分が無い
  - _Boundary: G7 の share・site_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 8.3 G7 の検査を通し、許容リストの G7 の項目を消す
  - 検査（`--emit-allowlist` の出力を読むだけ）で、G7 のファイルに違反が無い
  - `config/comments/allowlist.json` から、所有者 `comments-lib` で G7 のパスの項目だけを手で消す
  - `commentRules.test.ts` が 20 件すべて通過し、`npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 字句比較で、G7 の全ファイルのコードの行に差分が無い
  - _Boundary: G7 の検査と許容リスト_
  - _Requirements: 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. 最終統合の検証
- [ ] 9.1 生成物に差分が出ていないことを確かめる
  - `npm run codegen` を実行し、`src/client` に差分が無い
  - _Boundary: 最終統合_
  - _Requirements: 5.3_

- [ ] 9.2 行末のコメントを含めて残りを確かめる
  - `src/lib`（`api/schema` を除く）の全行を対象に、`specs/`・`要件 数字.数字`・`AC`/`FR`/`NFR` と数字・`cc-sdd`・`kiro`・バッククォートの外の `20YY-MM-DD` を grep し、残りが無い（残す語は、読んで判断した理由とともに報告に挙げる）
  - 「旧」「移行」「以前は」「かつては」の語（`comments.md` の一覧）を grep し、残った箇所を読んで、経緯の記述でないことを確かめる
  - _Boundary: 最終統合_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.3, 7.1_

- [ ] 9.3 許容リストと検査が整合していることを確かめる
  - `config/comments/allowlist.json` の所有者 `comments-lib` の項目が 0 件である
  - 他の所有者の項目の数が、1.1 の基準線から変わっていない（`comments-tests`・`comments-components-pages`・`comments-scripts-config`・`comments-api-schema` の項目の数が 449 件から変わらない）
  - `commentRules.test.ts` が 20 件すべて通過する
  - _Boundary: 最終統合_
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 9.4 全体の検証を通し、判別に迷ったコメントを報告にまとめる
  - `npm run test:type`・`test:imports`・`test:unit`・`test:component`・`test:route`・`test:render` が通過する
  - 判別に迷って残したコメントを、ファイルと行の一覧にして完了の報告に挙げる。また、`tech.md` の先頭ヘッダの記述が基準と食い違う件（comment-policy の作業 4.1 で改訂する、未実施）を、報告に挙げる
  - _Boundary: 最終統合_
  - _Requirements: 4.5, 5.4, 7.1_

## Implementation Notes

### 判別に迷って残したコメント（要件 4.5。タスク 9.4 の報告に使う）

- `src/lib/atproto/richTextSegments.ts:5`（タスク 2.2）: 先頭ヘッダの「`@atproto/*` を import しない。」。守るべき制約か実装の言い換えかを、リポジトリ内の文書と検査から確かめられなかったため残した。
- `src/lib/i18n/messages/en/account.ts:1`・`en/page.ts:1`・`en/post.ts:1`・`en/settings.ts:1`（タスク 3.1）: 「スロット名は日本語辞書と一致させる」。キー集合の一致は型（`messageKeys.ts` の `EnglishMessages`、`messages/en/index.ts`）が検査するが、スロット名の過不足は型で検査されない（`translate.ts` の注記）。編集する人が守る条件として残した。
- `src/lib/entry/legacyPagedb.ts:5`（タスク 5.1）: 「Cloudflare Workers で動作するため Node.js 固有 API を使わない。」。Workers で動くことは `tech.md` にあるが、Node.js 固有 API を使わないという制約の根拠を、文書・検査・import から確かめられなかったため残した。

### 作業の進め方（後続のタスクへの申し送り）

- 関数の JSDoc の「Input:」「Output:」「例:」の節は、既存の書き方として残す（タスク 2.1 の扱いにそろえる）。節の中の個々の行が基準に反するときだけ、その行を直す。
- 先頭ヘッダの箇条書きのうち、実装形態の言い換え（「import を持たない」「型だけを持つ」「値を返すだけ」など）は削る。制約に見えるが理由を確かめられないものは、残してこの一覧に加える。
- 字句の比較は、構文木の末端の字句（コメントを除く）で行う。`createScanner` だけの比較は、`${}` を含むテンプレート文字列の後で誤検出する。
- 2026-11-11 の時点で、`src/lib/atproto` は作業前から検査の違反が 0 件だった（許容リストの `comments-lib` は 167 件）。タスク 1.1 の基準線（193 件、他の所有者 449 件）は現在の値と合わない。現在の他の所有者の合計は 447 件。
- 先頭ヘッダの「6 行以内」は、検査（`comment-rules.ts` の `contentOf`）の数え方で数える。`/**`・`*/` の行と、内容の無いコメント行は数えない（目的 2 行と箇条書き 3 件なら内容 5 行）。
- 長い先頭ヘッダを縮めるときは、作業前のヘッダの文ごとに、残した場所（ヘッダ・宣言の JSDoc・行のコメント）を対応させて確かめる。理由（制約の根拠、数値、失敗時の扱い、実行環境の前提、依存の向き）は、責務の列挙と一緒に削らない。
