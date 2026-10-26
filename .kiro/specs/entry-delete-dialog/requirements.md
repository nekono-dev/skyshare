# Requirements Document

## Introduction

entryを削除するとき、Bluesky投稿まで消すかを利用者が選べるようにし、取り消せない投稿の削除を誤って実行しないよう、削除される投稿を事前に確認させる。

## Boundary Context

- **In scope**:
  - entryの削除方式の選択と、Bluesky投稿の削除の最終確認。
  - 削除範囲の事前判定と、削除対象の投稿の一覧。
  - ゲスト表示での削除の模擬。
- **Out of scope**:
  - サーバーでの削除の処理。
  - 削除の操作を置く画面の配置。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 削除方式の選択

**Objective:** As a 利用者, I want entry だけを消すか、投稿も消すかを選びたい, so that 意図しない削除を避けられる

#### Acceptance Criteria

1. When 削除の確認が開かれたとき、the 削除ダイアログ shall Skyshare リンクを削除・リンクと Bluesky 投稿を削除・キャンセルの3つを示す
2. When Skyshare リンクを削除が選ばれたとき、the 削除ダイアログ shall 追加の確認なしに entry だけを削除する
3. When リンクと Bluesky 投稿を削除が選ばれたとき、the 削除ダイアログ shall すぐには削除せず、元に戻せない旨と第三者の返信が残る旨を示す最終確認を表示する
4. When 最終確認でキャンセルされたとき、the 削除ダイアログ shall 何も削除しない
5. If サーバーが削除を拒否したとき, then the 削除ダイアログ shall 削除せずにその旨のエラーを表示し、entry を残す

### Requirement 2: 最終確認の一覧

**Objective:** As a 利用者, I want 削除される投稿を事前に確認したい, so that 取り消せない削除を安心して確定できる

#### Acceptance Criteria

1. When 最終確認が表示されたとき、the 削除ダイアログ shall 削除される投稿が1件かスレッドかとその件数を示し、削除対象の投稿を古い順にすべて一覧で表示する
2. The 削除ダイアログ shall 一覧の各投稿に本文・投稿日時・画像のサムネイルを表示し、長い本文は省略し、本文が空の投稿はその旨を示し、画像の無い投稿にはサムネイルを表示しない
3. While 一覧の件数が多いとき、the 削除ダイアログ shall 確定とキャンセルの操作を常に画面内に表示する
4. When 削除の確認を開くとき、the 削除ダイアログ shall 削除範囲と一覧を開く前に取得し、最終確認を開くときに追加の通信をしない
5. The 削除ダイアログ shall 最終確認の一覧の投稿と、サーバーが実際に削除する投稿の差異を0件にし、分岐がある場合も同じ1系統の件数にする

### Requirement 3: 削除できない・不要な場合

**Objective:** As a 利用者, I want 投稿を消せない理由が分かるようにしたい, so that 取り得る手段を判断できる

#### Acceptance Criteria

1. If 派生元が返信の投稿である entry のとき, then the 削除ダイアログ shall リンクと Bluesky 投稿を削除を選択不可にし、理由と取り得る手段を表示する
2. If 派生元の状態を確認できないとき, then the 削除ダイアログ shall リンクと Bluesky 投稿を削除を選択不可にし、確認できなかった旨を表示する
3. If 派生元が削除済みの entry のとき, then the 削除ダイアログ shall Bluesky 投稿の削除を示さない、entry だけの削除の確認にする

### Requirement 4: ゲスト表示での模擬

**Objective:** As a 開発者, I want ゲスト表示で削除の流れを通信なしで確認したい, so that 実アカウントなしに画面を検証できる

#### Acceptance Criteria

1. While ゲスト表示のとき、the 削除ダイアログ shall 通信をせずに削除範囲の判定と削除の結果を画面上で模擬し、確定するとカードを画面から消す
