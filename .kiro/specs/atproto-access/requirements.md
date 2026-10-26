# Requirements Document

## Introduction

Bluesky（atproto）のPDSやAppViewに対する、認証済みエージェントの生成、blobのアップロード、レコードの全件取得、プロフィールとリストの参照、DIDからのPDS解決を、機能ごとに重複させず共通の部品として提供する。

## Boundary Context

- **In scope**:
  - 指定サービスに接続するエージェントの生成と、認証不要の公開エージェントの共有。
  - blobのアップロード。
  - コレクション内のレコードの全件取得。
  - 表示名の取得と、自分が所有するリストの取得。
  - DIDドキュメントからのPDSのURLの取り出しと、DIDからのPDSの解決。
- **Out of scope**:
  - 投稿レコードの組み立て。
  - 動画サービスのトークン発行。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: blob のアップロード

**Objective:** As a 実装者, I want blob を種別つきで PDS へ送りたい, so that 画像などが正しい種別で保存される

#### Acceptance Criteria

1. When blob をアップロードするとき、the atproto アクセス shall blob の種別を符号化の種別として PDS へ送る
2. If blob の種別が空のとき, then the atproto アクセス shall 汎用のバイナリ種別を使う

### Requirement 2: レコードの全件取得

**Objective:** As a 実装者, I want コレクション内のレコードを新しい順に全件取得したい, so that ページ分割を意識せず一覧を作れる

#### Acceptance Criteria

1. When コレクション内のレコードを取得するとき、the atproto アクセス shall カーソルを辿って新しい順に取得し、ページ内のすべてのレコードが指定日時より古くなったページで打ち切って、取得したページを結合して返す（指定日時より古いレコードを含みうる）

### Requirement 3: プロフィールとリストの参照

**Objective:** As a 実装者, I want 表示名と自分のリストを取得したい, so that 画面に名前と選択肢を出せる

#### Acceptance Criteria

1. If 表示名が空または未設定のとき, then the atproto アクセス shall 呼び出し側が渡すハンドルを返す
2. When 自分が所有するリストを取得するとき、the atproto アクセス shall キュレーションリストだけを名前と URI に整形して返し、モデレーションリストを除外する
3. If 自分が所有するリストの取得に失敗したとき, then the atproto アクセス shall 例外を呼び出し元へ伝える

### Requirement 4: PDS の解決

**Objective:** As a 実装者, I want DID から PDS の接続先を得たい, so that 利用者の PDS へ直接アクセスできる

#### Acceptance Criteria

1. When DID ドキュメントから PDS を取り出すとき、the atproto アクセス shall PDS を示すサービスの接続先だけを返す
2. If 該当するサービスが無い、または形式が不正なとき, then the atproto アクセス shall 未解決として扱う
3. When DID から PDS を解決するとき、the atproto アクセス shall PLC 方式の DID だけを問い合わせる
4. If PLC 方式でない DID である、または問い合わせが失敗したとき, then the atproto アクセス shall 未解決として扱い、PLC 方式でない DID では問い合わせを行わない
