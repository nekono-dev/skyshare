# Requirements Document

## Introduction

Skyshare は OSS であり、別の運用者がフォークして同じコードを配備できるようにする。運用者ごとに変わる値（公開するドメイン・運営者情報・アクセス解析）をコードに書かず、環境変数で受け取る。Cloudflare の資源の名前はアカウントごとのため固定とし、develop 環境とプレビューのドメインも公開するドメインから決めて、受け取る値を最小にする。

## Boundary Context

- **In scope**:
  - 運営者情報とアクセス解析の測定 ID の受け取り・検査・解決。
  - サイトの URL と、Cloudflare の配備先のドメインの受け取り。
  - CI のワークフローへの値の受け渡し。
- **Out of scope**:
  - lexicon の NSID の変更。運用者が違っても Entry を相互に読めるよう固定する。
  - プライバシーポリシーの本文の書き換え。本文は実装に合わせて書き、値だけを差し込む。
  - 旧 UI の設定。
  - AI エージェント向けのブランチ運用の宣言。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 運営者情報と測定 ID の受け取り

**Objective:** As a 運用者, I want 運営者情報とアクセス解析の設定を環境変数で与えたい, so that コードを変えずに自分の運営者情報で配備できる

#### Acceptance Criteria

1. The サイト設定 shall 運営者の名称・窓口のメールアドレス・プライバシーポリシーの制定日と改定日を必須とする
2. If 本番ビルドで必須の値が欠けているか形式が違うとき, then the サイト設定 shall ビルドを止め、欠けた変数名を挙げた問題を返し、形式の違う値もそれぞれ問題として挙げる
3. When 必須の値がすべてそろっているとき、the サイト設定 shall 問題を0件にする
4. The サイト設定 shall 窓口の Bluesky ハンドルと Google アナリティクスの測定 ID を任意とし、未設定か形式が違うときは使わず、設定すればそのまま使う
5. While 開発時（開発サーバーと単体テスト）のとき、the サイト設定 shall 必須の値が未設定でもダミー値で補って動き、任意の値は使わない
6. Where 測定 ID が設定されている場合, the アクセス解析のタグ shall Google アナリティクスのタグを出力し、ID を初期化に使う
7. If 測定 ID が設定されていないとき, then the アクセス解析のタグ shall タグを出力しない

### Requirement 2: サイトの URL

**Objective:** As a 運用者, I want 公開するドメインからサイトの URL が決まってほしい, so that 設定の値を最小にできる

#### Acceptance Criteria

1. The サイト設定 shall サイトの URL を公開するドメインの値から作る
2. While 開発時でドメインが未設定のとき、the サイト設定 shall 開発サーバーのアドレスを使う

### Requirement 3: 配備設定

**Objective:** As a 運用者, I want 本番・develop・プレビューの配備先を公開するドメインから決めたい, so that 環境ごとの設定を個別に書かずに済む

#### Acceptance Criteria

1. The 本番の配備設定 shall 公開するドメインをテンプレートの置き換えで入れ、D1 を識別子ではなく名前で解決し、ブランチ別のプレビューを作らない
2. If 公開するドメインが欠けているとき, then the 本番の配備設定 shall 異常終了する
3. The develop 環境の配備設定 shall 別の Worker 名と develop サブドメインに develop 専用の D1・R2 を使い、ブランチ別のプレビューを配下に作り、プレビューの D1 には名前から引いた識別子を使う
4. The CI のワークフロー shall 運用者ごとの値を直接書かず GitHub の Variables から読み、main は本番へ、develop は develop 環境へ配備し、マイグレーションを配備先の D1 に適用する

### Requirement 4: 運用者固有の値の非混入

**Objective:** As a 運用者, I want フォーク元のコードに特定の運用者の値が含まれないようにしたい, so that どの運用者も同じコードを配備できる

#### Acceptance Criteria

1. The アプリのコード・テンプレート・ワークフロー shall 運用者固有の値（ドメイン・D1 の ID・測定 ID・運営者情報）を0件にする
