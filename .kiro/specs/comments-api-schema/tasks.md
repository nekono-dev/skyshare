# Implementation Plan

本 spec の作業はすべて同じ生成元の説明文を編集するため、`(P)` は付けず、順に行う。

**実行の順序**: comment-policy → comments-lib → 本 spec のタスク 1（基準の保存） → comments-components-pages / comments-tests / comments-scripts-config → 本 spec のタスク 2〜4（説明文の書き換え、再生成と比較、許容リスト、検証） → 全 comments-* の完了後に、タスク 5.1（e2e を一度だけ実行）。

- [x] 1. 前提の確認と変更前の基準の記録（ベースラインの保存）
- [x] 1.1 前提を確かめ、生成物と OpenAPI の JSON を変更前の基準として保存する
  - 前提: comment-policy の基準（`comments.md`）と検査が完了していること。許容リストに、所有 spec が `comments-lib` の項目が残っていない（comments-lib が完了している）こと。残っていれば、本 spec の作業を始めず、報告して止まる。
  - 基準の保存は、本 spec の他のタスクと、他の comments-* の変更（生成の入口の二つのファイルを含む）より前に行う。
  - 変更前に、現在の生成元から生成物を作り直し、生成物の写しと OpenAPI の JSON を作業用の領域（リポジトリの外）に保存する。
  - 比較に使う作業用の手順（OpenAPI の JSON の比較と、生成物の変更行の確認）を、作業用の領域に用意する。
  - 完了した状態: 生成をもう一度行うと、写しと同一の生成物になる。基準の写しと JSON が作業用の領域にあり、比較の手順が動く。
  - _Boundary: 生成と比較_
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.2 説明文と検査の違反の一覧を作る
  - 生成元のすべての route の `summary`、zod の `description`、応答の `description`（複数行の値を含む）と、検査の違反（所有 spec が本 spec の 5 件を含む）を、作業用の領域に一覧にし、各項目に区分（残す・直す・判断に迷う）を付ける。
  - 完了した状態: 一覧に、説明文の全値と 5 件の違反が含まれ、区分の付いていない項目が無い。
  - _Boundary: 説明文の監査_
  - _Requirements: 1.1, 3.1_

- [x] 2. 説明文とコメントの書き換え
- [x] 2.1 route の `summary` を実装と照らし、食い違うものを直す
  - 各 `summary` の主張（何をするか、副作用、認証）を、対応する handler と、その処理の実装で確かめる。`summary` に数値の上限の文章があれば取り除く（タスク 2.2 と同じ規則）。
  - 完了した状態: すべての `summary` が現在の振る舞いを述べている。直すと形の変更が要るものは、直さずに残し、報告に挙げる。
  - _Boundary: 説明文の監査_
  - _Requirements: 1.1, 1.2, 2.4_

- [x] 2.2 summary・description から数値の上限の文章を取り除く（上限は zod だけに置く）
  - 各 `description` の主張を実装で確かめる。`summary` と `description` の文字列から、数値の上限（件数・文字数・期間・回数など）の文章を取り除く。取り除く対象は research.md の「数値の上限の文章（取り除く対象）」の一覧のとおり。上限は zod の制約（`.max` など）だけで表す。zod の制約は追加・削除・変更しない。
  - 完了した状態: `summary` と `description` のどの文字列にも、数値の上限の文章が無い（research.md の一覧の 2 件が取り除かれている）。zod の制約はすべて残っている。生成物の `@maxItems` などは変わらない。zod の制約の変更は無い。
  - _Boundary: 説明文の監査, zod 制約の単一の出どころ_
  - _Requirements: 1.1, 1.2, 1.4, 2.3, 2.4_

- [x] 2.3 生成物の `summary` と `description` が 1 行になるようにする
  - 複数行の値は、生成物で 1 行になるように書く。文体は既存の動詞句のまま保つ。
  - 完了した状態: 生成物のどの `summary` と `description` も、複数行にならない。
  - _Boundary: 説明文の書式_
  - _Requirements: 1.3_

- [x] 2.4 禁止パターンを取り除き、5 件の違反を解消する
  - 生成元の文字列とコメントから、spec 参照、要件番号、AC タグ、cc-sdd、kiro、入力例の外の日付を取り除く。先頭ヘッダを 6 行以内・箇条書き 3 件以内にする。
  - 完了した状態: 検査は生成元の配下に違反を報告しない。複数行の値を含む生成元の全行に、禁止パターンが無い（全行の検索で確かめる）。
  - _Boundary: コメント基準の適用_
  - _Requirements: 3.1, 3.2, 4.1_

- [x] 2.5 生成元の残りのコメントを基準に照らして確かめる
  - 生成元の各コメントについて、経緯、コードの言い換え、理由の有無を確かめる。明らかに基準から外れるものは削り、判断に迷うものは残して報告に挙げる。
  - 完了した状態: 残ったコメントは現在の振る舞いまたは理由を述べている。判断に迷うコメントは、残されて報告に挙がっている。
  - _Boundary: コメント基準の適用_
  - _Requirements: 3.3, 3.4_

- [x] 2.6 複数行の値を含む生成元の全行を、禁止パターンで grep する
  - `src/lib/api/schema` の全行に、禁止パターン（spec 参照・要件番号・AC/FR/NFR タグ・cc-sdd・kiro。`FORBIDDEN_PATTERNS` と同じ語）と、バッククォートの外の日付を当てる grep を行う。検査が見ない `summary:` の次の行の値と、`description:` を別の行に書いた値を含める。
  - 完了した状態: grep の結果が 0 件である。
  - _Boundary: コメント基準の適用_
  - _Requirements: 1.3, 3.1_

