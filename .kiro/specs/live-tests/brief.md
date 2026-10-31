# Brief: live-tests

## Problem

実 Bluesky（本物の PDS・AppView・PLC）との契約（認証・プロフィールの取得など）を、実アカウントで確かめる手段が無い。旧テストは test-foundation で破棄され、認証情報の置き場所（`.env.e2e`・Secret `E2E_ENV`）だけが残って、どのコードも使っていない。

## Current State

- `.env.e2e.template`: 実アカウントの変数を書く雛形。どのコードも読まない。`.gitignore` に `.env.e2e` の行がある。
- `.github/workflows/e2e.yaml`・`e2e:live:sweep`（対象ファイルが無く壊れていた。削除済み）: live の残骸。
- `.kiro/steering/testing.md`: live 層は「別 spec で定める。CI では実行しない」。
- 利用者の決定（2026-10-31）: live テストは各開発者がローカルでオプショナルに実行できる扱いにする。`.env` 系統は test-foundation の方式（非秘密は設定ファイル、秘密は `.dev.vars`）に統合し、適切な値に分配する。

## Desired Outcome

- `npm run test:live` を、開発者がローカルで任意に実行できる。
- 設定が無いときは全てスキップされ、失敗しない（終了コード 0）。
- 非秘密の値は `config/live.json`、パスワードは `.dev.vars` に置き、`.env` 系は使わない。
- CI・pre-push・`test:all` には含まれない。

## Approach

live 層を vitest の専用の設定（`vitest.live.config.ts`・`tests/live/`）として分離する。設定の読み取りは `scripts/lib/liveConfig.mjs` の純粋な関数に置き、単体テストで確かめる。実アカウントの呼び出しは読み取り専用（セッションの作成とプロフィールの取得）に限り、投稿は作らない。

## Scope

- **In**: 実 PDS でのセッション作成（正しい・誤ったパスワード）、ハンドルとプロフィールの取得、設定の読み取り、`npm run test:live`、ドキュメント（DEVELOP.md・steering の live 層の行）、`.env.e2e` の廃止。
- **Out**: 投稿・予約・動画などの書き込みを伴う検証（必要になったら別 spec）、第三者アカウントの検証、CI での実行、E2E（偽の Bluesky）の範囲。

## Boundary Candidates

- 設定の読み取り（`scripts/lib/liveConfig.mjs`）
- live テストの本体（`tests/live/`・`vitest.live.config.ts`）
- 認証情報の分配（`config/live.example.json`・`.dev.vars.template`）

## Out of Boundary

- test-foundation の五層の定義（そちらの決定に従う）、E2E の起動（run-e2e）、本番の Worker の設定

## Upstream / Downstream

- **Upstream**: test-foundation（層の定義、`.dev.vars` と `config/` の分配の方針）、ops-config-secrets（`parseDotenv`・`parseJsonc` の共通の解析）
- **Downstream**: develop-docs（手順の章）

## Existing Spec Touchpoints

- **Extends**: test-foundation（live 層の仕様をここで定める。test-foundation の要件 1.1 が「別 spec」と定めた項目）
- **Adjacent**: ops-config-secrets（共通の解析を使う）、develop-docs（章の書き換え）

## Constraints

- 秘密（パスワード）は標準出力・ログ・テストの失敗メッセージに出さない。
- 実アカウントの認証情報は利用者が用意する（この環境には無いため、実通信の確認は行えない）。
- CI の必須ゲートに入れない（`.kiro/steering/testing.md` の CI の方針）。
