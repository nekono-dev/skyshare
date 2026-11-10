# 要件書

## 概要

ソースのコメントの書き方の基準（残す・削る・判別の仕方）を `.kiro/steering/comments.md` に定め、その基準を機械で検査する仕組みを置く。以後の comments-* spec（コメントを領域ごとに書き直す作業）は、この基準を判断の正本にする。

このspec は、基準と検査が**現在の状態で存在する**ことを記録する。基準の内容（何を残し何を削るか）は、この spec では変えない。

2026-11-08 時点の状態:

- 基準: `.kiro/steering/comments.md` がある。
- 検査: `scripts/architecture/commentRules.ts` が、先頭ヘッダの形・禁止パターン・日付を判定する。
- テスト: `tests/unit/scripts/commentRules.test.ts`（20 件）が、判定の正例と負例、リポジトリ全体の違反と許容リストの照合を確かめる。
- 許容リスト: `config/comments/allowlist.json` に 642 件の既存の違反を、所有 spec（comments-*）ごとに記録している。

用語:

- **先頭ヘッダ**: モジュールの先頭にある、目的を書いたブロックコメント（`/** … */`）。シェバン行と Astro のフロントマター（`---`）の後にあってもよい。
- **禁止パターン**: コメント中に書いてはいけない語の形（spec 参照・要件番号・AC/FR/NFR タグ・cc-sdd・kiro）。
- **許容リスト**: 既存の違反のうち、まだ直していないものを、所有 spec と理由を付けて記録した一覧。

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->

## 境界の文脈（任意）

- **対象内**: `.kiro/steering/comments.md`（基準）、`scripts/architecture/commentRules.ts`（検査）、`tests/unit/scripts/commentRules.test.ts`（テスト）、`config/comments/allowlist.json`（許容リスト）。`tech.md` から基準への参照（1 箇所だけ）。
- **対象外**: 個々のファイルのコメントの書き換え（comments-lib・comments-components-pages・comments-tests・comments-scripts-config・comments-api-schema）。文字列リテラル（UI 文言・エラー文言）。振る舞い・API の形・CI の挙動。シェルスクリプト（`.githooks`・`.sh`）の自動検査（レビューで見る）。
- **隣接する期待**: comments-* の各 spec は、担当の項目を許容リストから消すことで完了する。許容リストの項目を消すのは comments-* の作業であり、この spec の作業ではない。comments-* の 5 つの spec は、すべてこの spec に依存する（この spec の完了が前提）。基準を変えたときは、roadmap の Phase 7 を改訂する。

## 要件

### 1. 基準の文書

**目的:** 開発者として、コメントを残すか削るかの判断を一つの文書で決めたい。作業ごとに判断がばらつかないようにするため。

#### 受入基準

1. The 基準の文書 shall `.kiro/steering/comments.md` に置き、対象の拡張子（`.ts`・`.tsx`・`.astro`・`.mjs`）と対象のディレクトリ（`src`・`scripts`・`hack`・`tests`・`config`）を明記する。
2. The 基準の文書 shall 除外（生成物 `src/client/**`、`*.d.ts`、テストの fixture、文字列リテラル、シェルスクリプト）を明記する。
3. The 基準の文書 shall 残すもの（非自明な理由、公開 API の使い方のうちシグネチャから分からないこと、外部仕様への参照）と、書かないもの（経緯、spec・要件・受入基準への参照、cc-sdd・kiro への言及、日付入りの決定、コードの言い換え、担当者や期限のない TODO）を列挙する。
4. The 基準の文書 shall 良い例と悪い例を 1 件ずつ示す。
5. The 基準の文書 shall API スキーマの説明文（`summary`・`description`）が生成物に出ることと、その書式（1 行・現在形・制約は zod で書く）を定める。
6. The 基準の文書 shall 日付を、バッククォートで囲んだ入力例の中だけに許すと定める。

### 2. 先頭ヘッダの規則

**目的:** 読む人として、モジュールが何のためにあるかを先頭で分かるようにしたい。ファイルを開いたときに、責務と前提がすぐ読めるようにするため。

#### 受入基準

1. When 検査が対象のファイルを読んだとき, if 先頭（シェバン行と Astro のフロントマターの後を含む）に内容のあるブロックコメントが無い, then the 検査 shall `header-missing` の違反として報告する。
2. If 先頭のブロックコメントが import の後にある、または先頭が `//` の行コメントだけである, then the 検査 shall `header-missing` の違反として報告する。
3. If 先頭ヘッダの内容が 6 行を超える, then the 検査 shall `header-too-long` の違反として報告する。
4. If 先頭ヘッダの箇条書き（`- ` で始まる行）が 3 件を超える, then the 検査 shall `header-too-many-bullets` の違反として報告する。
5. Where ファイルがシェバン行または Astro のフロントマターで始まる, the 検査 shall それらを飛ばした次のブロックコメントを先頭ヘッダとして扱う。
6. The 検査 shall 目的を 1〜2 行で書くことの確認を機械で行わない（行数の下限と目的の書き方はレビューで判断する）。

### 3. 禁止パターン

**目的:** 開発者として、作業の経緯や旧 spec への参照がコードに残らないようにしたい。コードを読む人が、もう無い文書に迷わないようにするため。

#### 受入基準

