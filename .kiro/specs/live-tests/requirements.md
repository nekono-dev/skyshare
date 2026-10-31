# Requirements Document

## Introduction

実 Bluesky（PDS）との契約を、開発者がローカルで任意に確かめられる live テストを整備する。非秘密の設定は `config/live.json`、パスワードは `.dev.vars` に置く。設定が無いときは全てスキップする。CI・pre-push・`test:all` には含めない。

## Boundary Context (Optional)

- **In scope**: 設定の読み取り、読み取り専用の live テスト、`npm run test:live`、`.env.e2e` の廃止、ドキュメントの live の行。
- **Out of scope**: 書き込みを伴う検証、第三者アカウント、CI での実行。
- **Adjacent expectations**: test-foundation の五層の定義、ops-config-secrets の共通の解析。

## Requirements

### Requirement 1: 任意の実行

**Objective:** As a 開発者, I want live テストをローカルで自分の判断で実行する, so that CI や push を実アカウントに依存させずに済む

#### Acceptance Criteria

1. When `npm run test:live` が実行されたとき, the live テスト shall `tests/live/` の テストだけを実行する
2. The `test:all`・`.githooks/pre-push`・`.github/workflows/` shall live テストを実行しない
3. The `package.json` shall `test:live` を持ち、`test:all` の定義に含めない

### Requirement 2: 設定の分配

**Objective:** As a 開発者, I want 設定の値を正しい場所に置く, so that 非秘密と秘密が混ざらず、`.env` を使わずに済む

#### Acceptance Criteria

1. The live テストの設定 shall 非秘密の値（ハンドル・PDS の URL）を `config/live.json` から読む
2. The live テストの設定 shall パスワードを `.dev.vars` の `SKYSHARE_E2E_APP_PASSWORD` から読む
3. The リポジトリ shall `config/live.example.json` と `.dev.vars.template` の雛形を追跡し、実際の `config/live.json` は Git 管理外とする
4. The リポジトリ shall `.env.e2e`・`.env.e2e.template` と、それを参照する記述（`E2E_ENV` を含む）を持たない

### Requirement 3: 任意の設定での読み取り

**Objective:** As a 開発者, I want 設定が足りないときに失敗せず理由が分かる, so that 設定していない人の `npm test` の結果を乱さない

#### Acceptance Criteria

1. If `config/live.json` が無い、またはパスワードが空のとき, then the live テスト shall 全てをスキップし、スキップの理由を 1 行で示す
2. If 設定の形式が不正なとき（JSON として読めない、ハンドルが無い）, then the 設定の読み取り shall 不足の項目名を示して失敗する（値は示さない）
3. The 設定の読み取り shall 秘密の値を例外メッセージ・標準出力に含めない

### Requirement 4: 読み取り専用の契約の確認

**Objective:** As a 開発者, I want 実 PDS との認証とプロフィールの契約を確かめる, so that Bluesky 側の仕様変更や設定の誤りを早く見つけられる

#### Acceptance Criteria

1. When 正しいハンドルとパスワードで `com.atproto.server.createSession` を呼んだとき, the live テスト shall 応答の DID とハンドルが設定と一致することを確かめる
2. When 誤ったパスワードで呼んだとき, the live テスト shall 認証の失敗（HTTP 401）と、エラーコード `AuthenticationRequired` を確かめる
3. When `com.atproto.identity.resolveHandle`・`app.bsky.actor.getProfile` を呼んだとき, the live テスト shall 応答のハンドルが設定と一致することを確かめる
4. The live テスト shall 投稿・削除などの書き込みを行わない

### Requirement 5: 既存のテストとの分離

**Objective:** As a 開発者, I want live の設定が unit・E2E の実行に影響しない, so that 既存の検証の結果が変わらない

#### Acceptance Criteria

1. The unit・component・route・render・E2E の設定 shall `tests/live/` を含まない
2. The `vitest.live.config.ts` shall `tests/live/**/*.test.ts` だけを対象にする
