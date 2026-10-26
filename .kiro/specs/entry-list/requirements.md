# Requirements Document

## Introduction

作成したSkyshare entryを一覧で確認し、参照先の投稿が失われたentryを見分け、見出しとキャプションを後から編集できるようにする。

## Boundary Context

- **In scope**:
  - 自分のentryの一覧の取得と、参照先の投稿が残っているかの判定。
  - 一覧ページでのentryの表示。
  - 見出しとキャプションの編集。
- **Out of scope**:
  - entryの削除の確認。
  - entryの作成。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 一覧の取得

**Objective:** As a 利用者, I want 自分の entry の一覧を取得したい, so that 作成した共有ページを確認できる

#### Acceptance Criteria

1. If 取得件数の指定が範囲外のとき, then the 一覧 API shall 400 で拒否する
2. If ログインしていないとき, then the 一覧 API shall 未認証として 401 で拒否する
3. When 一覧が取得されるとき、the 一覧 API shall 各 entry に、参照先の投稿が削除済みかを示す印を付ける（存在するときは偽、削除済みのときは真）
4. If 一覧の取得に失敗したとき, then the 一覧 API shall 失敗の原因に応じたステータスで応答する

### Requirement 2: 一覧ページの表示

**Objective:** As a 利用者, I want entry ごとの内容と状態を見分けたい, so that 参照先の失われた entry に気づける

#### Acceptance Criteria

1. The 一覧ページ shall entry ごとに作成日時・キャプション・代表画像を持つカードを表示する
2. While 参照先の投稿が削除されているとき、the カード shall 中身のコントラストを下げて他と見分けられるようにする
3. While 参照先の投稿が削除されているとき、the カード shall 作成日時の横に「元投稿削除済み」のバッジを表示し、削除済みでないカードには表示しない

### Requirement 3: 見出しとキャプションの編集

**Objective:** As a 利用者, I want 見出しとキャプションを後から直したい, so that 共有カードの内容を整えられる

#### Acceptance Criteria

1. When 見出しとキャプションを編集して保存したとき、the 編集ダイアログ shall 更新の内容をサーバーへ送る
2. While ゲスト表示のとき、the 編集ダイアログ shall 編集のボタンを無効にする
3. The 編集ダイアログ shall 入力欄の文字数の表示を、lexicon の上限と同じ UTF-8 のバイト数で数える
