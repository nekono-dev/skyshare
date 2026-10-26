# Requirements Document

## Introduction

リンクを含む画像や動画の投稿からskyshare entryを作って他のSNSへ共有するとき、共有文に残すURLをskyshare entryのURLだけにし、共有先でskyshareのリンクカードが優先して表示されるようにする。他のURLはBluesky側の投稿に任せる。

## Boundary Context

- **In scope**:
  - 「Skyshareのリンクカードを優先表示」の設定の保持と切り替えの表示。
  - 投稿フォームの投稿直後の共有と、タイムラインのカードからの共有の共有文。
- **Out of scope**:
  - Blueskyへ投稿する本文と埋め込み。
  - 共有文の長文の省略の規則。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 設定の保持と切り替え

**Objective:** As a 利用者, I want リンクカードの優先表示を切り替えたい, so that 共有先での見え方を選べる

#### Acceptance Criteria

1. The 設定 shall 「Skyshare のリンクカードを優先表示」をブラウザ内に保持し、未保存のときの値を ON とする
2. The 設定の切り替え shall 投稿フォームと設定ページのそれぞれで「画像を自分で添付する」の直下に置く
3. While 画像を自分で添付が ON のとき、the 設定の切り替え shall 操作できず、共有文にも設定を適用しない
4. The 設定の表示 shall サーバー描画とクライアント初回描画の不一致によるハイドレーション警告を0件にする

### Requirement 2: 共有文の本文

**Objective:** As a 利用者, I want 共有文の URL を skyshare entry の URL に絞りたい, so that 共有先で skyshare のリンクカードが優先される

#### Acceptance Criteria

1. While 設定が ON で共有文に skyshare entry の URL を含めるとき、the 共有文の組み立て shall 本文に含まれる URL を共有文から取り除く
2. When 本文の URL を取り除いたとき、the 共有文の組み立て shall リンクカードの URL も共有文の末尾に補わない
3. While 設定が OFF、または skyshare entry の URL を含めない共有のとき、the 共有文の組み立て shall 本文の URL を残す
4. When URL を取り除いた後の本文を整えるとき、the 共有文の組み立て shall 行末に残る空白と、3行以上連続する改行を2行に詰める

### Requirement 3: 適用先

**Objective:** As a 利用者, I want どの共有の経路でも同じ規則が使われてほしい, so that 共有の仕方によって結果が変わらない

#### Acceptance Criteria

1. The 共有文の組み立て shall 設定の適用先を、投稿直後のポップアップ・WebShare・投稿先選択ダイアログと、タイムラインのカードの投稿先選択ダイアログ・WebShare とする
