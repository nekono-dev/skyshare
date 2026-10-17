# アカウントとAPI基盤 アーキテクチャ

## 1. 目的と範囲

アカウントとAPI基盤は、ログインとアカウントの切り替えを受け付け、セッションを保ち、Bluesky への操作と API の契約を担う。
投稿の作成と管理の画面は、別の機能のくくりの対象である。

## 2. 構成要素

| 構成要素        | 種別   | 責務                                                       | 実装spec                             |
| --------------- | ------ | ---------------------------------------------------------- | ------------------------------------ |
| 利用者          | 外部   | ハンドルとパスワードを入力し、アカウントを切り替える       | -                                    |
| Bluesky PDS     | 外部   | 利用者の認証を受け付け、投稿とレコードを保管する           | -                                    |
| Bluesky AppView | 外部   | プロフィールやリストを公開 API で返す                      | -                                    |
| PLC Directory   | 外部   | DID から DID ドキュメントを返す                            | -                                    |
| アカウント画面  | 内部   | ログインの入力とアカウントの切り替えを受け付ける           | login-accounts                       |
| セッション管理  | 内部   | セッションを cookie に保持し、API ごとに再開と更新を行う   | account-session                      |
| Bluesky連携層   | 内部   | atproto の操作と投稿レコードの組み立てと NSID の導出を担う | atproto-access、post-record、lexicon |
| API契約と生成   | 内部   | API の入出力を1か所に定義し、文書とクライアントを生成する  | api-codegen、api-error-message       |
| 共通UI部品      | 他機能 | プルダウンと選択肢の見た目・操作・絞り込みを共通にする     | -                                    |
| 表示言語        | 他機能 | 表示言語を選び、日本語と英語の文言を切り替える             | -                                    |

## 3. システム構成

アカウント画面は、セッション管理と API 契約を使い、セッション管理は Bluesky 連携層へ依存する。

```mermaid
flowchart LR
  account["アカウント画面"] --> ui["共通UI部品"]
  account --> i18n["表示言語"]
  account --> session["セッション管理"]
  account --> contract["API契約と生成"]
  session --> atproto["Bluesky連携層"]
```

## 4. 外部インターフェース

| IF             | 方向 | 外部の要素      | 内部の要素     | 方式                                 | 認証                           |
| -------------- | ---- | --------------- | -------------- | ------------------------------------ | ------------------------------ |
| ログイン       | 提供 | 利用者          | アカウント画面 | HTTPS の画面（ハンドルとパスワード） | Bluesky のハンドルとパスワード |
| 認証           | 利用 | Bluesky PDS     | Bluesky連携層  | HTTPS（XRPC）                        | 利用者のハンドルとパスワード   |
| 公開情報の参照 | 利用 | Bluesky AppView | Bluesky連携層  | HTTPS（XRPC）                        | なし                           |
| DID解決        | 利用 | PLC Directory   | Bluesky連携層  | HTTPS（JSON）                        | なし                           |

利用者はログインでアカウント画面へ入り、Bluesky 連携層が外部の 3 つの要素へ出る。

```mermaid
flowchart LR
  subgraph システム境界
    account["アカウント画面"]
    atproto["Bluesky連携層"]
  end
  ext_user["利用者"] -->|ログイン| account
  atproto -->|認証| ext_pds["Bluesky PDS"]
  atproto -->|公開情報の参照| ext_appview["Bluesky AppView"]
  atproto -->|DID解決| ext_plc["PLC Directory"]
```

## 5. 機能

### ログイン

- 関与: 利用者, アカウント画面, セッション管理, Bluesky連携層, Bluesky PDS

ログインは、認証の成否で cookie の設定とエラーの返却に分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant account as アカウント画面
  participant session as セッション管理
  participant atproto as Bluesky連携層
  participant ext_pds as Bluesky PDS
  ext_user->>account: ハンドルとパスワードを入力
  account->>session: ログインを依頼
  session->>atproto: エージェントの生成
  atproto->>ext_pds: 認証
  alt 認証に成功
    session-->>account: cookie を設定して成功を返す
  else 認証に失敗
    session-->>account: エラーを返す
  end
```

### アカウントの切り替え

- 関与: 利用者, アカウント画面, セッション管理

アカウントの切り替えは、対象がプールにあるかどうかで結果が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant account as アカウント画面
  participant session as セッション管理
  ext_user->>account: アカウントを選ぶ
  account->>session: 切り替えを依頼
  alt 対象がプールにある
    session-->>account: 切り替え後の一覧
  else 対象がプールにない
    session-->>account: 見つからないエラー
  end
```

## 6. データ

| データ               | 保管場所                           | 書き込み主体   |
| -------------------- | ---------------------------------- | -------------- |
| ログインのセッション | 利用者のブラウザの HttpOnly cookie | セッション管理 |

## 7. 信頼と検証

| 対象             | 信頼する前提                                 | 検証手段                                                 | 根拠            |
| ---------------- | -------------------------------------------- | -------------------------------------------------------- | --------------- |
| API の呼び出し元 | 呼び出し元は有効なセッションを持つ本人である | リクエストごとにセッションを再開し、できなければ拒否する | account-session |
| 投稿レコード     | 本文の範囲指定は壊れていることがある         | facet の範囲を検証し、不正なら書き込まない               | post-record     |

## 8. 技術基盤

| 領域         | 採用               | 理由                                             | 根拠    |
| ------------ | ------------------ | ------------------------------------------------ | ------- |
| レコード定義 | atproto の Lexicon | フォークした運用者が自ドメインの NSID で配信する | lexicon |

## 9. 横断的制約

| 制約                             | 値         | 根拠            |
| -------------------------------- | ---------- | --------------- |
| アカウントのプールの保持数の上限 | 4 件       | account-session |
| 一覧の取得件数の指定             | 1 から 100 | api-codegen     |
