# 要件書

## 概要

`tests/`（fixture を除く）と `config/test/` に残る、要件番号・spec 名・経緯・AC/FR/NFR タグを取り除く。対象は、コメントと、テストの題名（`describe`・`it`・`test` の文字列）である。コメントは `.kiro/steering/comments.md` の基準に従う。題名は、日本語を含むものをすべて英語にし（374 件・51 ファイル）、要件番号・spec 名・経緯を含むものは、検証している振る舞いを述べる英語の題名に書き換える。題名の言語の決定は design.md の「決定」を参照する。

振る舞いと検証の内容は変えない。テストの期待値、入力、前後処理、設定の値は変更しない。テストの件数も、作業の前後で同じにする。

## 境界の文脈

- **対象内**: `tests/` 配下（`tests/fixtures/` を除く）と `config/test/` 配下の `.ts`・`.tsx`・`.mjs`・`.astro` のコメントと題名（題名は、日本語を含むもの 374 件と、要件番号・spec 名・経緯を含む英語の題名）。`config/comments/allowlist.json` のうち、所有者が `comments-tests` の項目（対象のパスに限る）。
- **対象外**: `src/`・`scripts/`・`hack/`・`config/`（`config/test/` 以外）・`.kiro/steering/` の変更。`tests/fixtures/`（検査の対象外で、現在も要件番号や spec 参照を含まない）。振る舞い、テストの期待値、設定の値、`package.json` のスクリプト。`tests/unit/scripts/commentRules.test.ts` のコメント（`comment-policy` の担当。この spec では変えない）。同ファイルの題名は対象内で、英語にする。
- **隣接する期待**: comments-lib・comments-components-pages・comments-scripts-config・comments-api-schema は、それぞれの所有する許容リストの項目を消す。本 spec は、所有者が `comments-tests` の項目だけを消す。`tests/live/`（`npm run test:live`）は、ゲートに入らないが、対象のコメントと題名は同じ規則で書き換える。
- **既存の仕様との関係**: テストの方針は `.kiro/steering/testing.md` が正本。本 spec は方針を変えない。題名の言語は英語に決定済み（`testing.md` 68 行目「テストの題名は英語。」、`test-foundation` の要件 3.3。design.md の「決定」）。
- **前提**: `comment-policy`（コメントの基準 `.kiro/steering/comments.md`、検査 `scripts/architecture/commentRules.ts`、許容リストの項目の規則）が完了していること。この spec は、その検査の結果と許容リストを前提にする。前提が未完了の間は、`spec.json` の `ready_for_implementation` は false のままにする（理由は設計書の「実装の前提」）。

## 要件

### 1. 対象と変更の範囲

**目的:** 開発者として、この作業で変わる箇所が、コメントと題名に限られていてほしい。テストが検証する振る舞いが変わらないことを、差分で確かめられるようにするため。

#### 受入基準

1. The 作業 shall `tests/` と `config/test/` の `.ts`・`.tsx`・`.mjs`・`.astro` ファイルのうち、コメントまたは題名に第 4〜6 要件の対象（先頭ヘッダの不足、禁止パターン、経緯、要件番号を含む題名、日本語を含む題名）があるファイルだけを変更する。
2. The 作業 shall `tests/fixtures/` 配下のファイルを変更しない。
3. The 作業 shall 対象の外（`src/`・`scripts/`・`hack/`・`config/`（`config/test/` を除く）・`.kiro/steering/`・`package.json`）のファイルを変更しない。`tests/unit/scripts/commentRules.test.ts` は題名だけを変え、コメントは変えない。ただし `config/comments/allowlist.json` の項目の削除は、第 7 要件の範囲で行う。

### 2. 振る舞いと期待値の不変

**目的:** 開発者として、テストの書き換えが検証の中身を変えていないと確かめたい。題名と注釈の変更で、テストが通るように見せかけないため。

#### 受入基準

