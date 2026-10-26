# Requirements Document

## Introduction

ログイン中の利用者から不具合の報告と新機能の提案を受け付け、報告者のアカウントと動作中の版と環境の情報を添えて、ソースコードのリポジトリに Issue として登録し、開発者が再現と検討に使えるようにする。

## Boundary Context

- **In scope**:
  - 報告と提案の入力の検証と、アカウントごとの送信回数の制限。
  - Issue の件名・本文・ラベルの組み立てと、GitHub への登録。
  - 動作中のビルドの版・コミット・リポジトリの埋め込み。
- **Out of scope**:
  - 報告と提案の入力画面と、環境の情報の収集。
  - スクリーンショットの添付。
  - 登録した Issue の更新と削除。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 受付の条件

**Objective:** As a 開発者, I want 受付をログイン中の利用者に限り、報告者を信頼できる形で記録したい, so that 偽の報告者や大量の送信を防げる

#### Acceptance Criteria

1. If セッションが無い送信のとき, then the フィードバック API shall 401 で拒否する
2. The フィードバック API shall 報告者の DID とハンドルをログインのセッションから取り、入力からは受け取らない（入力に別の DID を含めても本文の報告者はセッションのアカウントになる）
3. When 同じアカウントから送信されたとき、the フィードバック API shall 60秒に1件までを受け付け、超えた送信は登録せずに 429 で回数の超過を返す
4. If 登録先のリポジトリか GitHub の認証情報が未設定のとき, then the フィードバック API shall 受付を停止し 503 を返す
5. If GitHub の登録が失敗したとき, then the フィードバック API shall 失敗を返し 500 とする

### Requirement 2: 入力の検証

**Objective:** As a 開発者, I want 報告と提案の入力を種別ごとに検証したい, so that 再現や検討に必要な情報が揃う

#### Acceptance Criteria

1. The フィードバック API shall 入力を種別（不具合か新機能の提案）・件名・種別ごとの本文・環境の情報で構成し、種別に合わない本文の項目を 400 で拒否する
2. When 不具合が送信されたとき、the フィードバック API shall 操作した内容と再現の頻度（毎回・ときどき・起きない・試していない）を必須とし、4つの値以外を 400 で拒否する
3. When 新機能の提案が送信されたとき、the フィードバック API shall 機能の内容を必須とし、技術的な補足を任意とする
4. When 技術的な補足が省かれたとき、the フィードバック API shall Issue の本文から補足の見出しを除く
5. If 件名または本文の項目が空白だけのとき, then the フィードバック API shall 400 で拒否する
6. The フィードバック API shall 件名を100文字、本文の各項目を2000文字までとし、書記素で数える（結合文字を含む絵文字100個の件名は受理し、101文字は 400 で拒否する）

### Requirement 3: Issue の内容

**Objective:** As a 開発者, I want Issue に再現と検討に必要な情報が載っていてほしい, so that 追加の問い合わせなしに対応できる

#### Acceptance Criteria

1. When 不具合が登録されるとき、the フィードバック API shall Issue に bug のラベルを付け、新機能の提案には enhancement のラベルを付ける
2. The フィードバック API shall Issue の件名を、利用者の件名の改行を空白にした1行とする
3. The フィードバック API shall Issue の本文に、入力の本文・報告者のハンドルと DID・版とコミット・OS とブラウザとホーム画面からの起動か・ブラウザの識別文字列を載せる
4. The フィードバック API shall 利用者の入力を、メンション・リンク・画像・HTML として解釈されない形（閉じられないコードブロックの中）で本文に載せる
5. The フィードバック API shall 版とコミットに受け付けたサーバーのビルドの値を載せ、画面が送った値が異なるときだけ画面の値も並べて載せる

### Requirement 4: ビルドの情報

**Objective:** As a 開発者, I want 動作中のビルドの版を Issue に載せたい, so that どの版の問題か特定できる

#### Acceptance Criteria

1. The ビルド shall 版・コミット・リポジトリを埋め込む
2. When CI でビルドするとき、the ビルド shall 実行中のワークフローの値を使い、手元では Git の値を使い、どちらもないときは不明とする
