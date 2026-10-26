# Requirements Document

## Introduction

Blueskyへの投稿が成功した直後に、利用者が選んだSNSの投稿画面を開き、他SNSへの共有を1操作で始められるようにする。

## Boundary Context

- **In scope**:
  - 自動ポップアップするSNSの選択プルダウン。
  - 投稿成功後のポップアップ・WebShare・投稿先選択ダイアログの切り替え。
  - 共有の結果に応じた共有設定の自動変更。
- **Out of scope**:
  - 共有設定の保持。
  - 投稿先選択ダイアログの内部の動作。
  - 共有文の組み立てと省略の規則。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 自動ポップアップ先の選択

**Objective:** As a 利用者, I want 投稿後に自動で開く共有先を選びたい, so that 共有を1操作で始められる

#### Acceptance Criteria

1. The 選択プルダウン shall 投稿時に選択する・X・タイッツー・Mastodon・Misskey の5つの選択肢を各 SNS のアイコンと併せて表示する
2. When 選択値が変わったとき、the 選択プルダウン shall 横幅を選択中の内容の幅に合わせて変える

### Requirement 2: 投稿成功後のポップアップ

**Objective:** As a 利用者, I want 投稿が成功した直後に選んだ SNS の投稿画面が開いてほしい, so that 共有の手間が減る

#### Acceptance Criteria

1. While ポップアップを開く設定が ON で選択値が SNS のとき、when 投稿が成功したとき、the 共有の分岐 shall その SNS の投稿画面をポップアップで開く
2. While 選択値が投稿時に選択するのとき、when 投稿が成功したとき、the 共有の分岐 shall ポップアップを開かず投稿先選択ダイアログを開く
3. If 選択値が Mastodon または Misskey でインスタンスドメインが不正な形式のとき, then the 共有の分岐 shall ポップアップを開かず投稿先選択ダイアログを開き、選択値を変えない
4. If ポップアップを開けなかったとき, then the 共有の分岐 shall その旨を表示して投稿先選択ダイアログを開き、選択値を投稿時に選択するに変える
5. When 投稿ボタンがクリックされたとき、the 共有の分岐 shall 投稿処理の完了を待たずにウィンドウを開いておき、投稿完了後に共有先の投稿画面へ遷移させる

### Requirement 3: WebShare への切り替え

**Objective:** As a 利用者, I want ポップアップを使わない場合も共有の導線がほしい, so that 端末の共有機能で共有できる

#### Acceptance Criteria

1. While ポップアップを開く設定が OFF のとき、when 投稿が成功したとき、the 共有の分岐 shall WebShare で共有する
2. If 利用者が WebShare の共有をキャンセルしたとき, then the 共有の分岐 shall それ以上の処理をしない
3. If WebShare が非対応または失敗したとき, then the 共有の分岐 shall X のポップアップを開き、開けた場合はポップアップを開く設定を ON にして選択値を X にする
4. If WebShare の失敗後に X のポップアップも開けなかったとき, then the 共有の分岐 shall ポップアップを開く設定を ON にして選択値を投稿時に選択するにし、投稿先選択ダイアログを開く

### Requirement 4: 共有文

**Objective:** As a 利用者, I want 共有先に合った共有文が渡ってほしい, so that 共有先で内容が正しく伝わる

#### Acceptance Criteria

1. When ポップアップへ共有文を渡すとき、the 共有の分岐 shall 長文を省略して共有の設定に従って省略し、WebShare に渡す共有文は省略しない
2. While 画像を自分で添付が ON のとき、the 共有の分岐 shall 共有文に skyshare entry の URL を含めない