- [x] 3. 生成と変更範囲の確認
- [x] 3.1 生成物を作り直し、変わったのがコメントの行だけであることを確かめる
  - 生成を実行し、基準の写しと比べる。変わった行はすべてコメントの行で、ファイルの増減が無いことを確かめる。
  - 完了した状態: 生成は成功し、比較の結果はコメントの行の変更だけである。
  - _Boundary: 生成と比較_
  - _Requirements: 2.1, 2.2_

- [x] 3.2 OpenAPI の JSON と生成元の差分が、`summary` と `description` だけであることを確かめる
  - 変更前後の OpenAPI の JSON を比べ、変わったキーが `summary` と `description` だけで、制約の値が変わっていないことを確かめる。生成元の git 差分を見て、変わった行がコメントか `summary`・`description` の値であることを確かめる。違反があれば、その変更を戻すか報告に挙げる。
  - 完了した状態: OpenAPI の比較は `summary` と `description` の変更だけを示し、生成元の差分にコードの行の変更が無い（または報告に挙がっている）。
  - _Boundary: 生成と比較_
  - _Requirements: 2.3, 2.4_

- [x] 4. 許容リストと検証
- [x] 4.1 許容リストから本 spec の 5 件を消す
  - 所有 spec が `comments-api-schema` の 5 件だけを消す。他の項目は変えない。許容リストは作り直さない。
  - 完了した状態: 許容リストに、所有 spec が本 spec の項目は残っていない。他の所有 spec の項目は変わっていない。
  - _Boundary: 許容リスト_
  - _Requirements: 4.2_

- [x] 4.2 検査と、既存のテストを実行する
  - コメントの検査と、その単体テスト、単体テストの全体、型検査、import 検査、コンポーネント・route・render の各テストを実行する。
  - 完了した状態: 検査は生成元の配下に違反を報告しない。許容リストの整合のテストが通る。列挙したコマンドがすべて終了コード 0 で終わる。e2e は タスク 5.1 で扱う。
  - _Boundary: 検証_
  - _Requirements: 4.1, 4.3, 4.4_

- [x] 5. 最終統合（comments-* 全体の完了後）
- [x] 5.1 e2e を一度だけ実行し、comments-* の単位の外の整形差分を戻す
  - 前提: 冒頭の実行の順序のとおり、comments-* の全 spec の実装が終わっていること（途中では実行しない）。
  - `npm run test:e2e` を一度だけ実行する。実行後、`git status` で整形（prettier など）の差分を探し、comments-* の単位の外の整形差分だけを戻す。他の変更には触れない。
  - 完了した状態: e2e が終了コード 0 で終わり、comments-* の単位の外の整形差分が残っていない。
  - _Boundary: 検証_
  - _Requirements: 4.5_

## Implementation Notes

### 完了の報告（2026-11-11）

- 基準の保存（1.1）: 変更前に `npm run codegen` を実行し、生成物の写しと OpenAPI の JSON（`buildOpenApiDocument()` の出力）を作業用の領域に保存した。再生成は写しと同一だった。他の comments-* より前に行った。
- 比較（3.1・3.2）: 再生成した生成物は、変更前の写しと比べて、ファイルの増減が無く、コメント以外の差分が無い。OpenAPI の JSON で変わったキーは `summary` と `description` だけ。`src/lib/api/schema` の git 差分に、zod の制約（`.max`・`.min` など）の変更行は無い。変更は 33 ファイル。
- 説明文の変更: 数値の上限の文章を 2 件取り除いた（`common.ts` の `listUris` の `description`、`v2/feedback/post.ts` の `createFeedback` の `summary` の「one per minute per account」。後者は生成物から消える）。`v2/entry/delete.ts` の `summary` は、実装（source から続く自分の返信投稿も削除する）に合わせて直した。`v2/entry/post.ts` の `summary` は、entry を任意で関連付ける説明に直した。複数行の値は 1 行にした。英語の動詞句の文体は変えていない。
- 判断に迷って残したもの: `v2/feedback/post.ts` の `requiredText` の `description`（`Non-blank, up to ${max} graphemes`）は、数値の上限を含む。この上限は zod の `.max` ではなく `refine`（書記素の数え方が文字数と違うため）で検査しており、`maxLength` として生成物に出ないため、この説明を取り除くと上限が生成物のどこにも残らない。値は `FEEDBACK_LIMITS` から作る。独立レビューが指摘したが、情報を失うため残した（要件 1.4 の対象外と判断。ユーザーの判断を受ける）。
- 検証: 許容リストの所有 `comments-api-schema` の 5 件を消した。`npm run test:type`・`test:imports`・`test:unit`（704 件通過・1 件スキップ）・`test:component`（13）・`test:route`（212）・`test:render`（2）が終了コード 0。
- 5.1: comments-* の全 spec の実装が終わった後に `npm run test:e2e` を一度だけ実行し、終了コード 0。実行後の `git status` に整形の差分は無かった。
- 許容リストの最終状態: 項目は 1 件だけ（`scripts/agent/kiro-gate.mjs` の `forbidden:kiro`。許容する例外として理由付き。comments-scripts-config）。
- 委譲: 説明文の監査と書き換え（2.1〜2.6）と独立レビューは Codex に委譲した。基準の保存・比較・許容リストの項目の削除・コミットは直接行った。

### feature 検証（kiro-validate-impl, 2026-11-11）

- 判定は `GO`。タスクは全て `[x]`、`_Blocked:_` は無い。全テストと e2e が終了コード 0。変更は `src/lib/api/schema` のコメントと説明文だけで、API の形と制約は変わらない（OpenAPI の JSON の比較）。
