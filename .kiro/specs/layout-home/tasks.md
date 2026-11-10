# Implementation Plan

- [x] 1. 着手前の基準を記録する
- [x] 1.1 移動の前の基準（テスト件数と HTML 出力）を退避する
  - 着手前に `npm run test:all` を実行し、終了コードと件数を完了メモに記録する
  - 着手前に `npm run build` を実行し、全ページの HTML 出力をリポジトリの外の退避先へ保存する
  - 完了の状態: 件数と HTML 出力の退避先が記録され、以降の比較の基準として参照できる
  - _Requirements: 2.1, 4.2_

- [x] 2. 骨格を移動し、参照を更新する
- [x] 2.1 骨格を `components/layout/` の部品フォルダへ移動する
  - 骨格を `git mv` で `src/components/layout/Baselayout/index.astro` へ移動し、履歴を残す
  - 移動の後、骨格の中身（表示・props・スクリプト・import）を変えていないことを差分で確かめる
  - 移動の後、`src/layout/` が存在しない状態になっている
  - 完了の状態: 骨格のファイルは `components/layout/` 配下だけにあり、`src/layout/` は残っていない
  - _Boundary: Baselayout_
  - _Requirements: 1.1, 1.2, 1.3, 2.3_

- [x] 2.2 骨格を読み込む画面の import を新しい置き場へ更新する
  - `src/pages/` の 13 ファイルの import を、旧パスから `@/components/layout/Baselayout/index.astro` へ変更する
  - `src/pages/posts/[dbIndex]/[slug].astro` は lib-layers 3.4 も import を変える。同じファイルを lib-layers 3.4 が先に変えてから、本タスクが骨格の import を変える
  - `src/` 配下に旧パス（`@/layout/`）の参照が残っていない状態になっている
  - 完了の状態: 全画面が新しい置き場の骨格を import し、旧パスの参照が 0 件である
  - _Depends: 2.1, lib-layers 3.4_
  - _Requirements: 1.4, 1.5_

- [x] 3. 文書を移動後の配置に合わせる
- [x] 3.1 (P) 部品の README の骨格の参照先を更新する
  - `components/layout/README.md` の骨格の参照先を `components/layout/` 配下の新しい置き場として示す
  - README に旧パス（`src/layout/`）が現行の配置として残っていない状態になっている
  - _Boundary: Layout README_
  - _Requirements: 3.3, 3.4_

- [x] 3.2 steering の骨格の記述を移動後の配置に合わせる
  - `structure.md` の骨格（`layout`）の記述に、置き場が `components/layout/Baselayout/` であることを示す。書く位置は「部品（`src/components/<領域>/<Name>/`）」の節の「画面全体で共有する部品は `common`（UI 部品）、`layout`（骨格）」の文の直後の一文に限る（骨格の一文はこの一箇所だけに書き、他の節に重複して書かない。structure-checks 5.1 はこの一文を参照する）
  - `structure.md` の編集は lib-layers 5.3 の完了の後に行う（lib-layers が同じ文書の節を改訂するため）
  - `roadmap.md` の「探査の根拠」の骨格の行を、`src/layout/` を現行の配置として示さない記述に直す。作業ツリーに未コミットの変更があるため、その変更は保ち、骨格の行だけを変える
  - Phase 5 の見出しと Phase 1 の項目は変えない。完了の状態: 両 steering の骨格の記述に旧パスが現行の配置として残っていない
  - _Boundary: Steering docs_
  - _Depends: lib-layers 5.3_
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 4. 出力と既存の検証を確かめる
- [x] 4.1 移動の前後で HTML 出力が一致することを確かめる
  - 移動の後に `npm run build` を実行し、全ページの HTML を 1.1 で退避した出力と比較する
  - 差分が 0 件であり、骨格を使う全画面の構成（ヘッダー・サイドバー・フッター・`<head>` のメタ情報）が移動の前と同じである
  - _Depends: 2.2, 3.1, 3.2_
  - _Requirements: 2.1, 2.2_

