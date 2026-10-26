# Requirements Document

## Introduction

投稿内容を共有するSNSを利用者がその場で選べるダイアログを提供し、投稿直後とタイムラインの投稿の両方から他SNSへ共有できるようにする。

## Boundary Context

- **In scope**:
  - 投稿先選択ダイアログの選択肢と開閉。
  - 投稿直後とタイムラインの投稿からのダイアログの表示。
- **Out of scope**:
  - ダイアログを自動で開くかどうかの判断。
  - 共有文の組み立てと省略の規則。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 選択肢と開閉

**Objective:** As a 利用者, I want 共有先を選べるダイアログを開きたい, so that 投稿の内容を好みの SNS へ共有できる

#### Acceptance Criteria

1. The 投稿先選択ダイアログ shall X・タイッツー・Mastodon・Misskey・閉じるの5つの選択肢を持ち、skyshare entry の有無によらず開ける
2. When 閉じるの選択・背景のクリック・Esc キーのいずれかが操作されたとき、the 投稿先選択ダイアログ shall 閉じる
3. If Mastodon または Misskey のインスタンスドメインが不正な形式のとき, then the 投稿先選択ダイアログ shall その SNS の選択肢だけを選べなくする

### Requirement 2: 投稿直後の共有

**Objective:** As a 利用者, I want 投稿直後に複数の共有先へ続けて共有したい, so that 何度もダイアログを開き直さずに済む

#### Acceptance Criteria

1. When 投稿直後に開いたダイアログで投稿先が選ばれたとき、the 投稿先選択ダイアログ shall 閉じず、複数の投稿先を続けて選べるようにする
2. While 投稿フォームを固定表示しない設定で投稿したとき、the 投稿先選択ダイアログ shall 投稿フォームが閉じた後も表示し続ける
3. When 投稿が成功したとき、the 投稿フォーム shall ダイアログを開くかどうかによらず入力欄を空にする

### Requirement 3: タイムラインからの共有

**Objective:** As a 利用者, I want 過去の投稿も共有したい, so that タイムラインの投稿を後から他 SNS へ届けられる

#### Acceptance Criteria

1. When タイムラインの投稿から開いたダイアログで投稿先が選ばれたとき、the 投稿先選択ダイアログ shall その投稿画面をポップアップで開いてから閉じる
2. When 投稿先が選ばれたとき、the 投稿先選択ダイアログ shall 選ぶたびに長文を省略して共有の設定を読み直し、その投稿先向けの省略を行った共有文を渡す
3. The タイムラインの投稿のカード shall skyshare entry の有無・作成の可否によらず、ダイアログを開くボタンを表示する