1. The 作業 shall テストの期待値（`expect` の引数と照合の種類）、入力、前後処理（`beforeAll`・`afterEach` など）、モックの設定を変更しない。
2. The 作業 shall `config/test/` の設定ファイルについて、閾値・対象（`include`・`exclude`）・環境・実行オプションの値を変更しない。コメントだけを変更する。
3. The 作業 shall 差分の変更行が、コメント行、題名の文字列、または許容リストの項目の削除のいずれかに限られていることを、差分で確かめる。
4. If 差分に、これら以外の行の変更が含まれる, then the 作業 shall その変更を取り消す。

### 3. テストの件数

**目的:** 開発者として、題名の書き換えでテストが増えたり消えたりしないでほしい。件数の変化は、検証の範囲が変わったことを意味するため。

#### 受入基準

1. The 作業 shall 層ごと（unit・component・route・render・e2e）に、テストの件数（成功・失敗・スキップの合計）を、作業の前に記録し、作業の後に同じ数であることを確かめる。
2. When 題名を書き換えたとき, the 作業 shall `it.each`・`test.each` の展開後の題名が変わっても、展開された件数が変わらないことを確かめる。
3. If 件数が変わった, then the 作業 shall その変更を取り消し、原因を報告する。

### 4. 先頭ヘッダ

**目的:** 読む人として、テストファイルを開いたときに、何を検証するファイルかが先頭で分かるようにしたい。

#### 受入基準

1. When 対象のファイル（`tests/`・`config/test/` の `.ts`・`.tsx`・`.mjs`・`.astro`）に先頭ヘッダが無いとき, the 作業 shall `.kiro/steering/comments.md` の先頭ヘッダの規則に従い、目的を 1〜2 行で書いたブロックコメントを先頭に加える。
2. When 既存の先頭ヘッダが 6 行を超える、または箇条書きが 3 件を超えるとき, the 作業 shall 制約（不変条件・外部仕様・動作の前提）だけを残し、規則の範囲に収める。
3. The 作業 shall 先頭ヘッダに、検証する振る舞いの目的を書く。ファイルの経緯、spec 名、要件番号は書かない。
4. The 作業 shall 先頭ヘッダを、コードの言い換え（どの関数を呼ぶか、どの値を入れるかの説明）にしない。

### 5. インラインコメント

**目的:** 開発者として、コメントを読めば現在の振る舞いと理由が分かるようにしたい。作業の経緯や要件への参照で読み手が迷わないようにするため。

#### 受入基準

1. The 作業 shall コメントから、`.kiro/steering/comments.md` の「書かない」の一覧に当たるもの（要件番号（「要件 x.y」など）、AC・FR・NFR のタグ、spec 名（`comment-policy`・`src-pages-thin` など）、`cc-sdd`・`kiro` の語、経緯、日付入りの決定）を取り除く。語の一覧の正本は `comments.md` にあり、この spec では語を追加しない。
2. When コメントに、非自明な理由（回避策、外部仕様の癖、順序の制約、テストの前提）が含まれるとき, the 作業 shall その理由を、現在形で残す。
3. The 作業 shall コードの内容をそのまま言い換えただけのコメント（「値を返す」「変数を宣言する」など）を削る。
4. If 判別に迷うコメントがある, then the 作業 shall そのコメントを残し、完了時の報告に、ファイルと行と判断の理由を挙げる。
5. The 作業 shall コメントの禁止パターンを、語の言い換えで解消する。コードの文字列（パスの指定など）は変更しない。

### 6. テストの題名

**目的:** 開発者として、テストの題名を見れば、何の振る舞いを検証しているかが分かるようにしたい。要件番号と spec 名は、テストを読む手がかりにならないため。

#### 受入基準

