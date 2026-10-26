# Requirements Document

## Introduction

APIのエラーを表示言語の文言で利用者へ伝え、APIの応答から利用者向けの文言を取り除いて言語に依存しない形に統一する。

## Boundary Context

- **In scope**:
  - APIのエラー応答の形式。
  - HTTPステータスとエラーコードからの文言の決定。
  - 通信自体の失敗の文言。
- **Out of scope**:
  - 文言の辞書と翻訳の規則。
  - API固有のエラー条件そのもの。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 言語に依存しないエラー応答

**Objective:** As a 開発者, I want API のエラー応答に利用者向けの文言を含めたくない, so that 表示言語を画面側だけで決められる

#### Acceptance Criteria

1. The API shall エラー応答に利用者向けの文言を含めず、HTTP ステータスと言語に依存しない英語の固定文字列だけを返す

### Requirement 2: ステータスに応じた文言の表示

**Objective:** As a 利用者, I want エラーの原因が分かる文言を自分の表示言語で見たい, so that 次に何をすべきか判断できる

#### Acceptance Criteria

1. When エラー応答を受けたとき、the クライアント shall HTTP ステータスから表示言語の文言を決めて表示する
2. Where 同じ HTTP ステータスでも画面ごとに意味が異なる場合, the クライアント shall 画面の種別ごとに文言を分ける
3. If 個別の文言を持たないステータスのエラーを受けたとき, then the クライアント shall 汎用の失敗の文言を表示する
4. If 通信自体が失敗したとき, then the クライアント shall サーバーに接続できない旨の文言を表示する

### Requirement 3: ログインの上限到達

**Objective:** As a 利用者, I want アカウント数が上限に達してログインできないときに、その理由を知りたい, so that 不要なアカウントを整理できる

#### Acceptance Criteria

1. When ログイン時にアカウント数が上限に達しているとき、the ログイン API shall ステータス409で応答し、ログイン画面に上限に達した旨を表示言語の文言で表示させる

### Requirement 4: 処理固有の文言とエラーコード

**Objective:** As a 利用者, I want 一覧の取得や投稿の失敗を、その処理に合った文言で知りたい, so that サーバーの内部的な文字列に惑わされない

#### Acceptance Criteria

1. If 一覧や取得処理が失敗したとき, then the クライアント shall サーバーの返すエラー文字列を表示せず、その処理に固有の文言を表示する
2. When 投稿 API がエラーコードを返したとき、the クライアント shall そのコードを文言に変換して表示する
3. If 未知のエラーコードを受けたとき, then the クライアント shall 投稿失敗の汎用の文言を表示する
