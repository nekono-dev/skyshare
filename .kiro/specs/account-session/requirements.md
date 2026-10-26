# Requirements Document

## Introduction

Bluesky のログイン状態を端末ごとに安全に保持し、複数アカウントの追加・切り替え・ログアウトと、認証が必要な API でのセッションの自動更新を提供する。

## Boundary Context

- **In scope**:
  - セッションの cookie による保持と、複数アカウントの非アクティブなセッションのプール
  - セッション一覧の取得、追加ログイン、アカウントの切り替え、ログアウトの API
  - v2 の API 配下でのセッションの自動再開とトークンの書き戻し
  - クライアントでのアクティブアカウント情報の共有取得
- **Out of scope**:
  - ログイン失敗時の文言（ログイン入力欄の表示）
  - 旧バックエンドのセッション
  - OAuth のセッションの発行・更新・取消（cookie の形式とプールの規則だけを共有する）
- **Adjacent expectations**: なし

## Requirements

### Requirement 1: セッションの cookie 保持

**Objective:** As a 利用者, I want ログイン状態を端末の cookie に安全に保ちたい, so that 再ログインせずに使い続けられる

#### Acceptance Criteria

1. The アカウントセッション管理 shall セッションを HttpOnly の cookie にのみ保持し、API の応答本文にトークンを含めない
2. The アカウントセッション管理 shall プール中のアカウントを1件ずつ別の cookie に置き、空いた枠の cookie を失効させる

### Requirement 2: セッション一覧の取得

**Objective:** As a 利用者, I want 保持しているアカウントの一覧を見たい, so that どのアカウントで操作しているか分かり、切り替えられる

#### Acceptance Criteria

1. When セッション一覧を要求されたとき、the セッション一覧 API shall アクティブアカウントを先頭にプール中のアカウントを続けて返し、各アカウントの表示名とアイコンを付与する
2. If セッションの cookie が無い、またはアクティブもプールも無い, then the セッション一覧 API shall 未認証として 401 を返す
3. If プロフィールの取得に失敗したとき, then the セッション一覧 API shall そのアカウントを表示名とアイコンの無い状態で一覧に含め、200 を返す

### Requirement 3: 追加ログイン

**Objective:** As a 利用者, I want 別のアカウントでもログインしたい, so that 複数のアカウントを使い分けられる

#### Acceptance Criteria

1. When 別のアカウントがアクティブな状態でログインしたとき、the アカウントセッション管理 shall 現在のアカウントをプールへ退避してから新しいアカウントをアクティブにする
2. When 同じアカウントで再ログインしたとき、the アカウントセッション管理 shall プールへ退避しない
3. If プールの保持数が上限（4件）に達している状態で追加ログインしたとき, then the アカウントセッション管理 shall 競合として 409 で拒否する

### Requirement 4: アカウントの切り替え

**Objective:** As a 利用者, I want プール中のアカウントへ切り替えたい, so that 再入力なしにアカウントを変えられる

#### Acceptance Criteria

1. When プール中の指定アカウントへ切り替えを要求されたとき、the アカウントセッション管理 shall そのアカウントをアクティブにし、現在のアクティブアカウントをプールへ戻す
2. If 切り替え対象がプールに無いとき, then the アカウントセッション管理 shall 見つからないものとして 404 で拒否する

### Requirement 5: ログアウト

**Objective:** As a 利用者, I want アカウントごとにログアウトしたい, so that 不要なセッションを端末から消せる

#### Acceptance Criteria

1. When アクティブアカウントを対象にログアウトしたとき、the アカウントセッション管理 shall セッションの cookie を失効させる
2. When プール中のアカウントを対象にログアウトしたとき、the アカウントセッション管理 shall そのアカウントをプールから除去する

### Requirement 6: セッションの自動再開

**Objective:** As a 利用者, I want 認証が必要な操作でログイン状態が自動で保たれてほしい, so that トークンの期限切れを意識せずに使える

#### Acceptance Criteria

1. The アカウントセッション管理 shall v2 の API 配下のうち、セッション操作のパスを除くパスだけを自動再開の対象にする
2. When 自動再開の対象のリクエストを再開できたとき、the アカウントセッション管理 shall 更新後のトークンを応答の cookie へ書き戻す
3. If 対象のリクエストにセッションの cookie が無い、または再開できないとき, then the アカウントセッション管理 shall 後続の処理を呼ばずに未認証として拒否する

### Requirement 7: クライアントでの共有取得

**Objective:** As a 利用者, I want 画面がアクティブアカウントを無駄なく取得してほしい, so that 余計な通信なしに表示される

#### Acceptance Criteria

1. When 同時に複数回のアクティブアカウントの取得が発生したとき、the クライアント shall 1回のリクエストにまとめる
2. While 同じタブで未ログインと判明しているとき、the クライアント shall 取得を繰り返さず未認証として扱う

### Requirement 8: キャッシュの禁止

**Objective:** As a 運用者, I want セッションの応答が共有のキャッシュに残らないようにしたい, so that トークンが漏れない

#### Acceptance Criteria

1. The アカウントセッション管理 shall セッション操作の4種（一覧・追加ログイン・切り替え・ログアウト）の応答の100%に、キャッシュを禁止する指定を付ける
