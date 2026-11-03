# Implementation Plan

- [ ] 1. 着手前の基準を記録する
- [x] 1.1 移動の前の基準（テスト件数と HTML 出力）を退避する
  - 着手前に `npm run test:all` を実行し、終了コードと件数を完了メモに記録する
  - 着手前に `npm run build` を実行し、全ページの HTML 出力をリポジトリの外の退避先へ保存する
  - 完了の状態: 件数と HTML 出力の退避先が記録され、以降の比較の基準として参照できる
  - _Requirements: 2.1, 4.2_

- [ ] 2. 骨格を移動し、参照を更新する
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

- [ ] 3. 文書を移動後の配置に合わせる
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

- [ ] 4. 出力と既存の検証を確かめる
- [ ] 4.1 移動の前後で HTML 出力が一致することを確かめる
  - 移動の後に `npm run build` を実行し、全ページの HTML を 1.1 で退避した出力と比較する
  - 差分が 0 件であり、骨格を使う全画面の構成（ヘッダー・サイドバー・フッター・`<head>` のメタ情報）が移動の前と同じである
  - _Depends: 2.2, 3.1, 3.2_
  - _Requirements: 2.1, 2.2_

- [ ] 4.2 既存の検査とテストを通す
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
  - 骨格を使う 13 画面（`src/pages/` で `@/layout/` を import するページ）の出力を含む。動的ルート（`entries/[slug]`・`posts/[dbIndex]/[slug]`）は事前生成されず、HTML の退避に含まれない
- ビルドの前提: `npm run build` は `wrangler.jsonc` の本番設定（`siteHost`）を必要とするため、退避の時のみ `node scripts/config/render-wrangler.mjs production` で生成し、ビルド後に開発用の `wrangler.jsonc` を元に戻した