- [x] 4.2 既存の検査とテストを通す
  - `components/` の部品規約の検査（`componentLayout`）と `npm run test:imports` が通る
  - `npm run test:all` が終了コード 0 で終わり、件数が 1.1 で記録した件数を下回らない
  - 旧パスを import するテストは存在せず、更新は不要であることを確かめる（テストの意味は変えない）
  - 完了の状態: 検査とテストの結果が、着手前の件数以上で全て成功している
  - _Depends: 4.1_
  - _Requirements: 1.5, 4.1, 4.2, 4.3_

## Implementation Notes

### 1.1 移動の前の基準（テスト件数と HTML 出力）

- `npm run test:all`: 終了コード 0（type / lexicon / imports 通過）
  - unit: 49 ファイル / 321 件 通過
  - component: 5 ファイル / 13 件 通過
  - route: 23 ファイル / 212 件 通過
  - render: 1 ファイル / 2 件 通過
  - e2e: 7 件 通過
- `npm run build`: 終了コード 0。退避先はリポジトリの外（scratchpad）
  - 退避した HTML: `/tmp/claude-1000/-home-ubuntu-git-nekono-dev-skyshare/e7038a86-ccb3-40cb-8404-a56f88235534/scratchpad/html-before/` の 24 ファイル（`dist/client` の `*.html` をそのまま複製）
  - 各ファイルの SHA-256 は同じ scratchpad の `html-before.sha256` に記録
  - `src/pages/` で骨格（`components/layout/Baselayout`）を import するページは 13 件（`grep -rl` で確認）。そのうち事前生成される（`prerender = true`）のは 11 画面（accounts・entries/index・entries/sample・feedback・help・index・jump・login・post・privacy・settings）で、その HTML を退避に含む。退避の 24 件のうち 11 件がこの 11 画面の HTML で、残りの 13 件（`legacy/`・`app/`・`~partytown/` の HTML）は骨格を使わない。動的ルート（`entries/[slug]`・`posts/[dbIndex]/[slug]`、`prerender = false` の SSR）は事前生成されず、HTML の退避に含まれない
- ビルドの前提: `npm run build` は `wrangler.jsonc` の本番設定（`siteHost`）を必要とするため、退避の時のみ `node scripts/config/render-wrangler.mjs production` で生成し、ビルド後に開発用の `wrangler.jsonc` を元に戻した

### 4.1 移動の前後で HTML 出力が一致することを確かめる

- 比較の手順: 移動の後に `node scripts/config/render-wrangler.mjs production` → `npm run build`（終了コード 0）→ 開発用の `wrangler.jsonc` を退避コピーから戻し、`cmp` でバイト一致を確認した。比較対象は 1.1 の退避 24 件（`dist/client` の `*.html`）。ファイル一覧は 24 件で一致
- 生の比較（バイト単位）: 24 件中 13 件が一致、11 件が差分あり（`accounts`・`index`・`entries/index`・`entries/sample`・`feedback`・`help`・`jump`・`login`・`post`・`privacy`・`settings`）
- 差分の内容は、すべて `/_astro/` 配下の資産名（ハッシュ付きファイル名）だけである。資産名を正規化（`/_astro/*.js|css` と骨格のスクリプト名の置換）して比べると、24 件すべてが一致した。差分の種類は次の 2 つ
  - (a) 骨格のスクリプトの資産名（差分のある 11 件すべて）: `Baselayout.astro_astro_type_script_index_0_lang.BuHSHFEw.js` → `index.astro_astro_type_script_index_0_lang.BuHSHFEw.js`。骨格のファイル名（`index.astro`）から決まる名前であり、移動に伴う変化。ハッシュ（`BuHSHFEw`）は同じで内容は同一。骨格の CSS（`Baselayout.DCW3V2pc.css`）は変わらない
  - (b) 部品のチャンクのハッシュ（`astro-island` の `component-url`）が変わったのは 4 件（`index`・`feedback`・`post`・`settings`）。残りの 7 件（`accounts`・`entries/index`・`entries/sample`・`help`・`jump`・`login`・`privacy`）は (a) の資産名だけが変わっている。4 件のチャンクの変化（`index` は `index.BSrryBI5.js` → `index.CJ3-cYVZ.js`、`feedback` は `index.DMnJqTuf.js` → `index.Q3RumwEU.js`、`post` は `index.CP8w13XC.js` → `index.CraOh2eG.js`、`settings` は `index.CwXleX1R.js` → `index.DzPFUJ4D.js`）の原因は下のとおりで、いずれも移動とは無関係な要因で説明できる
