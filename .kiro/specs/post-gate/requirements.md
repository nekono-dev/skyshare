# Requirements Document

## Introduction

投稿ごとに、返信できる相手と引用の可否を制限できるようにし、その既定値を端末に保存して、毎回の設定の手間を省けるようにする。

## Boundary Context

- **In scope**:
  - 返信できる相手の制限と、引用の許可を、Blueskyのレコードへ変換すること。
  - 返信と引用の設定を編集するダイアログ。
  - 設定の既定値の保存と読み取り。
- **Out of scope**:
  - 投稿に対するレコードの書き込み。
  - 自分が所有するリストの取得。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 返信の制限

**Objective:** As a 利用者, I want 返信できる相手を制限したい, so that 望まない返信を避けられる

#### Acceptance Criteria

1. While 誰でも返信できる設定のとき、the gate 変換 shall 返信の制限のレコードを作らない
2. While 返信不可の設定のとき、the gate 変換 shall 許可する相手が空の返信の制限のレコードを作る
3. While 相手を組み合わせる設定のとき、the gate 変換 shall 選んだメンション・フォロワー・フォロー中・リストごとの許可を返信の制限のレコードに含める
4. The gate 変換 shall 返信を許可するルールの合計を5件までとし、超えるリストの許可は含めない

### Requirement 2: 引用の制限

**Objective:** As a 利用者, I want 引用を許可するかを選びたい, so that 引用されたくない投稿を守れる

#### Acceptance Criteria

1. When 引用を許可するとき、the gate 変換 shall 引用の制限のレコードを作らない
2. When 引用を許可しないとき、the gate 変換 shall 埋め込みを無効にする引用の制限のレコードを作る

### Requirement 3: 既定値の保存

**Objective:** As a 利用者, I want 返信と引用の既定値を端末に残したい, so that 毎回設定しなくてよい

#### Acceptance Criteria

1. When 返信と引用の既定値が保存されたとき、the 設定 shall 端末に保存し、読み取ると同じ値を返す
2. If 保存値が無い、壊れている、または形式が不正なとき, then the 設定 shall 初期の既定値を使う
3. When 設定が判定されるとき、the 設定 shall 初期の既定値と一致するかを判定できる
4. The 設定 shall 投稿の後に既定値を更新するかどうかの設定を、端末に保存して読み取る

### Requirement 4: 設定のダイアログ

**Objective:** As a 利用者, I want ダイアログで返信と引用を編集し、適用するかを選びたい, so that 意図しない変更を残さない

#### Acceptance Criteria

1. When ダイアログで適用が選ばれたとき、the 返信と引用のダイアログ shall 編集した値を確定する（返信不可を選んで適用すると既定値として保存される）
2. When ダイアログでキャンセルが選ばれたとき、the 返信と引用のダイアログ shall 値を変えず、保存しない
