# Requirements Document

## Introduction

旧バックエンドに保存された過去の投稿ページを、現行のデザインで表示し、投稿者本人が削除できるようにする。

## Boundary Context

- **In scope**:
  - 旧形式の投稿ページの表示と、識別子の検証。
  - 旧バックエンドからの投稿情報の取得と、削除の依頼。
  - 投稿者本人に限った削除の導線。
- **Out of scope**:
  - 旧形式の投稿ページの新規作成。
  - 旧バックエンド自体の実装。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 旧形式の投稿ページの表示

**Objective:** As a 閲覧者, I want 過去の投稿ページを現行のデザインで見たい, so that 旧形式のリンクが開けなくならない

#### Acceptance Criteria

1. When 旧バックエンドからの投稿情報の取得に成功したとき、the 旧形式の投稿ページ shall 画像・投稿者・添付画像を返す
2. If 旧バックエンドからの投稿情報の取得に失敗したとき, then the 旧形式の投稿ページ shall その理由を返す
3. If 識別子の種別かキーの形式が不正なとき, then the 旧形式の投稿ページ shall 旧バックエンドへ問い合わせずに 404 として扱う

### Requirement 2: 削除の対象と認証

**Objective:** As a 投稿者, I want 自分の旧形式の投稿を削除したい, so that 過去のページを取り下げられる

#### Acceptance Criteria

1. When 削除が要求されたとき、the 削除 API shall ログイン済みの本人の資格情報とともに旧バックエンドへ依頼する
2. If 削除の対象の種別が旧形式の識別子でも数字でもない、またはキーが「識別@キー」の形式でないとき, then the 削除 API shall 400 で拒否し、依頼しない
3. When 種別が旧形式の識別子または数字のとき、the 削除 API shall 削除を依頼する
4. If 本文が JSON でないとき, then the 削除 API shall 400 で拒否する
5. If cookie または セッションが無いとき, then the 削除 API shall 未認証として 401 で拒否し、依頼しない

### Requirement 3: 削除の依頼と結果

**Objective:** As a 投稿者, I want 削除の結果が分かるようにしたい, so that 失敗の理由を知って対処できる

#### Acceptance Criteria

1. When 旧バックエンドへ削除を依頼するとき、the 削除 API shall 識別子を「種別/キー」の形で依頼し、成功なら成功を返す
2. If 旧バックエンドがエラーを返したとき, then the 削除 API shall その理由を返す
3. If 通信が失敗したとき, then the 削除 API shall 不明なエラーを返す
4. If 旧バックエンドが失敗したとき, then the 削除 API shall 不正な依頼を400に、頻度制限を429に、それ以外を500に変換して応答する

### Requirement 4: OAuth のセッションでの削除

**Objective:** As a OAuth でログインした投稿者, I want 削除できない理由を知りたい, so that アプリパスワードで再ログインすれば削除できると分かる

#### Acceptance Criteria

1. If OAuth のセッションで削除が要求されたとき, then the 削除 API shall 旧バックエンドへ送らずに識別子つきの 403 で拒否する
2. When 削除が識別子つきの 403 で拒否されたとき、the 削除のボタン shall ボタンの下にアプリパスワードでのログインを求める文言を表示する