- (b) の原因の確認（移動の前のツリーを `git archive 56b8d10` で別ディレクトリに展開し、同じ手順で再ビルド）:
  - `index`（`Timeline`）: 移動の後のチャンクは、移動の前の再ビルドの `index.BSrryBI5.js` と、import 先の `ThreadComposer` のチャンク名の差だけで一致する（トークン単位で比較）
  - `feedback`（`FeedbackForm`）: 移動の後のチャンクは、ビルド時に埋め込まれる git の commit SHA（`05575e0…`。移動の前の展開先は `.git` を持たないため空）の差だけでバイト一致する（SHA を除いて比較）。チャンク名の差は SHA の埋め込みによる。SHA は commit に依存する値で、移動とは無関係
  - `post`: import 先の `ThreadComposer` のチャンク名の違いだけで、トークン列は一致する
  - `settings`: store モジュールの import 順の入れ替わりだけで、本体のトークン列は一致する。store と `client.DOeCimWF`・`guestMode` は互いに依存しないため、評価順の差は振る舞いに影響しない
  - `ThreadComposer`（移動の前 `CnuY84Lt.js` / 移動の後 `BT8dnh40.js`）: import 文を除くと本体は一致する。差は import 文の並び（store が `client.DOeCimWF` より先に評価される順）と、4 文字以下の識別子（ミニファイの変数名）の割り当てだけ。文字列リテラル・数値・プロパティ名の出現数は一致
  - 移動の前のツリーは、退避のビルド（リポジトリのパス）と別パスの再ビルドで `Timeline` = `BSrryBI5`・`ThreadComposer` = `CnuY84Lt` が再現した。移動の前の出力は場所に依らず安定している
- 骨格の中身: `git diff -M 56b8d10 HEAD` で骨格は rename の類似度 100%（中身の差分 0 行）。骨格を使う 13 画面の変更は import の 1 行ずつ
- 動的ルート（`entries/[slug]`・`posts/[dbIndex]/[slug]`）: 退避に含まれないため、`npm run build` の成功（終了コード 0）と構成の比較で確かめた。両ファイルの変更は import の 1 行（`@/layout/Baselayout.astro` → `@/components/layout/Baselayout/index.astro`）のみで、骨格の中身は変わらない
- 判定: HTML の内容（ヘッダー・サイドバー・フッター・`<head>` のメタ情報を含む全体）は、資産名を正規化すると移動の前後で一致する。残る差分は (a) の資産名（移動によるファイル名の変化、内容は同一）と (b) のビルド時の SHA 埋め込み・ミニファイの変数名による無関係なハッシュ差
- 既存の検証: `npm run test:all` 終了コード 0（unit 49 ファイル / 321 件、component 5 / 13、route 23 / 212、render 1 / 2、e2e 7 件。基準と一致）。`npm run test:imports` 終了コード 0。`npm run apigen` 終了コード 0（`src/client/openapi`・`docs` に差分なし）
- 退避のファイル: 移動の後の出力は scratchpad の `html-after.sha256` に記録。比較の作業用の出力は scratchpad のみで、リポジトリには追加していない

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: 要件 2.1（HTML が全ページで一致）は、資産のハッシュ付きファイル名を除いた一致として確かめられていた。利用者の決定に従い、requirements.md に追補を書いた。実装は変えていない。
