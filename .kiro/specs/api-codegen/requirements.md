# Requirements Document

## Introduction

APIの入出力の定義を1か所に保ち、そこからOpenAPIのドキュメントとフロントエンド用のクライアントを生成して、サーバーとクライアントの食い違いを防ぐ。

## Boundary Context

- **In scope**:
  - APIのスキーマの登録と、OpenAPIドキュメントの組み立て。
  - 生成したクライアントが通信に使う取得処理とフォームデータの組み立て。
  - サーバー側でのフォームデータの復元と、リクエストの補助処理。
- **Out of scope**:
  - 個々のAPIのスキーマの内容。
  - 生成されたクライアントのコードそのもの。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: OpenAPI ドキュメントの組み立て

**Objective:** As a 開発者, I want API のスキーマから OpenAPI ドキュメントを組み立てたい, so that API 文書とクライアントが実装と食い違わない

#### Acceptance Criteria

1. The API スキーマ登録 shall 登録したすべての API のパスを含む OpenAPI 3.1 のドキュメントをスキーマから組み立てる
2. The API スキーマ登録 shall 登録する API のパスを末尾スラッシュにし、各操作に識別子を持たせる

### Requirement 2: クライアントの取得処理

**Objective:** As a 開発者, I want 生成したクライアントが通信先と応答の形を吸収してほしい, so that 呼び出し側が通信先や本文の形を意識しない

#### Acceptance Criteria

1. When 抽出 API のパスを呼び出したとき、the クライアントの取得処理 shall パスを抽出サービスの URL へ書き換え、パスの末尾のスラッシュを外す
2. When 旧ページのパスを呼び出したとき、the クライアントの取得処理 shall パスを旧バックエンドの URL へ書き換える
3. If 応答の本文が空である、または JSON でないとき, then the クライアントの取得処理 shall 例外にせず、本文をデータとして返す
4. When 画像の API の応答を受けたとき、the クライアントの取得処理 shall JSON にせず Blob のまま返す

### Requirement 3: フォームデータの組み立てと復元

**Objective:** As a 開発者, I want クライアントとサーバーの間でフォームデータを一貫した規則で受け渡したい, so that 複雑な入力も欠けずに届く

#### Acceptance Criteria

1. When クライアントがフォームデータを組み立てるとき、the フォームデータの組み立て shall 本文・見出し・キャプションの文字列のフィールドを JSON 文字列にして積み、それ以外の文字列はそのまま積む
2. When クライアントがフォームデータを組み立てるとき、the フォームデータの組み立て shall Blob をそのまま積み、Blob の配列を複数のフィールドへ展開する
3. When クライアントがフォームデータを組み立てるとき、the フォームデータの組み立て shall 投稿の配列を添字付きのフィールド名へ展開する
4. When サーバーがフォームデータを復元するとき、the フォームデータの復元 shall フィールドの種別の宣言に従って、添字付きのフィールドから複数件のオブジェクトの配列を復元する
5. If JSON の解釈に失敗した値があるとき, then the フォームデータの復元 shall その値を生の値のまま残す

### Requirement 4: リクエストの補助処理

**Objective:** As a 開発者, I want 取得件数の指定とリクエストの種別を共通の規則で判定したい, so that ハンドラごとに判定がばらつかない

#### Acceptance Criteria

1. When 取得件数が1から100の整数で指定されたとき、the 取得件数の判定 shall その値を数値として返す
2. If 取得件数が範囲外、または整数でないとき, then the 取得件数の判定 shall 不正として判定する
3. When リクエストを受けたとき、the リクエストの補助処理 shall cookie ヘッダの有無を判定できる
4. When リクエストを受けたとき、the リクエストの補助処理 shall フォームデータで送られたかを内容種別から判定できる
