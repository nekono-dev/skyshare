# Implementation Plan

- [x] 1. 食い違いの確認
- [x] 1.1 現状の記述と設定の対応を一覧にする
  - `DEVELOP.md` の全章について、参照するコマンド・パス・Secret 名を書き出し、`package.json`・`scripts/`・`.github/workflows/`・`.env.e2e.template` と照合する
  - 完了の確かめ方: 一覧の全項目に「一致」か「修正」かの判定が付くこと
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. 文書を作り直す
- [x] 2.1 冒頭（役割と正本）と章の並びを書く
  - 役割（手順の文書）と、設計・規約の正本（steering・spec）のパスを冒頭に書く
  - 章を「準備 → 日常の開発 → 設定と生成物 → 品質 → 運用」の順にする
  - _Requirements: 1.1, 4.1_

- [x] 2.2 各章を手順の形にする
  - 各手順に、実行するコマンドと完了の確かめ方を書く。設計の理由は書かず、正本のパスを参照する
  - 同じ内容は 1 章にまとめ、他の章からは参照する
  - _Requirements: 1.2, 1.3, 1.4, 4.2_

- [x] 2.3 食い違いを直す
  - E2E の Secret を `SKYSHARE_E2E_*` の実際の使い方に合わせる（存在しない `E2E_ENV` を求めない）
  - BRW の正本（ルートの `.branch-release-workflow.json`）と `.claude/` の旧パスの関係を、配置に合わせて書く
  - `release/*` と `develop` の記述を `protectedBranches`・`baseBranch` に合わせる
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2.4 初回の設定の章を 1 つにまとめる
  - GitHub の Variables・Secrets、予約の鍵、不具合報告の設定を、順序を付けた 1 章にする。秘密の値は書かない
  - pre-push で GitHub の Variables を登録する現在の動作を書く（見直しは未決定である旨を含む）
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 検査
- [x] 3.1 参照の検査
  - `DEVELOP.md` の `npm run <name>` が `package.json` に存在すること、パスが実在することを確かめる
  - `E2E_ENV`・`build:pripare`・`scripts/` の旧パスが 0 件であることを確かめる
  - _Requirements: 2.3_

- [x] 3.2 書式の検査
  - `npx prettier --check DEVELOP.md` が通ることを確かめる
  - _Requirements: 1.1_

## 改訂タスク（2026-10-31: デプロイ前の登録・実アカウントのテスト・BRW）

- [x] 4. 改訂の反映
- [x] 4.1 配備の章の先頭に、デプロイ前の登録の手順を書く
  - `npm run sync:github -- --dry-run` → `npm run sync:github` → `gh variable list -R <owner>/<repo>` の順
  - pre-push では登録されないことを書く（6.9 の見直しは決着したものとして書き換える）
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4.2 実アカウントのテストの章を書き換える
  - 任意のローカル実行（`npm run test:live`）、CI では実行しないこと、設定の場所（`config/live.json`・`.dev.vars`）を書く。`.env.e2e` と `E2E_ENV` の記述を消す
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 4.3 BRW の章と準備の章を書き換える
  - `npm run setup:brw` を唯一の導入の入口として書く。`.claude/branch-release-workflow.json` の旧パスの扱いは変えない
  - 同名 marketplace（`nekono-dev`）の確認手順を書く
  - _Requirements: 5.1_