1. When コメントの行（行頭が `//`・`/*`・`*`・`{/*`・`<!--` の行）に `specs/` を含むとき, the 検査 shall `forbidden:spec参照` の違反として報告する。
2. When コメントの行に「要件」（空白は任意）と「数字.数字」が並ぶとき, the 検査 shall `forbidden:要件番号` の違反として報告する。
3. When コメントの行に `AC`・`FR`・`NFR`（ハイフンは任意）と数字が並ぶとき, the 検査 shall `forbidden:AC/FR/NFRタグ` の違反として報告する。
4. When コメントの行に `cc-sdd` を含む（大文字と小文字を区別しない）とき, the 検査 shall `forbidden:cc-sdd` の違反として報告する。
5. When コメントの行に `kiro` で始まる語を含む（大文字と小文字を区別しない）とき, the 検査 shall `forbidden:kiro` の違反として報告する。
6. When コメントの行に `20YY-MM-DD` の形の日付を含み、その日付がバッククォートで囲まれていないとき, the 検査 shall `date` の違反として報告する。
7. The 検査 shall 同じファイルで同じ規則に当たる違反を、最初の 1 件（行番号と内容）にまとめて報告する。
8. The 検査 shall API スキーマ（`src/lib/api/schema/`）の `summary:`・`description:` の文字列の行にも、禁止パターンを当てる。
9. The 検査 shall コメントでないコードの行（文字列リテラルを含む）を、禁止パターンの対象にしない。
10. The 検査 shall 「旧」「以前」「移行」「経緯」の語を違反にしない（正当な用法があるため、レビューで判断する）。

### 4. 検査の対象と除外

**目的:** 開発者として、検査の範囲が基準の範囲と一致していてほしい。範囲の外のファイルで検査が失敗しないようにするため。

#### 受入基準

1. The 検査 shall `src`・`scripts`・`hack`・`tests`・`config` の直下を再帰的に調べ、拡張子が `.ts`・`.tsx`・`.astro`・`.mjs` のファイルを対象にする（テストファイルも同じ規則に従う）。
2. The 検査 shall 次を対象から除く: `src/client/`・`src/images/`・`tests/fixtures/` 配下、`*.d.ts`、ドット（`.`）で始まるディレクトリ、`node_modules`。
3. The 検査 shall 対象のファイルを、リポジトリのルートからの相対パス（`/` 区切り）で並べて扱う。

### 5. 既存の違反と許容リスト

**目的:** 開発者として、既存の違反を一覧で把握し、直した分だけ減らしたい。新しい違反を増やさず、既存の違反を所有 spec ごとに解消できるようにするため。

#### 受入基準

1. The 許容リスト shall 各項目に `path`・`rule`・`owner`・`reason` を持つ。
2. When リポジトリ全体の違反のうち、許容リストに無いものがあるとき, the テスト shall 失敗する（新しい違反を増やさない）。
3. When 許容リストの項目が、もう違反していないとき, the テスト shall 失敗する（解消した項目を残さない）。
4. If 許容リストの項目の `owner` が `comments-api-schema`・`comments-lib`・`comments-components-pages`・`comments-tests`・`comments-scripts-config` のいずれでもない、または `reason` が空である, then the テスト shall 失敗する。
5. The 許容リスト shall 違反の所有 spec を、パスから決まる規則（`src/lib/api/schema/` → comments-api-schema、`src/lib/` → comments-lib、`src/` → comments-components-pages、`tests/` と `config/test/` → comments-tests、それ以外 → comments-scripts-config）で割り当てる。
6. The 基準の文書 shall 許容リストを機械的に作り直す（`--emit-allowlist`）のは、検査の規則を追加したときだけに限ると定める（通常の修正では使わない。作り直すと新しい違反も黙って許容されるため）。
7. The 検査 shall 許容リストの項目を、ファイルのパスと規則の組で照合する。

### 6. テストの配置と実行

**目的:** 開発者として、基準の検査が既存のテストと同じ手順で動いてほしい。特別な手順を覚えなくても、通常のテストで失敗が分かるようにするため。

#### 受入基準

1. The 検査のテスト shall `tests/unit/scripts/commentRules.test.ts` に置き、`npm run test:unit` で実行される。
2. The 検査のテスト shall 固定の本文で、先頭ヘッダ・禁止パターン・日付の規則の正例と負例を確かめる。
3. The 検査の判定 shall ファイルのパスと本文だけを使い、外部の状態（時刻・ネットワーク・ビルドの成果物）に依存しない。
4. When `npm run test:unit` が実行されたとき, the 検査のテスト shall 既存の unit テストと同じ条件（通常の実行）で通過する。

### 7. 振る舞いの不変

**目的:** 利用者として、コメントの基準を整えても、アプリの動きが変わらないでほしい。基準の作業が本体の振る舞いを壊していないと分かるようにするため。

#### 受入基準

1. The この作業（基準・検査・テスト・許容リスト） shall アプリケーションの実行時の振る舞い・API の形・文字列リテラルを変えない。
2. The 基準の文書の内容 shall この spec の作業では変えない（内容の変更は、基準を改訂する別の作業で行う）。

### 8. 参照の一元化

**目的:** 開発者として、規約の参照先が一つに決まっていてほしい。同じ規則を複数の文書に書いて食い違うことを防ぐため。

#### 受入基準

1. The `tech.md` shall 「Code Quality」の節から `comments.md` への参照を 1 箇所だけ持ち、基準の内容を重複させない。
2. The 基準の文書 shall 規約の全体（構造・命名・import）を `tech.md`・`structure.md` に任せ、コメントの判断だけを持つ。
