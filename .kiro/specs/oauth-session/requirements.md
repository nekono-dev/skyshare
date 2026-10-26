# Requirements Document

## Introduction

利用者がパスワードを入力せずに Bluesky の OAuth でログインでき、得たセッションで、API の利用・アカウントの切り替え・ログアウトを、アプリパスワードのセッションと同じように扱えるようにする。

## Boundary Context

- **In scope**:
  - OAuth によるログインの開始と完了の API。
  - v2 の API での OAuth のセッションの再開と、期限の前の更新。
  - OAuth のセッションでの DPoP の証明を付けた PDS への要求。
  - OAuth のアカウントへの切り替えと、ログアウトでの取消。
- **Out of scope**:
  - ログインの画面と、認可の画面からの戻りの表示。
  - アプリパスワードのセッションの扱い。
  - Bluesky がホスティングしないアカウントの OAuth によるログイン。
- **Adjacent expectations**:
  - 前提: oauth-client — クライアントの識別・認可サーバーの探索・トークンと PDS への要求を使う
  - 前提: account-session — セッションの cookie の形式とプールの規則を共有する

## Requirements

### Requirement 1: ログインの開始

**Objective:** As a 利用者, I want ユーザー名を入力せずに認可の画面へ進みたい, so that パスワードを Skyshare に渡さずにログインできる

#### Acceptance Criteria

1. When ログインの開始が要求されたとき、the ログインの開始 API shall ユーザー名を受け取らずに Bluesky の認可サーバーへ、ログインの権限で認可の要求を事前に送り、認可の画面の住所を返す
2. Where ハンドルの指定がある場合, the ログインの開始 API shall そのハンドルを入力済みの指定として送る
3. When ログインが開始されたとき、the ログインの開始 API shall 照合に使う途中の状態を、完了の API のパスに限った10分の HttpOnly の cookie に入れる

### Requirement 2: ログインの完了

**Objective:** As a 利用者, I want 認可の後に安全にログインを完了したい, so that 他人の認可の結果を取り込まれない

#### Acceptance Criteria

1. When ログインの完了が要求されたとき、the ログインの完了 API shall 途中の状態との state と発行元の一致を確かめてから、認可コードをトークンに替える
2. If 途中の状態と違う state、途中の状態が無い戻り、または発行元の違う戻りのとき, then the ログインの完了 API shall トークンを要求しない
3. When トークンを得たとき、the ログインの完了 API shall トークンの持ち主の PDS の認可サーバーが発行元と一致し、PDS がそのトークンで持ち主のセッションを返すことを確かめてから、セッションを作る
4. If PDS の認可サーバーが発行元と違う、または PDS がセッションを返さないとき, then the ログインの完了 API shall セッションを作らない
5. When セッションを作ったとき、the ログインの完了 API shall パスワードのログインと同じ規則でアクティブにし、別のアカウントがアクティブだったときはプールへ退避する
6. If プールが上限に達しているとき, then the ログインの完了 API shall 別のアカウントでの完了を 409 で拒否する
7. When ログインの完了が成功または失敗で終わったとき、the ログインの完了 API shall 途中の状態の cookie を消し、失敗には分類を返す
8. The ログインの開始と完了の API shall 応答の100%にキャッシュを禁止する指定を付ける
9. If ログインの完了に失敗したとき, then the ログインの完了 API shall トークン・認可コード・鍵を含む文字列を応答の本文とログに出力しない

### Requirement 3: セッションの再開と更新

**Objective:** As a 利用者, I want OAuth のセッションでも API を続けて使いたい, so that トークンの期限切れで操作が止まらない

#### Acceptance Criteria

1. When v2 の API でセッションが再開されるとき、the OAuth のセッション shall アクセストークンの期限まで60秒を切ったときだけ更新し、更新したときだけセッションの cookie を書き戻す
2. If 更新用トークンが失効しているとき, then the OAuth のセッション shall v2 の API を 401 で拒否する
3. When OAuth のアカウントへ切り替えるとき、the OAuth のセッション shall 期限の近いアクセストークンを更新してからアクティブにし、更新できなければ 401 で拒否する
4. The 全リクエストで読み込まれる経路 shall atproto のライブラリを静的に読み込む箇所を0件にする

### Requirement 4: PDS への要求とログアウト

**Objective:** As a 利用者, I want OAuth のセッションで PDS を操作し、ログアウトで許可を取り消したい, so that 不要になったトークンが残らない

#### Acceptance Criteria

1. When PDS へ要求するとき、the OAuth のセッション shall DPoP の証明を付けて送り、最後に受け取った nonce を cookie で次のリクエストへ持ち越す
2. When OAuth のアカウントがログアウトされたとき、the OAuth のセッション shall 更新用トークンを認可サーバーで取り消してから cookie から除く
3. If 取消が失敗したとき, then the OAuth のセッション shall 止まらずに cookie から除く
