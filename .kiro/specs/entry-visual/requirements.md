# Requirements Document

## Introduction

投稿の画像や動画から、Xのリンクカードで投稿の内容が伝わるentryの代表画像と見出しを生成し、利用者が代表画像の切り抜きを調整できるようにする。

## Boundary Context

- **In scope**:
  - 画像と動画の投稿からの代表画像の合成。
  - 代表画像の切り抜きの調整。
  - entryの見出しと説明文の生成。
  - 既存の投稿から作るentryの代表画像と見出し。
- **Out of scope**:
  - 画像と動画の添付の操作。
  - entryの作成のAPI。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 画像の投稿の代表画像

**Objective:** As a 利用者, I want 画像の投稿から代表画像を作りたい, so that リンクカードで投稿の内容が伝わる

#### Acceptance Criteria

1. When 画像の投稿から代表画像を作るとき、the 代表画像生成 shall 先頭4枚を1200×630の1枚に合成し、5枚目以降を使わない
2. The 代表画像生成 shall 合成の配置を、1枚は全面、2枚は左右、3枚は左1枚と右2枚、4枚は2×2とする

### Requirement 2: 動画の投稿の代表画像

**Objective:** As a 利用者, I want 動画の投稿から再生ボタン付きの代表画像を作りたい, so that リンクカードで動画だと分かる

#### Acceptance Criteria

1. When 動画の投稿から代表画像を作るとき、the 代表画像生成 shall poster を1200×630に収め、中央に半透明の暗い円と白い再生記号の再生ボタンを描く
2. The 代表画像生成 shall 再生ボタンを、スマホ（iPhone Air）の X アプリで幅342pxのカードに縮小したとき直径59pxの円になる寸法で描く
3. The 代表画像生成 shall 再生ボタンの色の誤差を各チャンネル6以内、位置と寸法の誤差を2px以内にする

### Requirement 3: サムネ調整

**Objective:** As a 利用者, I want 代表画像の切り抜きを調整したい, so that 見せたい部分を選べる

#### Acceptance Criteria

1. While 画像か動画を添付している間、the サムネ調整のボタン shall 画像と動画の追加ボタンの行の下にある追加操作の行に表示する
2. While 投稿の処理中のとき、the サムネ調整のボタン shall 操作できない状態にする
3. When サムネ調整が開かれたとき、the 調整の画面 shall 画像は先頭4枚、動画は poster の配置と拡大率を調整できるようにし、動画はアップロードの状態によらず調整できる
4. The 調整の画面 shall 動画の調整の画面に再生ボタンを表示せず、確定後の代表画像には調整によらず中央に再生ボタンを描く

### Requirement 4: 見出しと説明文

**Objective:** As a 利用者, I want entry の見出しと説明文が自動で付いてほしい, so that 入力の手間なく共有できる

#### Acceptance Criteria

1. When 画像の投稿から見出しを生成するとき、the entry の文面生成 shall 「投稿者名 | Skyshare」とする
2. When 動画の投稿から見出しを生成するとき、the entry の文面生成 shall 再生時間（m:ss、1時間以上は h:mm:ss）とする
3. The entry の文面生成 shall 説明文を本文とする

### Requirement 5: 既存の投稿から作る entry

**Objective:** As a 利用者, I want 既存の投稿からも同じ代表画像で entry を作りたい, so that 後から共有用のページを作れる

#### Acceptance Criteria

1. When 既存の画像の投稿から entry を作るとき、the 代表画像生成 shall 先頭4枚だけを取得して代表画像を作る
2. When 既存の動画の投稿から entry を作るとき、the 代表画像生成 shall poster と再生ボタンで代表画像を作る
3. If 既存の動画の投稿から再生時間を取得できないとき, then the 代表画像生成 shall entry を作成せずに失敗を通知する