1. When 題名（英語の題名を含む。`describe`・`it`・`test` の文字列）に要件番号（「要件 x.y」「要件 10」、「・」で並ぶ番号を含む）、spec 名、AC・FR・NFR のタグ、または「前回の残件」などの経緯があるとき, the 作業 shall その題名を、検証している振る舞いを述べる英語の題名に書き換える。
2. The 作業 shall 書き換えた題名を英語で書く（`.kiro/steering/testing.md` の「テストの題名は英語」に従う）。
3. The 作業 shall 日本語も要件番号・spec 名・経緯も含まない英語の題名の文言を変えない。
4. The 作業 shall 題名を、テストの期待値に合う振る舞いの名前にする。期待値と異なる振る舞いを題名に書かない。
5. If 題名に「kiro」「spec」の語が、実在するコマンドや概念の名前として使われており、spec 文書への参照ではない, then the 作業 shall その語を題名に残し、完了時の報告に挙げる。
6. The 作業 shall 日本語を含む `describe`・`it`・`test` の題名（`.each` を含む）を、すべて英語に書き換える（範囲は全件。`testing.md` の「テストの題名は英語」と `test-foundation` の要件 3.3 に従う）。`.each` の書式指定（`%s`・`%i` など）は残す。
7. If 英語にすると題名が示す振る舞いが変わる（期待値の意味を訳で保てない）, then the 作業 shall その題名を推測で訳さず、作業を止め、ファイル・行・理由を完了時の報告に挙げてユーザーの判断を受ける。

### 7. 許容リスト

**目的:** 開発者として、許容リストが実際の違反と一致していてほしい。解消済みの項目が残ると、検査が失敗するため。また、新しい違反を黙って許容しないため。

#### 受入基準

1. When 対象のファイルの違反（禁止パターン・先頭ヘッダの規則の違反）を直したとき, the 作業 shall そのファイルの項目（所有者が `comments-tests` のもの）を `config/comments/allowlist.json` から、同じ変更の中で消す。
2. The 作業 shall 許容リストに項目を追加しない。`--emit-allowlist` の出力で許容リストを上書きしない。
3. The 作業 shall 所有者が `comments-tests` 以外の項目を消さない。
4. When 対象の全ファイルを直したとき, the 作業 shall `config/comments/allowlist.json` の所有者 `comments-tests` の項目が 0 件であることを確かめる。

### 8. 検証

**目的:** 開発者として、作業が完了したことを、結果で確かめられるようにしたい。

#### 受入基準

1. When 層（ディレクトリ）ごとの作業を終えたとき, the 作業 shall 対象のディレクトリについて、`npx tsx scripts/architecture/commentRules.ts --emit-allowlist` の出力に対象のパスの違反が無いことを確かめる。
2. When 層ごとの作業を終えたとき, the 作業 shall その層のテストが成功し、件数が第 3 要件を満たすことを確かめる。
3. When 全体の作業を終えたとき, the 作業 shall `npm run test:type`・`npm run test:imports`・unit・component・route・render が通ることを確かめる。e2e の実行は、この spec の完了条件に含めない（最後の e2e は comments-api-schema が実行する）。
4. If `tests/unit/scripts/commentRules.test.ts` が、`comments-tests` 以外の所有者の項目に起因して失敗する, then the 作業 shall その失敗が他の `comments-*` spec の未完了によるものであることを報告し、本 spec の完了条件から外す。
5. If 整形を伴う実行（`prettier --write` を含むもの）の後に、対象外のファイルが変わった, then the 作業 shall comments-* の単位の外の整形差分だけを戻す。
6. When 全体の作業を終えたとき, the 作業 shall `tests/`（`tests/fixtures/` を除く）と `config/test/` の `describe`・`it`・`test` の題名（`.each` を含む）に日本語が 0 件であることを、題名の検査で確かめる（同一行の形と、`.each`・`skipIf` の後ろに続く複数行の形の両方）。

### 9. 報告

**目的:** 開発者として、判断が要る箇所を、作業の結果と一緒に確認したい。判別の結果を黙って残さないため。

#### 受入基準

1. When 作業を完了したとき, the 作業 shall 次を報告する: 変更したファイルの一覧、書き換えた題名の件数（単位ごと・合計）、日本語を含む題名の検査の結果（0 件であること）、残したコメントと題名のうち判別に迷ったもの（ファイル・行・理由）、英語にできず判断を受けた題名（ファイル・行・理由）、許容リストから消した項目の件数、各層の件数の前後の比較。
