# Requirements Document

## Introduction

投稿だけを目的とする利用者のために、自分の投稿の一覧を読み込まず投稿フォームだけを表示する設定を設け、トップページの動作を軽くする。

## Boundary Context

- **In scope**:
  - タイムラインを表示しない設定の保持と、設定ページでの切り替え。
  - 設定がONのときのトップページの一覧・投稿フォーム・新規投稿ボタンの表示。
  - 設定がONのときの、投稿フォームを固定表示しない設定の扱い。
- **Out of scope**:
  - 一覧の表示内容とスレッドの折りたたみ。
  - 投稿フォームの入力と投稿の処理。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 設定の保持と切り替え

**Objective:** As a 利用者, I want タイムラインを表示しない設定を切り替えたい, so that 自分の使い方に合わせられる

#### Acceptance Criteria

1. The 設定 shall タイムラインを表示しない設定をブラウザ内に保持し、保存した値を同じ値で読み取り、未保存か不正な値のときは OFF とする
2. The 設定ページ shall 表示のグループに、タイムラインを表示しない設定のスイッチを置く
3. The 設定の表示 shall サーバー描画とクライアント初回描画の不一致によるハイドレーション警告を0件にする

### Requirement 2: トップページの出し分け

**Objective:** As a 利用者, I want 設定が ON のとき投稿フォームだけを軽く表示したい, so that 一覧の読み込みを待たずに投稿できる

#### Acceptance Criteria

1. While 設定が ON のとき、the トップページ shall 一覧を1件も取得・表示せず、投稿フォームを固定表示する
2. While 設定が ON のとき、the トップページ shall フローティングの新規投稿ボタンとサイドバーの新規投稿ボタンを表示しない
3. While 設定が ON で未ログインのとき、the トップページ shall ゲスト表示が要求されていればゲスト表示にし、要求されていなければログインページへ移る

### Requirement 3: 固定表示しない設定との関係

**Objective:** As a 利用者, I want 設定同士が矛盾しないでほしい, so that 投稿フォームが消えてしまわない

#### Acceptance Criteria

1. While 設定が ON の間、the 設定 shall 投稿フォームを固定表示しない設定を保存値によらず OFF として扱い、設定ページと投稿フォームで OFF かつ操作不能に表示する
2. When 設定が OFF に戻されたとき、the 設定 shall 投稿フォームを固定表示しない設定を保存値どおりの表示に戻す
