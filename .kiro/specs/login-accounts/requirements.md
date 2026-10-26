# Requirements Document

## Introduction

Blueskyのアカウントに、OAuth とアプリパスワードのどちらでもログインでき、この端末に紐付いた複数のアカウントを切り替えられるようにする。

## Boundary Context

- **In scope**:
  - OAuth とアプリパスワードによるログインの画面と、ログインの案内。
  - 認可の画面からの戻りでのログインの完了と結果の表示。
  - アカウントの一覧・切り替え・ログアウトと、失効したセッションの再ログイン。
  - 旧アプリのパスからの転送。
- **Out of scope**:
  - セッションの発行・更新・失効の処理。
  - ナビゲーションのアカウントのアイコン（app-navigation が扱う）。
- **Adjacent expectations**:
  - 前提: account-session — アカウントの一覧・追加・切り替え・ログアウトのAPIを提供する

## Requirements

### Requirement 1: アカウントの一覧

**Objective:** As a 利用者, I want この端末のアカウントを一覧で見たい, so that 使用中のアカウントが分かる

#### Acceptance Criteria

1. The アカウントの一覧 shall 使用中のアカウントにだけ目印を付けて表示する
2. If 未ログインでアカウントのページを開いた、または一覧の取得が未ログインの応答になったとき, then the アカウントのページ shall ログインのページへ遷移する

### Requirement 2: 切り替えとログアウト

**Objective:** As a 利用者, I want アカウントを切り替え、不要なアカウントからログアウトしたい, so that 複数のアカウントを使い分けられる

#### Acceptance Criteria

1. When 使用中でないアカウントが選ばれたとき、the アカウントの一覧 shall そのアカウントの識別子を指定した切り替えを依頼する
2. If 切り替えがセッション切れで拒否されたとき, then the アカウントの一覧 shall そのアカウントに要再ログインの表示を付け、ハンドルを入力済みの再ログインの案内を出す
3. When ログアウトが押されたとき、the アカウントの一覧 shall そのアカウントの識別子を指定したログアウトを依頼する

### Requirement 3: アプリパスワードでのログイン

**Objective:** As a 利用者, I want アプリパスワードでもログインしたい, so that OAuth を使えない場合も利用できる

#### Acceptance Criteria

1. When ハンドルとパスワードが送信されたとき、the ログインのフォーム shall ログインを依頼し、成功したら成功を表示する
2. The ログインのフォーム shall OAuth のボタンだけを表示し、アプリパスワードの入力をその下の折りたたみを開いたときだけ表示する

### Requirement 4: OAuth でのログイン

**Objective:** As a 利用者, I want OAuth で安全にログインしたい, so that パスワードを入力せずに済む

#### Acceptance Criteria

1. When OAuth のボタンが押されたとき、the ログインのフォーム shall 説明文やユーザー名の入力欄を伴わずにログインの開始を依頼し、返った住所の認可の画面へ遷移する
2. When 認可の画面から戻ったページが開かれたとき、the ログインのフォーム shall 表示した時点から完了までログイン中の表示を出してログインのフォームを押せなくする
3. When 戻りの項目を持つ住所でページが開かれたとき、the ログインのフォーム shall 戻りの項目を住所から消してログインの完了を依頼し、成功すればトップへ遷移する
4. If ログインの完了が失敗したとき, then the ログインのフォーム shall 理由をステータスメッセージで表示し、ログインのフォームを押せるようにする
5. When 再ログインの案内で OAuth のボタンが押されたとき、the ログインのフォーム shall 対象のハンドルを指定してログインの開始を依頼する

### Requirement 5: ログインのページと旧パス

**Objective:** As a 利用者, I want ログインのページから必要な案内にたどり着きたい, so that 旧UIやゲスト表示にも移れる

#### Acceptance Criteria

1. The ログインのページ shall 旧 UI とゲスト表示へのリンクを含む案内を表示する
2. When 旧アプリのパスが開かれたとき、the 旧アプリのパス shall ログインのページへ転送する
