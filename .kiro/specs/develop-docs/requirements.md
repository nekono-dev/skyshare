# Requirements Document

## Introduction

`DEVELOP.md` を、開発者と運用者が行う手順だけを載せた文書に作り直す。設計の理由と責務は steering と spec に参照で移す。手順のコマンドと Secret の名前は、確定した構成（ops-agent-setup・ops-config-secrets・ops-tooling-layout）と現在の設定ファイルに合わせる。

## Boundary Context (Optional)

- **In scope**: `DEVELOP.md` の章立てと本文、食い違いの修正、`README.md`・`README-jp.md` の開発者向けの導線（必要な場合のみ）。
- **Out of scope**: 利用者向けの文書、steering と spec の内容、スクリプトの中身。
- **Adjacent expectations**: `ops-tooling-layout` の新しいパス、`ops-config-secrets` の入口、`ops-agent-setup` の導入の手順。

## Requirements

### Requirement 1: 手順だけの構成

**Objective:** As a 開発者, I want 文書を上から順に読むと作業ができる, so that 初めての準備から日常の開発まで迷わない

#### Acceptance Criteria

1. The `DEVELOP.md` shall 章を次の順に並べる: 準備 → 日常の開発（起動・テスト・型検査）→ 設定と生成物 → 品質（E2E・i18n）→ 運用（リリース・CI/CD・プレビュー・初期設定）
2. The 各手順 shall 実行するコマンドと、完了を確かめる方法を書く
3. The `DEVELOP.md` shall 設計の議論（なぜそうしたか）を載せず、該当する steering または spec のパスを参照する
4. The `DEVELOP.md` shall 同じ内容を 2 箇所に書かない（重複する章は 1 つにまとめ、他からは参照する）

### Requirement 2: 食い違いの解消

**Objective:** As a 運用者, I want 文書の記述が実際の設定と一致する, so that 記述どおりに行っても失敗しない

#### Acceptance Criteria

1. The `DEVELOP.md` shall E2E の Secret の記述を、`.env.e2e.template` と `e2e.yaml` の実際の使い方に合わせる（`E2E_ENV` を前提にしない。存在しない Secret を求めない）
2. The `DEVELOP.md` shall `.claude/branch-release-workflow.json` の記述を、実際の配置（正本と参照の関係）に合わせる
3. The `DEVELOP.md` shall 参照するスクリプト名（`package.json` の scripts）と `scripts/` のパスを、存在するものだけにする
4. The `DEVELOP.md` shall `release/*` と `develop` の記述を、`.claude/branch-release-workflow.json` の `protectedBranches` と `baseBranch` の値に合わせる

### Requirement 3: 運用者の導線

**Objective:** As a 運用者, I want 初期設定とリリースの手順を一箇所で追える, so that 初回の設定の漏れを防げる

#### Acceptance Criteria

1. The `DEVELOP.md` shall 初回の設定（GitHub の Variables・Secrets、予約の鍵、不具合報告の設定）を、順序を付けた 1 つの章にまとめる
2. The `DEVELOP.md` shall 秘密の値を書かず、変数名と登録の手順（`npm run sync:github` など）だけを書く
3. The `DEVELOP.md` shall pre-push で GitHub の Variables を登録する挙動を、現在の動作どおりに書く（見直しは未決定である旨を含む）

### Requirement 4: 文書の正本

**Objective:** As a 開発者, I want 文書の正本が分かる, so that 古い記述を見つけたら直し先が分かる

#### Acceptance Criteria

1. The `DEVELOP.md` shall 冒頭に、この文書の役割（手順）と、設計・規約の正本（steering・spec）の場所を書く
2. The `DEVELOP.md` shall 章ごとの内容の正本（コードの場所）をリンクで示す

### Requirement 5: デプロイ前の準備（手動の登録）

**Objective:** As a 運用者, I want デプロイの前に行う登録を手順で確実に行える, so that GitHub の Variables が config と食い違ったまま配備されない

#### Acceptance Criteria

1. The `DEVELOP.md` shall 配備（`release/**`・`develop` への push と手動実行）の前に、運用者が `npm run sync:github` を実行する手順を、配備の章の先頭に書く
2. The `DEVELOP.md` shall push では GitHub の登録が行われないこと（pre-push はテストだけ）を書き、登録は手動であることを明記する
3. The `DEVELOP.md` shall `npm run sync:github -- --dry-run` で登録される名前を事前に確かめる手順と、`gh variable list` での確認を書く

### Requirement 6: 実アカウントのテストの扱い

**Objective:** As a 開発者, I want 実アカウントのテストが任意で、どう設定するかが分かる, so that CI を汚さずにローカルで確かめられる

#### Acceptance Criteria

1. The `DEVELOP.md` shall 実アカウントのテスト（`npm run test:live`）を開発者がローカルで任意に実行するものとして書き、CI では実行しないと明記する
2. The `DEVELOP.md` shall 設定の場所（非秘密は `config/live.json`、パスワードは `.dev.vars`）を書き、`.env` 系のファイルを使わないことを書く
3. The `DEVELOP.md` shall 旧 `.env.e2e`・`E2E_ENV` の記述を含まない
