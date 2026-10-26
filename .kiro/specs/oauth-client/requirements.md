# Requirements Document

## Introduction

Bluesky の OAuth のクライアントとして、ログインと予約投稿の許可に共通の、クライアントの識別・認可サーバーの探索・トークンの要求・PDS への要求・認可の画面からの戻りの受け渡しを提供する。開発用の手元の環境でも、本番と同じ認可サーバーで認可を受けられるようにする。

## Boundary Context

- **In scope**:
  - 配信元ごとのクライアントの識別子・戻り先・メタデータ・公開鍵の一覧。
  - 手元の開発環境での、開発用の公開クライアントと戻り先の中継。
  - 認可サーバーの探索と、DID から PDS の解決。
  - 認可の要求の事前送信・認可コードの交換・トークンの更新・取消と、DPoP の証明。
  - PDS への、DPoP に結び付けたアクセストークンでの要求。
  - 認可の画面からの戻りを、許可を始めたページへ用途とともに渡すこと。
- **Out of scope**:
  - 得たトークンの保管と、ログインや予約での使い方。
  - 認可の画面の表示と、利用者の認証。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: クライアントの識別とメタデータ

**Objective:** As a 認可サーバー, I want クライアントを識別できる情報を得たい, so that 正しいクライアントとして認可の要求を受け付けられる

#### Acceptance Criteria

1. The OAuth クライアント shall 配信元のオリジンごとに、クライアントの識別子・戻り先・要求しうるすべての権限を載せたメタデータと、署名の公開鍵の一覧を提供する
2. The OAuth クライアント shall 公開鍵の一覧に秘密鍵の成分を含めない
3. Where 配信元がループバックのホストの場合, the OAuth クライアント shall 権限と戻り先を識別子に含む開発用の公開クライアントとして振る舞い、戻り先にループバックの IP の http の住所を使う
4. When トークンを要求するとき、the OAuth クライアント shall 開発用の公開クライアントならクライアントの識別子だけを、それ以外ならクライアントの秘密鍵で署名した証明を付ける
5. If クライアントの秘密鍵が無いとき, then the OAuth クライアント shall 開発用の公開クライアント以外ではトークンを要求しない

### Requirement 2: 認可サーバーの探索と PDS の解決

**Objective:** As a OAuth クライアント, I want 利用者の PDS から認可サーバーを安全に見つけたい, so that 偽の認可サーバーへ誘導されない

#### Acceptance Criteria

1. When 認可サーバーを探すとき、the OAuth クライアント shall PDS の保護されたリソースのメタデータか認可サーバーの識別子から探し、メタデータの識別子の一致と、必要な端点と方式があることを確かめる
2. If メタデータの識別子が違う、または必要な端点が欠けた認可サーバーのとき, then the OAuth クライアント shall その認可サーバーを使わない
3. When DID から PDS を解決するとき、the OAuth クライアント shall DID ドキュメントに書かれた PDS を返し、解決できない DID では何も返さない

### Requirement 3: DPoP とトークンの要求

**Objective:** As a OAuth クライアント, I want トークンを DPoP に結び付けて取得・更新・取消したい, so that トークンが盗まれても悪用されにくい

#### Acceptance Criteria

1. When 認可サーバーまたは PDS へ要求するとき、the OAuth クライアント shall DPoP の証明を付ける
2. If nonce を求められたとき, then the OAuth クライアント shall 受け取った nonce で1回だけやり直す
3. The OAuth クライアント shall 認可の要求の事前送信・認可コードの交換・更新用トークンによる更新・取消を提供する
4. When トークンの応答を受けたとき、the OAuth クライアント shall 種類が DPoP 型で、持ち主・アクセストークン・更新用トークンがそろうものだけをトークンとして受け付ける
5. If 更新用トークンが失効していたとき, then the OAuth クライアント shall 再度の許可が必要な失敗として返す
6. The OAuth クライアント shall トークン・認可コード・鍵を含む文字列をログに出力する箇所を0件にし、認可とトークンの要求に失敗してもログに現さない

### Requirement 4: PDS への要求

**Objective:** As a OAuth クライアント, I want PDS へアクセストークンで要求したい, so that 利用者の代わりに操作できる

#### Acceptance Criteria

1. When PDS へ要求するとき、the OAuth クライアント shall DPoP に結び付けたアクセストークンと、そのハッシュを入れた証明を付ける
2. If nonce を求められたとき, then the OAuth クライアント shall 1回だけやり直す
3. The OAuth クライアントの処理 shall atproto のライブラリを読み込む箇所を0件にする

### Requirement 5: 認可の画面からの戻り

**Objective:** As a 利用者, I want 認可の画面から許可を始めたページへ戻りたい, so that 操作が中断されずに続けられる

#### Acceptance Criteria

1. When 認可の画面から戻ったとき、the 戻りの受け渡し shall 開始時に戻り先だけへ送る cookie に入れた用途とページへ、既知の項目だけを住所のフラグメントに移して転送する
2. If 戻り先の cookie の用途が不正なとき, then the 戻りの受け渡し shall 予約の設定のページへ転送する
3. If ページだけが不正なとき, then the 戻りの受け渡し shall 用途ごとの既定のページへ転送する
4. The 戻りの受け渡し shall 別のオリジンへは転送しない

### Requirement 6: 開発サーバーでの中継

**Objective:** As a 開発者, I want 手元の開発サーバーで本番と同じ認可を試したい, so that 本番にデプロイせずにログインを確認できる

#### Acceptance Criteria

1. When ループバックの戻り先への遷移があったとき、the 開発サーバー shall 同じパスとクエリのまま開発サーバーのオリジンへ転送する
