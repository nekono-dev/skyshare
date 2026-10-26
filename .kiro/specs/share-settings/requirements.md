# Requirements Document

## Introduction

他SNSへの共有に関わる設定をブラウザ内に保持し、投稿フォームと設定ページから同じ値を操作できるようにする。

## Boundary Context

- **In scope**:
  - 共有設定6項目（ポップアップを開く・自動ポップアップするSNS・画像を自分で添付・長文を省略して共有・Mastodonのインスタンスドメイン・Misskeyのインスタンスドメイン）の保持。
  - 設定ページでの共有設定の表示と変更。
  - 旧共有設定（自動ポップアップをOFFにする・タイッツーにクロスポスト・Mastodonにクロスポスト・X投稿ボタンを表示）の引き継ぎ。
- **Out of scope**:
  - 共有設定に基づく共有処理そのもの。
  - 投稿フォームでの共有設定の配置。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 設定の保持

**Objective:** As a 利用者, I want 共有設定が再読み込み後も残ってほしい, so that 毎回設定し直さなくてよい

#### Acceptance Criteria

1. The 共有設定 shall ポップアップを開く・自動ポップアップする SNS・画像を自分で添付・長文を省略して共有・Mastodon のインスタンスドメイン・Misskey のインスタンスドメインの6項目をブラウザ内に保持し、ページの再読み込み後も同じ値を表示する
2. While 設定が未保存のとき、the 共有設定 shall 既定値を、自動ポップアップする SNS が X、長文を省略して共有が OFF、Mastodon のインスタンスドメインが Mastodon 公式の既定ドメイン、Misskey のインスタンスドメインが misskey.io とする
3. If ブラウザ内の保存領域が使えない環境で読み書きしたとき, then the 共有設定 shall 例外を0件に抑え、既定値を返す
4. The 共有設定の表示 shall サーバー描画とクライアント初回描画の不一致によるハイドレーション警告を0件にする

### Requirement 2: 画像を自分で添付と長文の省略

**Objective:** As a 利用者, I want 画像を自分で添付するときに省略が干渉しないでほしい, so that 設定同士の矛盾が起きない

#### Acceptance Criteria

1. While 画像を自分で添付が ON のとき、the 共有設定 shall 長文を省略して共有を OFF に固定し、操作できなくする
2. When 画像を自分で添付が ON にされたとき、the 共有設定 shall 長文を省略して共有の保存値を OFF にする
3. When 画像を自分で添付が OFF に戻されたとき、the 共有設定 shall 長文を省略して共有を自動では ON に戻さない

### Requirement 3: 設定ページ

**Objective:** As a 利用者, I want 設定ページで共有設定を確認・変更したい, so that 共有先のドメインなどを設定できる

#### Acceptance Criteria

1. The 設定ページ shall Mastodon・Misskey のインスタンスドメインを常時表示の入力欄で設定させ、ドメインとして不正な形式の値を保存しない
2. While ポップアップを開く設定が ON のとき、the 設定ページ shall 自動ポップアップする SNS のプルダウンを表示し、OFF のときは表示しない

### Requirement 4: 旧共有設定の引き継ぎ

**Objective:** As a 利用者, I want 以前の共有設定を引き継ぎたい, so that 更新後も共有の挙動が変わらない

#### Acceptance Criteria

1. When 自動ポップアップする SNS が未保存で旧共有設定が保存されているとき、the 共有設定 shall 旧共有設定から値を決めて保存し、旧共有設定のキー4つを削除する
2. When 旧共有設定のクロスポスト3項目が引き継がれるとき、the 共有設定 shall 2つ以上 ON なら投稿時に選択する、1つだけ ON ならその SNS、それ以外なら X を引き継ぐ
