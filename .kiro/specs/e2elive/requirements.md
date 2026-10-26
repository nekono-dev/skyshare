# Requirements Document

## Introduction

実際のBlueskyアカウントでしか確認できない動作を、検証用アカウントの認証情報を与えたときだけ動くE2Eテストとして自動で検証し、作った投稿とentryをテストの後に残さないようにする。

## Boundary Context

- **In scope**:
  - 検証用アカウントの認証情報の指定と、テスト開始前のログイン。
  - 検証用アカウントのPDSへの直接の投稿・entryの作成と削除。
  - テストが作った投稿とentryの後始末。
  - スレッド投稿・複数画像・動画・事後entry作成・削除フローの実アカウントでの検証。
- **Out of scope**:
  - アプリ本体への自動ログインの追加。
  - 実機・他ブラウザ・見た目の目視の確認。
  - Blueskyの検索基盤が投稿を欠落させる状況の再現。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 認証情報の指定と実行対象

**Objective:** As a 開発者, I want 認証情報を与えたときだけライブテストが動いてほしい, so that 認証情報が無い環境や CI を壊さない

#### Acceptance Criteria

1. When 検証用アカウントの認証情報が環境変数または設定ファイルで指定されたとき、the ライブテスト shall ハンドル・パスワード・PDS の URL を読み込み、PDS の URL の既定を公式の値にする
2. If 必須の環境変数が1つでも空のとき, then the ライブテスト shall 認証情報の読み込みで空を返し、ライブテストを実行対象にしない
3. While 認証情報が無いとき、the ライブテスト shall テストのプロジェクトを0件にする（テストの一覧にライブテストが含まれない）

### Requirement 2: ログインと状態の共有

**Objective:** As a 開発者, I want ログインを1回だけ行って全テストで共有したい, so that ログインの頻度制限に触れずに速く実行できる

#### Acceptance Criteria

1. When ライブテストが開始されるとき、the ライブテスト shall ログインを1回だけ行い、保存したログイン状態を全てのライブテストで共有する
2. When ログイン画面のフォームに認証情報が入力されて送信されたとき、the ライブテスト shall トップページへ遷移しセッションが確立されることを独立したテストで検証する

### Requirement 3: PDS の直接操作と削除対象の選別

**Objective:** As a 開発者, I want 検証用アカウントの PDS へ直接投稿・削除したい, so that 画面を経由せずにテストの前提を作れる

#### Acceptance Criteria

1. When 本文が識別子で始まる投稿が直接作成されるとき、the ライブテスト shall その投稿と entry を検証用アカウントの PDS へ作成できる
2. If 本文が識別子で始まらないとき, then the ライブテスト shall 作成・削除の対象として判定しない
3. The ライブテスト shall 直接の削除を、識別子で始まる投稿とそれを参照する entry だけに限り、条件が常に真でも識別子の無い投稿を選ばない
4. If 削除対象の件数が上限を超えたとき, then the ライブテスト shall 何も削除せずに例外とする
5. The ライブテスト shall 削除せず対象だけを示す確認手段を持つ
6. While 作成から1時間未満の識別子付きの投稿があるとき、the ライブテスト shall 掃除でそれらを削除せず残す

### Requirement 4: 後始末

**Objective:** As a 開発者, I want テストが作った投稿と entry を残したくない, so that 検証用アカウントが汚れない

#### Acceptance Criteria

1. When テストが成功または失敗で終了したとき、the ライブテスト shall 自分が作った投稿と entry を終了時に削除する
2. When ライブテストが開始されたとき、the ライブテスト shall 作成から1時間以上経った識別子付きの投稿と entry を回収する
3. The ライブテスト shall 同じ回収の処理を手動の掃除コマンドからも実行できるようにする
4. When 識別子付きの投稿を作って終了時の削除を実行したとき、the ライブテスト shall 同じ識別子の投稿を検証用アカウントに残さない

### Requirement 5: 投稿から削除までの検証

**Objective:** As a 開発者, I want スレッド・複数画像・動画を実アカウントで検証したい, so that 実際の Bluesky での保存内容を確認できる

#### Acceptance Criteria

1. When 画像付きの3件のスレッドを投稿したとき、the ライブテスト shall entry が1件だけ作られ、Bluesky で3件の自己返信になり、削除の確定で3件とも消えることを確認する
2. When 色の違う5枚の画像を投稿したとき、the ライブテスト shall 投稿が gallery として保存され、公開ビューが5枚を返し、visual が先頭4枚の色だけで構成されることを確認する
3. When mp4・mov・webm の動画を投稿したとき、the ライブテスト shall 動画の埋め込みと縦横比が保存され、entry の詳細ページで動画プレイヤーが表示されることを確認する

### Requirement 6: 事後の entry 作成と削除フロー

**Objective:** As a 開発者, I want 既存の投稿への entry 作成と削除フローを実アカウントで検証したい, so that 既存データでも動作することを確認できる

#### Acceptance Criteria

1. When entry の無い画像付きの投稿と動画の投稿に事後で entry を作成したとき、the ライブテスト shall 作成元の画像が visual に使われ、source が投稿を指し、作成後に作成ボタンが消えることを確認する
2. When ルートに画像が無いスレッドに事後で entry を作成したとき、the ライブテスト shall 後続の投稿の画像の色が visual の半分以上を占めることを確認する
3. When entry の削除フローを操作したとき、the ライブテスト shall 単発とスレッドの両方で、削除対象の一覧の最終確認・キャンセル・再表示・確定を確認し、キャンセルでは投稿が削除されず、確定では投稿が Bluesky から消えることを確認する
4. When 旧実装の entry の削除フローを操作したとき、the ライブテスト shall 投稿ごとの削除が選べず理由が出ること、分岐したスレッドの削除では採用された系統だけが削除されることを確認する
5. Where 第三者アカウントが指定されている場合, the ライブテスト shall 第三者の返信がルートの削除後も Bluesky に残ることを確認する

### Requirement 7: アプリ本体への非混入

**Objective:** As a 運用者, I want 検証用の認証情報がアプリ本体と Git に混入しないようにしたい, so that 認証情報が漏れない

#### Acceptance Criteria

1. The アプリ本体 shall 検証用アカウントの環境変数を参照する箇所を0件にし、ソースに環境変数名を含めない
2. The リポジトリ shall 認証情報の設定ファイルとログイン状態の保存先を Git の無視対象にし、Git の管理対象になるファイルを0件にする
